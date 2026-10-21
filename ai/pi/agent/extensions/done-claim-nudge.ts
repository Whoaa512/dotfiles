/**
 * Advisory tripwire for "verify before declaring done". 33 unverified-claim
 * corrections in 30 days (agent said fixed/verified/launched; it wasn't).
 *
 * If a turn ends with a done-claim and no tool call ran during that turn,
 * nudge in the UI and log to the friction ledger (same shape session-memory uses).
 * Never blocks.
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const LEDGER_DIR = join(
	process.env.HOME ?? "",
	"work/cj-private/ai-memory/ledgers",
);

const CLAIM =
	/\b(fixed|now works|works now|passes|passing|verified|all green|is done|launched|triggered|deployed|merged|pushed)\b/i;
const HEDGE =
	/\b(not verified|unverified|can't verify|cannot verify|didn't verify|haven't verified|unable to verify)\b/i;

function sentences(text: string): string[] {
	return text
		.split(/(?<=[.!?])\s+|\n+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export function looksLikeDoneClaim(text: string): string | null {
	if (HEDGE.test(text)) return null;
	for (const s of sentences(text)) {
		if (s.endsWith("?")) continue;
		if (CLAIM.test(s)) return s;
	}
	return null;
}

function getLastAssistantText(ctx: ExtensionContext): string | null {
	const entries = ctx.sessionManager.getBranch();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "message") continue;
		const msg = entry.message;
		if (msg.role !== "assistant") continue;
		const textParts = msg.content.filter((c: any) => c.type === "text");
		if (textParts.length === 0) continue;
		return textParts.map((c: any) => c.text).join("\n");
	}
	return null;
}

function recordFriction(project: string, sample: string): void {
	try {
		if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
		const line = {
			ts: new Date().toISOString(),
			project,
			pattern: "unverified-done-claim",
			count: 1,
			sample: sample.slice(0, 120),
		};
		appendFileSync(
			join(LEDGER_DIR, "friction.jsonl"),
			JSON.stringify(line) + "\n",
		);
	} catch {
		// ledger is best-effort
	}
}

export default function (pi: ExtensionAPI) {
	let toolCalledThisRun = false;

	pi.on("agent_start", async () => {
		toolCalledThisRun = false;
	});
	pi.on("tool_call", async () => {
		toolCalledThisRun = true;
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (toolCalledThisRun) return;
		const text = getLastAssistantText(ctx);
		if (!text) return;
		const claim = looksLikeDoneClaim(text);
		if (!claim) return;

		if (ctx.hasUI)
			ctx.ui.notify(
				"⚠ done-claim without a tool call this turn — verify?",
				"warning",
			);
		recordFriction(basename(ctx.cwd), claim);
	});
}
