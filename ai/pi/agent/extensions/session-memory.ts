import { complete, completeSimple, getModel } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join, basename } from "path";

const MEMORY_DIR = join(process.env.HOME ?? "", "work/cj-private/ai-memory/sessions");
const LEDGER_DIR = join(process.env.HOME ?? "", "work/cj-private/ai-memory/ledgers");
const TRIAGE_SENTINEL = "[triage:ledger-written]";

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

type LedgerExtraction = {
	corrections?: { category?: string; note?: string }[];
	findings?: { finding?: string; verdict?: string; evidence?: string }[];
};

function parseExtraction(raw: string): LedgerExtraction | undefined {
	const match = raw.match(/\{[\s\S]*\}/);
	if (!match) return undefined;
	try {
		return JSON.parse(match[0]) as LedgerExtraction;
	} catch {
		return undefined;
	}
}

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

type ModelRegistryLike = {
	find: (provider: string, modelId: string) => Parameters<typeof completeSimple>[0] | undefined;
	getApiKeyForProvider: (p: string) => Promise<string | undefined>;
};

async function extractLedgerEntries(
	ctx: { modelRegistry: ModelRegistryLike },
	project: string,
	text: string,
): Promise<void> {
	const model = ctx.modelRegistry.find("openai-codex", "gpt-5.6-luna");
	if (!model) return;
	const apiKey = await ctx.modelRegistry.getApiKeyForProvider(model.provider).catch(() => undefined);
	if (!apiKey) return;

	const skipFindings = text.includes(TRIAGE_SENTINEL);

	const response = await completeSimple(
		model,
		{
			messages: [
				{
					role: "user" as const,
					content: [
						{
							type: "text" as const,
							text: [
								"Analyze this AI coding-agent session transcript. Extract two things:",
								"",
								"1. CORRECTIONS: moments where the USER corrected the agent's behavior or approach",
								"   (wrong branch/stack placement, claiming done without verifying, scope creep,",
								"   over-engineering, lazy/shallow work, editing the wrong source of truth,",
								"   voice/style rejections, misusing a tool). Only genuine steering corrections \u2014",
								"   NOT design decisions, preferences stated up front, or normal iteration.",
								`   category must be one of: ${CORRECTION_CATEGORIES.join(" | ")}`,
								skipFindings
									? "2. FINDINGS: skip \u2014 return an empty array (already recorded by /triage)."
									: '2. FINDINGS: verdicts on review findings \u2014 anywhere a finding/issue from a review was adjudicated ("is this legit?", "do you concur?"). verdict must be one of: confirmed | disproven | pre-existing | speculative. evidence = the concrete reason.',
								"",
								'Output ONLY JSON: {"corrections": [{"category": "...", "note": "..."}], "findings": [{"finding": "...", "verdict": "...", "evidence": "..."}]}',
								"Empty arrays when nothing qualifies. Be conservative: prefer empty over speculative entries.",
								"",
								"<conversation>",
								text.slice(0, 60000),
								"</conversation>",
							].join("\n"),
						},
					],
					timestamp: Date.now(),
				},
			],
		},
		{ apiKey, reasoning: "high" },
	);

	const raw = response.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("\n");
	const extraction = parseExtraction(raw);
	if (!extraction) return;

	if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
	const ts = new Date().toISOString();

	for (const c of extraction.corrections ?? []) {
		if (!c?.note) continue;
		const category = CORRECTION_CATEGORIES.includes(c.category as (typeof CORRECTION_CATEGORIES)[number])
			? c.category
			: "other";
		appendFileSync(join(LEDGER_DIR, "corrections.jsonl"), JSON.stringify({ ts, project, category, note: c.note }) + "\n");
	}
	for (const f of extraction.findings ?? []) {
		if (!f?.finding || !f?.verdict) continue;
		appendFileSync(
			join(LEDGER_DIR, "findings.jsonl"),
			JSON.stringify({ ts, project, source: "session-extract", finding: f.finding, verdict: f.verdict, evidence: f.evidence ?? "" }) + "\n",
		);
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
		const branch = ctx.sessionManager.getBranch();
		const { text, toolCount, messageCount } = buildConversation(branch as SessionEntry[]);

		if (messageCount < 2) return;

		const project = basename(ctx.cwd);
		const time = timestamp();

		if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });

		const filePath = join(MEMORY_DIR, todayFile());
		const isNewFile = !existsSync(filePath);

		let summary: string;

		const model = getModel("openai", "gpt-4.1-mini");
		const apiKey = model ? await ctx.modelRegistry.getApiKeyForProvider(model.provider).catch(() => undefined) : undefined;

		if (model && apiKey && text.length > 100) {
			try {
				const response = await complete(
					model,
					{
						messages: [
							{
								role: "user" as const,
								content: [
									{
										type: "text" as const,
										text: [
											"Summarize this AI agent session in 2-3 lines. Include: what was done, key decisions made (with WHY), and any open items.",
											"Be terse. No preamble.",
											"",
											`Project: ${project}`,
											`Tool calls: ${toolCount}`,
											"",
											"<conversation>",
											text.slice(0, 8000),
											"</conversation>",
										].join("\n"),
									},
								],
								timestamp: Date.now(),
							},
						],
					},
					{ apiKey },
				);

				summary = response.content
					.filter((c): c is { type: "text"; text: string } => c.type === "text")
					.map((c) => c.text)
					.join("\n")
					.trim();
			} catch {
				summary = `${messageCount} messages, ${toolCount} tool calls`;
			}
		} else {
			summary = `${messageCount} messages, ${toolCount} tool calls`;
		}

		const header = isNewFile ? `# Sessions — ${new Date().toISOString().split("T")[0]}\n\n` : "";
		const entry = `${header}## ${time} | ${project}\n${summary}\n\n`;

		appendFileSync(filePath, entry);

		try {
			recordFriction(project, branch as SessionEntry[]);
		} catch {}

		if (text.length > 200) {
			await extractLedgerEntries(ctx, project, text).catch(() => {});
		}
	});
}
