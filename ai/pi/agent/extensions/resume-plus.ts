/**
 * Resume Plus — better session resume picker.
 *
 * /rr           - fuzzy-search picker over ALL messages in project sessions
 *                 (not just the first message). While searching, each row
 *                 shows the most relevant matching message. Tab cycles the
 *                 search scope: both / user / agent.
 * /rr-title-all - backfill LLM titles for unnamed sessions (cache only)
 *
 * Auto-titling: after the first agent turn, if the session is unnamed and a
 * title model is configured, generates a short session name via that model.
 * Off by default. Enable in settings.json:
 *
 *   { "extension-settings": { "resume-plus": { "titleModel": "provider/model-id" } } }
 *
 * Corpus cache: ~/.pi/agent/resume-plus/<project-dir>.json, keyed by session
 * file mtime+size (sessions are append-only, so this is reliable). Only
 * changed files are re-parsed on picker open.
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import {
	Container,
	Input,
	Text,
	fuzzyMatch,
	matchesKey,
	Key,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";

const CACHE_DIR = join(homedir(), ".pi", "agent", "resume-plus");
const SESSIONS_ROOT = join(homedir(), ".pi", "agent", "sessions");
const MSG_CAP = 1500; // chars of each message kept in the corpus
const LIST_HEIGHT = 15;

type Msg = { r: "u" | "a"; t: string };

type SessEntry = {
	path: string;
	mtimeMs: number;
	size: number;
	name?: string;
	first: string;
	modified: number;
	msgCount: number;
	msgs: Msg[];
};

type Cache = {
	version: 1;
	sessions: Record<string, SessEntry>;
	titles: Record<string, string>;
};

type Scope = "both" | "user" | "agent";

// ---------- corpus ----------

function cachePath(sessionDir: string): string {
	return join(CACHE_DIR, `${basename(sessionDir)}.json`);
}

function loadCache(sessionDir: string): Cache {
	try {
		const c = JSON.parse(readFileSync(cachePath(sessionDir), "utf-8"));
		if (c?.version === 1) return c;
	} catch {}
	return { version: 1, sessions: {}, titles: {} };
}

function saveCache(sessionDir: string, cache: Cache) {
	try {
		mkdirSync(CACHE_DIR, { recursive: true });
		writeFileSync(cachePath(sessionDir), JSON.stringify(cache));
	} catch {}
}

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		const parts: string[] = [];
		for (const p of content) {
			if (p?.type === "text" && typeof p.text === "string") parts.push(p.text);
		}
		return parts.join("\n");
	}
	return "";
}

function oneLine(s: string, cap = MSG_CAP): string {
	return s.replace(/\s+/g, " ").trim().slice(0, cap);
}

function parseSession(path: string): SessEntry | null {
	let st;
	try {
		st = statSync(path);
	} catch {
		return null;
	}
	const entry: SessEntry = {
		path,
		mtimeMs: st.mtimeMs,
		size: st.size,
		first: "",
		modified: st.mtimeMs,
		msgCount: 0,
		msgs: [],
	};
	let text: string;
	try {
		text = readFileSync(path, "utf-8");
	} catch {
		return null;
	}
	for (const line of text.split("\n")) {
		if (!line) continue;
		let e: any;
		try {
			e = JSON.parse(line);
		} catch {
			continue;
		}
		if (e.type === "session_info") {
			entry.name = typeof e.name === "string" && e.name.trim() ? e.name.trim() : undefined;
			continue;
		}
		if (e.type !== "message") continue;
		const role = e.message?.role;
		if (role !== "user" && role !== "assistant") continue;
		const t = oneLine(extractText(e.message.content));
		if (!t) continue;
		entry.msgCount++;
		entry.msgs.push({ r: role === "user" ? "u" : "a", t });
		if (!entry.first && role === "user") entry.first = t.slice(0, 200);
	}
	if (entry.msgs.length === 0) return null;
	return entry;
}

/** Load corpus, re-parsing only files whose mtime/size changed. */
function loadCorpus(sessionDir: string): { sessions: SessEntry[]; cache: Cache } {
	const cache = loadCache(sessionDir);
	let files: string[] = [];
	try {
		files = readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl"));
	} catch {}

	const seen = new Set<string>();
	let dirty = false;

	for (const f of files) {
		const path = join(sessionDir, f);
		seen.add(path);
		const cached = cache.sessions[path];
		let st;
		try {
			st = statSync(path);
		} catch {
			continue;
		}
		if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) continue;
		const parsed = parseSession(path);
		if (parsed) cache.sessions[path] = parsed;
		else delete cache.sessions[path];
		dirty = true;
	}
	for (const path of Object.keys(cache.sessions)) {
		if (!seen.has(path)) {
			delete cache.sessions[path];
			delete cache.titles[path];
			dirty = true;
		}
	}
	if (dirty) saveCache(sessionDir, cache);

	const sessions = Object.values(cache.sessions).sort((a, b) => b.modified - a.modified);
	return { sessions, cache };
}

// ---------- search ----------

type Hit = {
	sess: SessEntry;
	score: number;
	bestMsg: Msg | null;
};

function tokenize(query: string): string[] {
	return query.trim().split(/\s+/).filter(Boolean);
}

/** All tokens must appear as case-insensitive substrings. Lower score = terms appear earlier/denser. */
function matchTokensSubstring(tokens: string[], textLower: string): number | null {
	let total = 0;
	for (const tok of tokens) {
		const idx = textLower.indexOf(tok);
		if (idx === -1) return null;
		total += idx;
	}
	return total;
}

function matchTokensFuzzy(tokens: string[], text: string): number | null {
	let total = 0;
	for (const tok of tokens) {
		const m = fuzzyMatch(tok, text);
		if (!m.matches) return null;
		total += m.score;
	}
	return total;
}

function search(sessions: SessEntry[], query: string, scope: Scope, titles: Record<string, string>): Hit[] {
	const tokens = tokenize(query).map((t) => t.toLowerCase());
	if (tokens.length === 0) {
		return sessions.map((sess) => ({ sess, score: 0, bestMsg: null }));
	}

	const hits: Hit[] = [];
	for (const sess of sessions) {
		let best: number | null = null;
		let bestMsg: Msg | null = null;

		for (const msg of sess.msgs) {
			if (scope === "user" && msg.r !== "u") continue;
			if (scope === "agent" && msg.r !== "a") continue;
			const score = matchTokensSubstring(tokens, msg.t.toLowerCase());
			if (score !== null && (best === null || score < best)) {
				best = score;
				bestMsg = msg;
			}
		}

		// title/name matches too (fuzzy is fine on short titles), regardless of scope
		let titleMatch = false;
		const title = titles[sess.path] ?? sess.name;
		if (title && matchTokensFuzzy(tokens, title) !== null) {
			titleMatch = true;
			if (best === null) best = 0;
		}

		if (best !== null) hits.push({ sess, score: titleMatch ? -1 : best, bestMsg });
	}
	// title matches first, then most recent
	hits.sort((a, b) => (a.score < 0 ? -1 : 0) - (b.score < 0 ? -1 : 0) || b.sess.modified - a.sess.modified);
	return hits;
}

// ---------- title generation ----------

function getTitleModel(pi: ExtensionAPI): { provider: string; id: string } | null {
	const settings = pi.getSettings("resume-plus");
	const raw = settings?.titleModel;
	if (typeof raw !== "string" || !raw.includes("/")) return null;
	const idx = raw.indexOf("/");
	return { provider: raw.slice(0, idx), id: raw.slice(idx + 1) };
}

async function generateTitle(
	ctx: ExtensionCommandContext,
	modelRef: { provider: string; id: string },
	convoSample: string,
): Promise<string | null> {
	const model = ctx.modelRegistry.find(modelRef.provider, modelRef.id);
	if (!model || !ctx.modelRegistry.hasConfiguredAuth(model)) return null;
	try {
		const response = await ctx.modelRegistry.complete(
			model,
			{
				messages: [
					{
						role: "user" as const,
						content: [
							{
								type: "text" as const,
								text: `Write a session title for this coding-agent conversation. 4-8 words, no quotes, no trailing punctuation, describe the task/topic. Output ONLY the title.\n\n${convoSample.slice(0, 2000)}`,
							},
						],
						timestamp: Date.now(),
					},
				],
			},
			{ cacheRetention: "none" },
		);
		const title = response.content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map((c) => c.text)
			.join(" ")
			.replace(/^["'\s]+|["'\s.]+$/g, "")
			.replace(/\s+/g, " ");
		if (!title || title.length > 100) return null;
		return title;
	} catch {
		return null;
	}
}

// ---------- picker UI ----------

function timeAgo(ms: number): string {
	const s = Math.floor((Date.now() - ms) / 1000);
	if (s < 60) return `${s}s`;
	if (s < 3600) return `${Math.floor(s / 60)}m`;
	if (s < 86400) return `${Math.floor(s / 3600)}h`;
	return `${Math.floor(s / 86400)}d`;
}

/** Session dir for the project, even in ephemeral (--no-session) mode. */
function resolveSessionDir(ctx: ExtensionCommandContext): string {
	const dir = ctx.sessionManager.getSessionDir();
	try {
		if (dir && statSync(dir).isDirectory()) return dir;
	} catch {}
	const safePath = `--${ctx.cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
	return join(SESSIONS_ROOT, safePath);
}

async function openPicker(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
	const sessionDir = resolveSessionDir(ctx);
	const { sessions, cache } = loadCorpus(sessionDir);
	if (sessions.length === 0) {
		ctx.ui.notify("No sessions found", "warning");
		return;
	}
	const currentFile = ctx.sessionManager.getSessionFile();

	const selected = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		const input = new Input();
		let scope: Scope = "both";
		let hits = search(sessions, "", scope, cache.titles);
		let selectedIdx = 0;
		let scrollTop = 0;

		const refresh = () => {
			hits = search(sessions, input.getValue(), scope, cache.titles);
			selectedIdx = Math.min(selectedIdx, Math.max(0, hits.length - 1));
			scrollTop = 0;
		};

		const component = {
			focused: false,
			handleInput(data: string) {
				if (matchesKey(data, Key.escape)) return done(null);
				if (matchesKey(data, Key.enter)) {
					return done(hits[selectedIdx]?.sess.path ?? null);
				}
				if (matchesKey(data, Key.tab)) {
					scope = scope === "both" ? "user" : scope === "user" ? "agent" : "both";
					refresh();
					tui.requestRender();
					return;
				}
				if (matchesKey(data, Key.up)) {
					selectedIdx = Math.max(0, selectedIdx - 1);
					tui.requestRender();
					return;
				}
				if (matchesKey(data, Key.down)) {
					selectedIdx = Math.min(hits.length - 1, selectedIdx + 1);
					tui.requestRender();
					return;
				}
				const before = input.getValue();
				input.handleInput(data);
				if (input.getValue() !== before) {
					selectedIdx = 0;
					refresh();
				}
				tui.requestRender();
			},
			render(width: number): string[] {
				const lines: string[] = [];
				const border = new DynamicBorder((s: string) => theme.fg("accent", s));
				lines.push(...border.render(width));

				const scopeLabel =
					scope === "both" ? "user+agent" : scope === "user" ? "user only" : "agent only";
				const header = theme.fg("accent", " resume+ ") + theme.fg("dim", `[${scopeLabel}] ${hits.length}/${sessions.length}`);
				lines.push(truncateToWidth(header, width));

				component.focused = true;
				input.focused = true;
				for (const l of input.render(width - 2)) lines.push(truncateToWidth(` ${l}`, width));

				// keep selection visible
				if (selectedIdx < scrollTop) scrollTop = selectedIdx;
				if (selectedIdx >= scrollTop + LIST_HEIGHT) scrollTop = selectedIdx - LIST_HEIGHT + 1;

				const visible = hits.slice(scrollTop, scrollTop + LIST_HEIGHT);
				const searching = tokenize(input.getValue()).length > 0;

				for (let i = 0; i < visible.length; i++) {
					const hit = visible[i]!;
					const isSel = scrollTop + i === selectedIdx;
					const sess = hit.sess;
					const title = cache.titles[sess.path] ?? sess.name;
					const isCurrent = sess.path === currentFile;

					const prefix = isSel ? theme.fg("accent", "❯ ") : "  ";
					const meta = theme.fg("dim", ` ${timeAgo(sess.modified)} ·${sess.msgCount}${isCurrent ? " ·current" : ""}`);
					const titleText = title
						? (isSel ? theme.fg("accent", title) : theme.fg("text", title))
						: theme.fg(isSel ? "accent" : "muted", sess.first || "(empty)");
					let line1 = prefix + titleText + meta;
					lines.push(truncateToWidth(line1, width));

					// snippet line: best matching message while searching, else first message (when titled)
					let snippet = "";
					if (searching && hit.bestMsg) {
						snippet = `${hit.bestMsg.r === "u" ? "user:" : "agent:"} ${hit.bestMsg.t}`;
					} else if (title && sess.first) {
						snippet = sess.first;
					}
					if (snippet) {
						lines.push(truncateToWidth(`    ${theme.fg("dim", oneLine(snippet, 300))}`, width));
					}
				}
				if (hits.length === 0) {
					lines.push(theme.fg("warning", "  no matches"));
				}

				lines.push(
					truncateToWidth(
						theme.fg("dim", " ↑↓ move · enter open · tab scope · esc cancel"),
						width,
					),
				);
				lines.push(...border.render(width));
				return lines;
			},
			invalidate() {},
		};
		return component;
	});

	if (!selected) return;
	if (selected === currentFile) {
		ctx.ui.notify("Already in that session", "info");
		return;
	}
	const result = await ctx.switchSession(selected);
	if (result.cancelled) ctx.ui.notify("Session switch cancelled", "warning");
}

// ---------- extension ----------

export default function (pi: ExtensionAPI) {
	let autoTitleAttempted = false;

	pi.registerCommand("rr", {
		description: "Resume picker with fuzzy search across all messages",
		handler: async (_args, ctx) => {
			await openPicker(pi, ctx);
		},
	});

	pi.registerCommand("rr-title-all", {
		description: "Backfill LLM titles for unnamed sessions (resume-plus cache)",
		handler: async (_args, ctx) => {
			const modelRef = getTitleModel(pi);
			if (!modelRef) {
				ctx.ui.notify("No titleModel configured for resume-plus (settings.json)", "warning");
				return;
			}
			const sessionDir = resolveSessionDir(ctx);
			const { sessions, cache } = loadCorpus(sessionDir);
			const pending = sessions.filter((s) => !s.name && !cache.titles[s.path]);
			if (pending.length === 0) {
				ctx.ui.notify("All sessions already titled", "info");
				return;
			}
			ctx.ui.notify(`Titling ${pending.length} sessions...`, "info");
			let ok = 0;
			const CONCURRENCY = 5;
			for (let i = 0; i < pending.length; i += CONCURRENCY) {
				const batch = pending.slice(i, i + CONCURRENCY);
				await Promise.all(
					batch.map(async (sess) => {
						const sample = sess.msgs
							.slice(0, 6)
							.map((m) => `${m.r === "u" ? "USER" : "AGENT"}: ${m.t.slice(0, 300)}`)
							.join("\n");
						const title = await generateTitle(ctx, modelRef, sample);
						if (title) {
							cache.titles[sess.path] = title;
							ok++;
						}
					}),
				);
				saveCache(sessionDir, cache);
				ctx.ui.setStatus("resume-plus", `titling ${Math.min(i + CONCURRENCY, pending.length)}/${pending.length}`);
			}
			ctx.ui.setStatus("resume-plus", undefined);
			ctx.ui.notify(`Titled ${ok}/${pending.length} sessions`, ok > 0 ? "info" : "warning");
		},
	});

	pi.on("session_start", async () => {
		autoTitleAttempted = false;
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (autoTitleAttempted) return;
		autoTitleAttempted = true;
		if (pi.getSessionName()) return;
		const modelRef = getTitleModel(pi);
		if (!modelRef) return;

		const entries = ctx.sessionManager.getBranch();
		const parts: string[] = [];
		for (const entry of entries) {
			if (entry.type !== "message") continue;
			const role = (entry as any).message?.role;
			if (role !== "user" && role !== "assistant") continue;
			const t = oneLine(extractText((entry as any).message.content), 300);
			if (t) parts.push(`${role === "user" ? "USER" : "AGENT"}: ${t}`);
			if (parts.length >= 4) break;
		}
		if (parts.length === 0) return;

		const title = await generateTitle(ctx as ExtensionCommandContext, modelRef, parts.join("\n"));
		if (title && !pi.getSessionName()) {
			pi.setSessionName(title);
		}
	});
}
