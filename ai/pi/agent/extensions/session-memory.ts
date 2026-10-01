import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, appendFileSync, writeFileSync, openSync, realpathSync } from "fs";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";

const MEMORY_DIR = join(process.env.HOME ?? "", "work/cj-private/ai-memory/sessions");
const LEDGER_DIR = join(process.env.HOME ?? "", "work/cj-private/ai-memory/ledgers");
const TRIAGE_SENTINEL = "[triage:ledger-written]";
const WORKER = join(dirname(realpathSync(fileURLToPath(import.meta.url))), "..", "bin", "session-memory-worker.ts");
const MODEL = "openai-codex/gpt-5.6-luna";

const CORRECTION_CATEGORIES = [
	"wrong-branch",
	"unverified-claim",
	"scope-creep",
	"over-engineering",
	"lazy-work",
	"wrong-source-of-truth",
	"style-voice",
	"tool-misuse",
	"other",
] as const;

type ToolCallRec = { name: string; key: string; error: boolean };

function collectToolCalls(entries: SessionEntry[]): ToolCallRec[] {
	const errorIds = new Set<string>();
	for (const e of entries) {
		const m = e.message as { role?: string; toolCallId?: string; isError?: boolean } | undefined;
		if (e.type === "message" && m?.role === "toolResult" && m.isError && m.toolCallId) {
			errorIds.add(m.toolCallId);
		}
	}
	const calls: ToolCallRec[] = [];
	for (const e of entries) {
		if (e.type !== "message" || e.message?.role !== "assistant") continue;
		const content = e.message.content;
		if (!Array.isArray(content)) continue;
		for (const c of content as { type?: string; id?: string; name?: string; arguments?: Record<string, unknown> }[]) {
			if (c?.type !== "toolCall" || !c.name) continue;
			const args = c.arguments ?? {};
			const key =
				typeof args.path === "string" ? args.path : typeof args.command === "string" ? args.command.trim().slice(0, 200) : "";
			calls.push({ name: c.name, key, error: !!(c.id && errorIds.has(c.id)) });
		}
	}
	return calls;
}

function detectFriction(calls: ToolCallRec[]): { pattern: string; count: number; sample: string }[] {
	const out: { pattern: string; count: number; sample: string }[] = [];
	const tally = (filter: (c: ToolCallRec) => boolean) => {
		const m = new Map<string, number>();
		for (const c of calls) if (filter(c) && c.key) m.set(c.key, (m.get(c.key) ?? 0) + 1);
		return m;
	};

	for (const [key, n] of tally((c) => c.name === "edit" && c.error)) {
		if (n >= 3) out.push({ pattern: "edit-thrash", count: n, sample: key });
	}
	for (const [key, n] of tally((c) => c.name === "read")) {
		if (n >= 4) out.push({ pattern: "reread-churn", count: n, sample: key });
	}
	for (const [key, n] of tally((c) => c.name === "bash" && c.error)) {
		if (n >= 3) out.push({ pattern: "bash-flail", count: n, sample: key });
	}
	for (const [key, n] of tally((c) => c.name === "bash" && !c.error)) {
		if (n >= 6) out.push({ pattern: "repeated-command", count: n, sample: key });
	}
	const deadSubagents = calls.filter((c) => c.name === "subagent" && c.error).length;
	if (deadSubagents >= 2) out.push({ pattern: "dead-subagents", count: deadSubagents, sample: "" });
	return out;
}

function recordFriction(project: string, entries: SessionEntry[]): void {
	const friction = detectFriction(collectToolCalls(entries));
	if (friction.length === 0) return;
	if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
	const ts = new Date().toISOString();
	for (const f of friction) {
		appendFileSync(join(LEDGER_DIR, "friction.jsonl"), JSON.stringify({ ts, project, ...f }) + "\n");
	}
}

type ContentBlock = { type?: string; text?: string; name?: string; arguments?: Record<string, unknown> };
type SessionEntry = { type: string; message?: { role?: string; content?: unknown } };

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((c): c is ContentBlock => c?.type === "text" && typeof c?.text === "string")
		.map((c) => c.text!)
		.join("\n");
}

function extractToolCalls(content: unknown): string[] {
	if (!Array.isArray(content)) return [];
	return content
		.filter((c): c is ContentBlock => c?.type === "toolCall" && typeof c?.name === "string")
		.map((c) => c.name!);
}

function buildConversation(entries: SessionEntry[]): { text: string; toolCount: number; messageCount: number } {
	const sections: string[] = [];
	let toolCount = 0;
	let messageCount = 0;

	for (const entry of entries) {
		if (entry.type !== "message" || !entry.message?.role) continue;
		const { role, content } = entry.message;
		if (role !== "user" && role !== "assistant") continue;

		messageCount++;
		const text = extractText(content).trim();
		if (text) sections.push(`${role === "user" ? "User" : "Assistant"}: ${text}`);

		if (role === "assistant") {
			const tools = extractToolCalls(content);
			toolCount += tools.length;
		}
	}

	return { text: sections.join("\n\n"), toolCount, messageCount };
}

function todayFile(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.md`;
}

function timestamp(): string {
	return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
}


export default function (pi: ExtensionAPI) {
	pi.on("session_shutdown", async (_event, ctx) => {
		if (process.env.PI_SESSION_MEMORY_WORKER) return;
		const branch = ctx.sessionManager.getBranch();
		const { text, toolCount, messageCount } = buildConversation(branch as SessionEntry[]);

		if (messageCount < 2) return;

		const project = basename(ctx.cwd);

		try {
			recordFriction(project, branch as SessionEntry[]);
		} catch {}

		if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
		const filePath = join(MEMORY_DIR, todayFile());

		const jobPath = join(tmpdir(), `pi-session-memory-${process.pid}-${Date.now()}.json`);
		writeFileSync(
			jobPath,
			JSON.stringify({
				project,
				time: timestamp(),
				text,
				toolCount,
				messageCount,
				filePath,
				isNewFile: !existsSync(filePath),
				ledgerDir: LEDGER_DIR,
				model: MODEL,
				skipFindings: text.includes(TRIAGE_SENTINEL),
				categories: CORRECTION_CATEGORIES,
			}),
		);

		const log = openSync(join(tmpdir(), "pi-session-memory.log"), "a");
		const child = spawn("bun", [WORKER, jobPath], { detached: true, stdio: ["ignore", log, log] });
		child.unref();
	});
}
