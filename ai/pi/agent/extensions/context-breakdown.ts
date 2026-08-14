/**
 * /context — Claude Code-style context window breakdown.
 *
 * Shows where context tokens go: system prompt (incl. context files & skills
 * listing), tool schemas, and conversation messages bucketed by kind, with
 * the largest tool results called out.
 *
 * Token counts are estimates (chars/4) except the header total, which uses
 * pi's real usage-based estimate when available.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const CHARS_PER_TOKEN = 4;
const IMAGE_TOKENS = 1200;
const TOP_TOOL_RESULTS = 5;

export function estTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function fmt(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
	return `${n}`;
}

export function bar(percent: number, width = 20): string {
	const clamped = Math.max(0, Math.min(100, percent));
	const filled = Math.round((clamped / 100) * width);
	return `[${"█".repeat(filled)}${"░".repeat(width - filled)}]`;
}

interface ContentBlock {
	type: string;
	text?: string;
	thinking?: string;
}

export function contentTokens(content: string | ContentBlock[] | undefined): number {
	if (!content) return 0;
	if (typeof content === "string") return estTokens(content);
	let tokens = 0;
	for (const block of content) {
		if (block.type === "text") tokens += estTokens(block.text ?? "");
		else if (block.type === "thinking") tokens += estTokens(block.thinking ?? "");
		else if (block.type === "image") tokens += IMAGE_TOKENS;
	}
	return tokens;
}

export interface ToolResultInfo {
	label: string;
	tokens: number;
}

export interface Breakdown {
	userTokens: number;
	userCount: number;
	assistantTokens: number;
	assistantCount: number;
	toolResultTokens: number;
	toolResultCount: number;
	byTool: Array<{ name: string; tokens: number; count: number }>;
	topResults: ToolResultInfo[];
}

function argHint(args: Record<string, unknown> | undefined): string {
	if (!args) return "";
	const hint = args.path ?? args.command ?? args.pattern ?? args.url ?? "";
	if (typeof hint !== "string" || hint.length === 0) return "";
	const oneLine = hint.split("\n")[0] ?? "";
	return oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine;
}

export function bucketMessages(messages: Array<Record<string, any>>): Breakdown {
	const b: Breakdown = {
		userTokens: 0,
		userCount: 0,
		assistantTokens: 0,
		assistantCount: 0,
		toolResultTokens: 0,
		toolResultCount: 0,
		byTool: [],
		topResults: [],
	};
	const byTool = new Map<string, { tokens: number; count: number }>();
	const callArgs = new Map<string, string>();
	const results: ToolResultInfo[] = [];

	for (const msg of messages) {
		if (msg.role === "user") {
			b.userTokens += contentTokens(msg.content);
			b.userCount++;
		} else if (msg.role === "assistant") {
			let tokens = contentTokens(msg.content);
			if (Array.isArray(msg.content)) {
				for (const block of msg.content) {
					if (block.type === "toolCall") {
						tokens += estTokens(JSON.stringify(block.arguments ?? {}));
						callArgs.set(block.id, argHint(block.arguments));
					}
				}
			}
			b.assistantTokens += tokens;
			b.assistantCount++;
		} else if (msg.role === "toolResult") {
			const tokens = contentTokens(msg.content);
			b.toolResultTokens += tokens;
			b.toolResultCount++;
			const entry = byTool.get(msg.toolName) ?? { tokens: 0, count: 0 };
			entry.tokens += tokens;
			entry.count++;
			byTool.set(msg.toolName, entry);
			const hint = callArgs.get(msg.toolCallId) ?? "";
			results.push({ label: hint ? `${msg.toolName} ${hint}` : msg.toolName, tokens });
		}
	}

	b.byTool = [...byTool.entries()]
		.map(([name, v]) => ({ name, ...v }))
		.sort((a, z) => z.tokens - a.tokens);
	b.topResults = results.sort((a, z) => z.tokens - a.tokens).slice(0, TOP_TOOL_RESULTS);
	return b;
}

interface Line {
	label: string;
	tokens?: number;
	kind: "header" | "section" | "item" | "subitem" | "note";
	suffix?: string;
}

export interface BreakdownData {
	usageTokens: number | null;
	contextWindow: number;
	percent: number | null;
	lines: Line[];
}

export default function (pi: ExtensionAPI) {
	pi.registerEntryRenderer("cj-context", (entry, _options, theme) => {
		const data = entry.data as BreakdownData;
		const out: string[] = [];
		const pct = data.percent;
		const total = data.usageTokens;
		const header =
			total !== null && pct !== null
				? `Context: ${fmt(total)} / ${fmt(data.contextWindow)} (${pct.toFixed(0)}%) ${bar(pct)}`
				: `Context: unknown / ${fmt(data.contextWindow)} (awaiting next LLM response)`;
		out.push(theme.bold(theme.fg("accent", header)));

		for (const line of data.lines) {
			const tok = line.tokens !== undefined ? theme.fg("muted", `~${fmt(line.tokens)}`.padStart(8)) : " ".repeat(8);
			switch (line.kind) {
				case "section":
					out.push(`${tok}  ${theme.bold(line.label)}${line.suffix ? theme.fg("dim", ` ${line.suffix}`) : ""}`);
					break;
				case "item":
					out.push(`${tok}    ${line.label}${line.suffix ? theme.fg("dim", ` ${line.suffix}`) : ""}`);
					break;
				case "subitem":
					out.push(`${tok}      ${theme.fg("dim", line.label)}`);
					break;
				case "note":
					out.push(theme.fg("dim", line.label));
					break;
				default:
					out.push(line.label);
			}
		}
		return new Text(out.join("\n"), 0, 0);
	});

	pi.registerCommand("context", {
		description: "Show context window usage breakdown",
		handler: async (_args, ctx) => {
			const usage = ctx.getContextUsage();
			if (!usage) {
				ctx.ui.notify("No active model / context window info", "warning");
				return;
			}

			const lines: Line[] = [];

			// System prompt (includes context files + skills listing)
			const systemPrompt = ctx.getSystemPrompt();
			const sysTokens = estTokens(systemPrompt);
			const options = ctx.getSystemPromptOptions();
			lines.push({ label: "System prompt", tokens: sysTokens, kind: "section" });

			let accounted = 0;
			for (const file of options.contextFiles ?? []) {
				const tokens = estTokens(file.content);
				accounted += tokens;
				const home = process.env.HOME ?? "";
				const path = home && file.path.startsWith(home) ? `~${file.path.slice(home.length)}` : file.path;
				lines.push({ label: path, tokens, kind: "item" });
			}
			const skills = (options.skills ?? []) as Array<{ name?: string; description?: string }>;
			if (skills.length > 0) {
				const skillTokens = estTokens(skills.map((s) => `${s.name ?? ""}${s.description ?? ""}`).join(""));
				accounted += skillTokens;
				lines.push({ label: "Skills listing", tokens: skillTokens, kind: "item", suffix: `(${skills.length} skills)` });
			}
			lines.push({ label: "Base prompt & guidelines", tokens: Math.max(0, sysTokens - accounted), kind: "item" });

			// Tool schemas (sent separately from the system prompt string)
			const active = new Set(pi.getActiveTools());
			const activeTools = pi.getAllTools().filter((t) => active.has(t.name));
			const toolTokens = activeTools.reduce(
				(sum, t) => sum + estTokens(JSON.stringify({ name: t.name, description: t.description, parameters: t.parameters })),
				0,
			);
			lines.push({ label: "Tool schemas", tokens: toolTokens, kind: "section", suffix: `(${activeTools.length} active tools)` });

			// Conversation
			const { messages } = ctx.sessionManager.buildSessionContext();
			const b = bucketMessages(messages as Array<Record<string, any>>);
			lines.push({
				label: "Tool results",
				tokens: b.toolResultTokens,
				kind: "section",
				suffix: `(${b.toolResultCount} results)`,
			});
			for (const tool of b.byTool.slice(0, 8)) {
				lines.push({ label: tool.name, tokens: tool.tokens, kind: "item", suffix: `×${tool.count}` });
			}
			if (b.topResults.length > 0) {
				lines.push({ label: "largest:", kind: "subitem" });
				for (const r of b.topResults) {
					lines.push({ label: `${r.label}`, tokens: r.tokens, kind: "subitem" });
				}
			}
			lines.push({
				label: "Assistant messages",
				tokens: b.assistantTokens,
				kind: "section",
				suffix: `(×${b.assistantCount}, incl. thinking & tool call args)`,
			});
			lines.push({ label: "User messages", tokens: b.userTokens, kind: "section", suffix: `(×${b.userCount})` });

			const estimatedTotal = sysTokens + toolTokens + b.toolResultTokens + b.assistantTokens + b.userTokens;
			lines.push({
				label: `Estimated sum ~${fmt(estimatedTotal)} (chars/4 heuristic); header total uses provider usage when available.`,
				kind: "note",
			});

			const data: BreakdownData = {
				usageTokens: usage.tokens,
				contextWindow: usage.contextWindow,
				percent: usage.percent,
				lines,
			};
			pi.appendEntry("cj-context", data as unknown as Record<string, unknown>);
		},
	});
}
