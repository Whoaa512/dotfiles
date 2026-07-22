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

		if (text.length > 200) {
			await extractLedgerEntries(ctx, project, text).catch(() => {});
		}
	});
}
