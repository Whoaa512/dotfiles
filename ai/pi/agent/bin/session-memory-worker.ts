// Detached worker for session-memory.ts. Runs after pi has exited so
// shutdown is instant. Usage: bun session-memory-worker.ts <job.json>
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

type Job = {
	project: string;
	time: string;
	text: string;
	toolCount: number;
	messageCount: number;
	filePath: string;
	isNewFile: boolean;
	ledgerDir: string;
	model: string;
	mainModel?: string;
	skipFindings: boolean;
	categories: string[];
};

const jobPath = process.argv[2];
const job = JSON.parse(readFileSync(jobPath, "utf8")) as Job;
unlinkSync(jobPath);

function ask(prompt: string, thinking: string): string | undefined {
	const r = spawnSync("pi", ["-p", "--no-extensions", "--no-session", "--model", job.model, "--thinking", thinking, prompt], {
		encoding: "utf8",
		timeout: 180_000,
		env: { ...process.env, PI_SESSION_MEMORY_WORKER: "1" },
	});
	if (r.status !== 0) return undefined;
	return r.stdout.trim();
}

let summary = `${job.messageCount} messages, ${job.toolCount} tool calls`;
if (job.text.length > 100) {
	const out = ask(
		[
			"Summarize this AI agent session in 2-3 lines. Include: what was done, key decisions made (with WHY), and any open items.",
			"Be terse. No preamble.",
			"",
			`Project: ${job.project}`,
			`Tool calls: ${job.toolCount}`,
			"",
			"<conversation>",
			job.text.slice(0, 8000),
			"</conversation>",
		].join("\n"),
		"low",
	);
	if (out) summary = out;
}

const header = job.isNewFile && !existsSync(job.filePath) ? `# Sessions — ${new Date().toISOString().split("T")[0]}\n\n` : "";
appendFileSync(job.filePath, `${header}## ${job.time} | ${job.project}\n${summary}\n\n`);

if (job.text.length <= 200) process.exit(0);

const raw = ask(
	[
		"Analyze this AI coding-agent session transcript. Extract two things:",
		"",
		"1. CORRECTIONS: moments where the USER corrected the agent's behavior or approach",
		"   (wrong branch/stack placement, claiming done without verifying, scope creep,",
		"   over-engineering, lazy/shallow work, editing the wrong source of truth,",
		"   voice/style rejections, misusing a tool). Only genuine steering corrections \u2014",
		"   NOT design decisions, preferences stated up front, or normal iteration.",
		`   category must be one of: ${job.categories.join(" | ")}`,
		job.skipFindings
			? "2. FINDINGS: skip \u2014 return an empty array (already recorded by /triage)."
			: '2. FINDINGS: verdicts on review findings \u2014 anywhere a finding/issue from a review was adjudicated ("is this legit?", "do you concur?"). verdict must be one of: confirmed | disproven | pre-existing | speculative. evidence = the concrete reason. reviewer = who produced the finding: a model id (e.g. "openai-codex/gpt-6.1-sol", "anthropic/claude-fable-5-1"), a bot ("svc-airchat-review"), a person ("human:<name>"), or "self" when the main-thread assistant raised it. Infer from subagent `model:` options, "reviewer A/B" labels, bot comment authors, or relays like "sol said" / "astra says". Use "unknown" if not inferable.',
		"",
		'Output ONLY JSON: {"corrections": [{"category": "...", "note": "..."}], "findings": [{"finding": "...", "verdict": "...", "evidence": "...", "reviewer": "..."}]}',
		"Empty arrays when nothing qualifies. Be conservative: prefer empty over speculative entries.",
		"",
		"<conversation>",
		job.text.slice(0, 60000),
		"</conversation>",
	].join("\n"),
	"high",
);
const match = raw?.match(/\{[\s\S]*\}/);
if (!match) process.exit(0);
let extraction: { corrections?: { category?: string; note?: string }[]; findings?: { finding?: string; verdict?: string; evidence?: string; reviewer?: string }[] };
try {
	extraction = JSON.parse(match[0]);
} catch {
	process.exit(0);
}

if (!existsSync(job.ledgerDir)) mkdirSync(job.ledgerDir, { recursive: true });
const ts = new Date().toISOString();
for (const c of extraction.corrections ?? []) {
	if (!c?.note) continue;
	const category = job.categories.includes(c.category ?? "") ? c.category : "other";
	appendFileSync(join(job.ledgerDir, "corrections.jsonl"), JSON.stringify({ ts, project: job.project, category, note: c.note }) + "\n");
}
function resolveReviewer(raw: string | undefined): string {
	const r = raw?.trim();
	if (!r) return "unknown";
	if (r === "self") return `self:${job.mainModel ?? "unknown"}`;
	return r;
}

for (const f of extraction.findings ?? []) {
	if (!f?.finding || !f?.verdict) continue;
	appendFileSync(
		join(job.ledgerDir, "findings.jsonl"),
		JSON.stringify({
			ts,
			project: job.project,
			source: "session-extract",
			finding: f.finding,
			verdict: f.verdict,
			evidence: f.evidence ?? "",
			reviewer: resolveReviewer(f.reviewer),
		}) + "\n",
	);
}
