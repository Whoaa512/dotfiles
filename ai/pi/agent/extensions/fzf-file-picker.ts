/**
 * fzf File Picker Extension
 *
 * Replaces the built-in @ fuzzy file autocomplete with fd + fzf.
 * Delegates slash commands, tab completion, and applyCompletion to the built-in provider.
 * Handles large repos without the 5000-file cap.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { spawnSync } from "node:child_process";
import { basename, join } from "node:path";
import { statSync } from "node:fs";

const MAX_RESULTS = 20;

function which(bin: string): string | null {
	const cmd = process.platform === "win32" ? "where" : "which";
	const result = spawnSync(cmd, [bin], { encoding: "utf-8" });
	if (result.status !== 0 || !result.stdout) return null;
	return result.stdout.split(/\r?\n/).find(Boolean)?.trim() ?? null;
}

function fdFzf(baseDir: string, query: string, fdPath: string, fzfPath: string): string[] {
	const fdArgs = [
		"--base-directory",
		baseDir,
		"--type",
		"f",
		"--type",
		"d",
		"--full-path",
		"--hidden",
		"--exclude",
		".git",
	];

	const fd = spawnSync(fdPath, fdArgs, {
		encoding: "utf-8",
		stdio: ["pipe", "pipe", "pipe"],
		maxBuffer: 50 * 1024 * 1024,
	});

	if (fd.status !== 0 || !fd.stdout) return [];

	const fzfArgs = ["--filter", query];
	const fzf = spawnSync(fzfPath, fzfArgs, {
		input: fd.stdout,
		encoding: "utf-8",
		stdio: ["pipe", "pipe", "pipe"],
		maxBuffer: 10 * 1024 * 1024,
	});

	if (!fzf.stdout) return [];

	return fzf.stdout
		.trim()
		.split("\n")
		.filter(Boolean)
		.slice(0, MAX_RESULTS);
}

const PATH_DELIMITERS = new Set([" ", "\t", '"', "'", "="]);

function extractAtPrefix(text: string): string | null {
	for (let i = text.length - 1; i >= 0; i--) {
		if (PATH_DELIMITERS.has(text[i] ?? "")) {
			if (text[i + 1] === "@") return text.slice(i + 1);
			return null;
		}
	}
	if (text[0] === "@") return text;
	return null;
}

function resolveScopedQuery(
	rawQuery: string,
	basePath: string,
): { baseDir: string; query: string; displayBase: string } | null {
	const slashIndex = rawQuery.lastIndexOf("/");
	if (slashIndex === -1) return null;

	const displayBase = rawQuery.slice(0, slashIndex + 1);
	const query = rawQuery.slice(slashIndex + 1);

	let baseDir: string;
	if (displayBase.startsWith("/")) {
		baseDir = displayBase;
	} else {
		baseDir = join(basePath, displayBase);
	}

	try {
		if (!statSync(baseDir).isDirectory()) return null;
	} catch {
		return null;
	}

	return { baseDir, query, displayBase };
}

function needsQuotes(path: string): boolean {
	return path.includes(" ");
}

function buildValue(path: string, isDirectory: boolean): string {
	const fullPath = isDirectory ? `${path}/` : path;
	if (needsQuotes(fullPath)) return `@"${fullPath}"`;
	return `@${fullPath}`;
}

export default function (pi: ExtensionAPI) {
	const fdPath = which("fd");
	const fzfPath = which("fzf");

	if (!fdPath || !fzfPath) return;

	pi.on("session_start", async (_event, ctx) => {
		setupProvider(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		setupProvider(ctx);
	});

	function setupProvider(ctx: ExtensionContext) {
		const basePath = ctx.cwd;

		ctx.ui.addAutocompleteProvider((builtIn) => ({
			async getSuggestions(lines, cursorLine, cursorCol, options) {
				const currentLine = lines[cursorLine] || "";
				const textBeforeCursor = currentLine.slice(0, cursorCol);
				const atPrefix = extractAtPrefix(textBeforeCursor);

				if (!atPrefix) {
					return builtIn.getSuggestions(lines, cursorLine, cursorCol, options);
				}

				const rawQuery = atPrefix.slice(1);
				const scoped = resolveScopedQuery(rawQuery, basePath);
				const fdBaseDir = scoped?.baseDir ?? basePath;
				const fzfQuery = scoped?.query ?? rawQuery;

				if (!fzfQuery) {
					return builtIn.getSuggestions(lines, cursorLine, cursorCol, options);
				}

				const paths = fdFzf(fdBaseDir, fzfQuery, fdPath!, fzfPath!);
				if (paths.length === 0) return null;

				const items = paths.map((p) => {
					const isDir = p.endsWith("/");
					const clean = isDir ? p.slice(0, -1) : p;
					const displayPath = scoped ? `${scoped.displayBase}${clean}` : clean;
					return {
						value: buildValue(displayPath, isDir),
						label: basename(clean) + (isDir ? "/" : ""),
						description: displayPath,
					};
				});

				return { items, prefix: atPrefix };
			},

			applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
				return builtIn.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
			},
		}));
	}
}
