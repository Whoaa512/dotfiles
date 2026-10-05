/**
 * fzf File Picker Extension
 *
 * Replaces the built-in @ file autocomplete with `fzf --filter` over a cached `fd` listing.
 * Delegates slash commands, empty queries, and applyCompletion to the built-in provider.
 *
 * Nothing blocks the keystroke path: fd and fzf run async, the fd walk is cached per base directory, shared
 * between concurrent requests, and never killed by a keystroke abort. Requests self-debounce
 * so the editor's own debounce can stay at upstream's 20ms.
 */

import { spawn, spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { basename, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem, AutocompleteProvider } from "@earendil-works/pi-tui";

const MAX_RESULTS = 20;
const LISTING_TTL_MS = 15_000;
const DEBOUNCE_MS = 130;
const PATH_DELIMITERS = new Set([" ", "\t", '"', "'", "="]);

/** Newline-separated paths relative to baseDir, exactly as fd prints them. */
export type GetListing = (baseDir: string) => Promise<string>;
export type FilterListing = (listing: string, query: string, signal: AbortSignal) => Promise<string[]>;

function which(bin: string): string | null {
	const cmd = process.platform === "win32" ? "where" : "which";
	const result = spawnSync(cmd, [bin], { encoding: "utf-8" });
	if (result.status !== 0 || !result.stdout) return null;
	return result.stdout.split(/\r?\n/).find(Boolean)?.trim() ?? null;
}

/** Lists files and directories under baseDir. Directories end with "/". Resolves "" on failure. */
export function fdWalk(fdPath: string, baseDir: string): Promise<string> {
	return new Promise((resolve) => {
		const args = ["--base-directory", baseDir, "--type", "f", "--type", "d", "--hidden", "--exclude", ".git"];
		const fd = spawn(fdPath, args, { stdio: ["ignore", "pipe", "ignore"] });
		let stdout = "";
		fd.stdout.setEncoding("utf-8");
		fd.stdout.on("data", (chunk: string) => {
			stdout += chunk;
		});
		fd.on("error", () => resolve(""));
		fd.on("close", () => resolve(stdout));
	});
}

/** Best matches first. The signal kills fzf; an aborted or failed run resolves []. */
export function fzfFilter(fzfPath: string, listing: string, query: string, signal: AbortSignal): Promise<string[]> {
	return new Promise((resolve) => {
		const fzf = spawn(fzfPath, ["--filter", query], { stdio: ["pipe", "pipe", "ignore"], signal });
		let stdout = "";
		fzf.stdout.setEncoding("utf-8");
		fzf.stdout.on("data", (chunk: string) => {
			stdout += chunk;
		});
		fzf.on("error", () => resolve([]));
		fzf.on("close", () => resolve(stdout.split("\n").filter(Boolean).slice(0, MAX_RESULTS)));
		fzf.stdin.on("error", () => {});
		fzf.stdin.end(listing);
	});
}

/**
 * Caches a walk per base directory. A stale listing is served immediately and refreshed in the
 * background; concurrent callers share one in-flight walk.
 */
export function createListingCache(walk: GetListing, ttlMs = LISTING_TTL_MS): GetListing {
	const cache = new Map<string, { listing: string; fetchedAt: number }>();
	const inFlight = new Map<string, Promise<string>>();

	const refresh = (baseDir: string): Promise<string> => {
		const running = inFlight.get(baseDir);
		if (running) return running;

		const started = walk(baseDir)
			.then((listing) => {
				cache.set(baseDir, { listing, fetchedAt: Date.now() });
				return listing;
			})
			.finally(() => inFlight.delete(baseDir));
		inFlight.set(baseDir, started);
		return started;
	};

	return (baseDir) => {
		const cached = cache.get(baseDir);
		if (!cached) return refresh(baseDir);
		if (Date.now() - cached.fetchedAt >= ttlMs) void refresh(baseDir).catch(() => {});
		return Promise.resolve(cached.listing);
	};
}

/** Resolves with the promise's value, or undefined as soon as the signal aborts. */
export function orAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T | undefined> {
	if (signal.aborted) return Promise.resolve(undefined);
	return new Promise((resolve, reject) => {
		const onAbort = () => resolve(undefined);
		signal.addEventListener("abort", onAbort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractAtPrefix(text: string): string | null {
	for (let i = text.length - 1; i >= 0; i--) {
		if (!PATH_DELIMITERS.has(text[i] ?? "")) continue;
		if (text[i + 1] === "@") return text.slice(i + 1);
		return null;
	}
	if (text[0] === "@") return text;
	return null;
}

/** Splits "dir/sub/que" into an existing base directory and the query after the last slash. */
export function resolveScopedQuery(
	rawQuery: string,
	basePath: string,
): { baseDir: string; query: string; displayBase: string } | null {
	const slashIndex = rawQuery.lastIndexOf("/");
	if (slashIndex === -1) return null;

	const displayBase = rawQuery.slice(0, slashIndex + 1);
	const baseDir = displayBase.startsWith("/") ? displayBase : join(basePath, displayBase);
	try {
		if (!statSync(baseDir).isDirectory()) return null;
	} catch {
		return null;
	}

	return { baseDir, query: rawQuery.slice(slashIndex + 1), displayBase };
}

export function toItem(path: string, displayBase = ""): AutocompleteItem {
	const isDirectory = path.endsWith("/");
	const displayPath = displayBase + (isDirectory ? path.slice(0, -1) : path);
	const fullPath = isDirectory ? `${displayPath}/` : displayPath;
	return {
		value: fullPath.includes(" ") ? `@"${fullPath}"` : `@${fullPath}`,
		label: basename(displayPath) + (isDirectory ? "/" : ""),
		description: displayPath,
	};
}

export function createFzfFileProvider(
	builtIn: AutocompleteProvider,
	basePath: string,
	getListing: GetListing,
	filter: FilterListing,
	debounceMs = DEBOUNCE_MS,
): AutocompleteProvider {
	return {
		triggerCharacters: builtIn.triggerCharacters,

		async getSuggestions(lines, cursorLine, cursorCol, options) {
			const textBeforeCursor = (lines[cursorLine] ?? "").slice(0, cursorCol);
			const atPrefix = extractAtPrefix(textBeforeCursor);
			if (!atPrefix) return builtIn.getSuggestions(lines, cursorLine, cursorCol, options);

			const rawQuery = atPrefix.slice(1);
			const scoped = resolveScopedQuery(rawQuery, basePath);
			const query = scoped?.query ?? rawQuery;
			if (!query) return builtIn.getSuggestions(lines, cursorLine, cursorCol, options);

			// Start (or join) the walk before debouncing so it overlaps the wait.
			const walking = getListing(scoped?.baseDir ?? basePath);
			if (!options.force) await orAbort(sleep(debounceMs), options.signal);
			const listing = await orAbort(walking, options.signal);
			if (!listing) return null;

			const matches = await orAbort(filter(listing, query, options.signal), options.signal);
			if (!matches || matches.length === 0) return null;
			return { items: matches.map((path) => toItem(path, scoped?.displayBase)), prefix: atPrefix };
		},

		applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
			return builtIn.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
		},

		shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
			return builtIn.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
		},
	};
}

export default function (pi: ExtensionAPI) {
	const fdPath = which("fd");
	const fzfPath = which("fzf");
	if (!fdPath || !fzfPath) return;

	const getListing = createListingCache((baseDir) => fdWalk(fdPath, baseDir));
	const filter: FilterListing = (listing, query, signal) => fzfFilter(fzfPath, listing, query, signal);

	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.addAutocompleteProvider((builtIn) => createFzfFileProvider(builtIn, ctx.cwd, getListing, filter));
	});
}
