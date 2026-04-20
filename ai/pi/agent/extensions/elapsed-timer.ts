/**
 * Elapsed Timer Extension
 *
 * Shows elapsed time since the user sent a message while the model is working.
 * Displays a live ticking timer in the status bar during agent execution,
 * then shows the final elapsed time when done.
 *
 * On completion, classifies whether the agent needs user input (same heuristic
 * as speak.ts) and shows ✓ (done, no input needed) or ❓ (needs your input).
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

function formatElapsed(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

const STATUS_KEY = "elapsed-timer";
const PAUSE_TOOLS = new Set(["question", "questionnaire"]);

function baseTitle(ctx: ExtensionContext): string {
	const cwd = path.basename(ctx.cwd);
	const session = ctx.sessionManager.getSessionName();
	return session ? `π - ${session} - ${cwd}` : `π - ${cwd}`;
}

function setTabTitle(ctx: ExtensionContext, title: string) {
	ctx.ui.setTitle(title);
	process.title = title;
}

// ---------------------------------------------------------------------------
// Classify: does the last assistant message need user input?
// Reuses the same config resolution as speak.ts
// ---------------------------------------------------------------------------

type ClassifyConfig = { baseUrl: string; apiKey: string; model: string; headers?: Record<string, string> };
let classifyConfigCache: ClassifyConfig | null | undefined;

function resolveConfigValue(config: string): string | undefined {
	if (config.startsWith("!")) {
		try {
			return execSync(config.slice(1), { encoding: "utf-8", timeout: 10000, stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
		} catch { return undefined; }
	}
	return process.env[config] || config;
}

function loadClassifyConfig(): ClassifyConfig | null {
	if (classifyConfigCache !== undefined) return classifyConfigCache;

	const modelsPath = join(process.env.HOME!, ".pi", "agent", "models.json");
	let modelsJson: any = null;
	if (existsSync(modelsPath)) {
		try { modelsJson = JSON.parse(readFileSync(modelsPath, "utf-8")); } catch {}
	}

	const configStr = process.env.PI_CLASSIFY_MODEL
		?? modelsJson?.defaults?.classifyModel
		?? "devai/gpt-5-nano";

	let providerName: string;
	let modelId: string;
	if (configStr.includes("/")) {
		[providerName, modelId] = configStr.split("/", 2);
	} else {
		providerName = "devai";
		modelId = configStr;
	}

	if (!modelsJson?.providers?.[providerName]) {
		const apiKey = process.env.OPENROUTER_API_KEY;
		if (!apiKey) { classifyConfigCache = null; return null; }
		classifyConfigCache = { baseUrl: "https://openrouter.ai/api/v1", apiKey, model: `openai/${modelId}` };
		return classifyConfigCache;
	}

	try {
		const provider = modelsJson.providers[providerName];
		const resolvedKey = resolveConfigValue(provider.apiKey);
		if (!resolvedKey) { classifyConfigCache = null; return null; }

		const resolvedHeaders: Record<string, string> = {};
		if (provider.headers) {
			for (const [k, v] of Object.entries(provider.headers)) {
				const rv = resolveConfigValue(v as string);
				if (rv) resolvedHeaders[k] = rv;
			}
		}

		classifyConfigCache = {
			baseUrl: provider.baseUrl,
			apiKey: resolvedKey,
			model: modelId,
			headers: Object.keys(resolvedHeaders).length > 0 ? resolvedHeaders : undefined,
		};
		return classifyConfigCache;
	} catch {
		classifyConfigCache = null;
		return null;
	}
}

async function classifyNeedsInput(text: string): Promise<boolean> {
	const config = loadClassifyConfig();
	if (!config) return false;

	try {
		const res = await fetch(`${config.baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				"Content-Type": "application/json",
				...(config.headers ?? {}),
			},
			body: JSON.stringify({
				model: config.model,
				max_tokens: 10,
				messages: [
					{
						role: "system",
						content:
							"You classify assistant messages. Reply ONLY 'input' if the message is asking the user a question, waiting for a decision, or needs user input to proceed. Reply ONLY 'done' if it's a status update, task completion, or informational response. One word only.",
					},
					{ role: "user", content: text.slice(0, 2000) },
				],
			}),
		});
		const data = (await res.json()) as any;
		const answer = data.choices?.[0]?.message?.content?.trim()?.toLowerCase() ?? "";
		return answer.includes("input");
	} catch {
		classifyConfigCache = undefined;
		return false;
	}
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

function stripMarkdown(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, "")
		.replace(/`[^`]+`/g, "")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/__([^_]+)__/g, "$1")
		.replace(/_([^_]+)_/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^[-*+]\s+/gm, "")
		.replace(/^\d+\.\s+/gm, "")
		.replace(/^>\s+/gm, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	let startTime = 0;
	let timer: ReturnType<typeof setInterval> | null = null;
	let pausedAt = 0;
	let totalPaused = 0;

	function stopTimer() {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}

	function getElapsed() {
		const paused = pausedAt ? Date.now() - pausedAt : 0;
		return Date.now() - startTime - totalPaused - paused;
	}

	function startTicking(ctx: ExtensionContext) {
		stopTimer();
		startTime = Date.now();
		totalPaused = 0;
		pausedAt = 0;
		const theme = ctx.ui.theme;

		const update = () => {
			const elapsed = getElapsed();
			const spinner = theme.fg("accent", pausedAt ? "◷" : "●");
			const time = theme.fg("dim", ` ${formatElapsed(elapsed)}`);
			ctx.ui.setStatus(STATUS_KEY, spinner + time);
			const icon = pausedAt ? "◷" : "⏳";
			setTabTitle(ctx, `${icon} ${formatElapsed(elapsed)}`);
		};

		update();
		timer = setInterval(update, 1000);
	}

	pi.on("agent_start", async (_event, ctx) => {
		startTicking(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		stopTimer();
		if (pausedAt) {
			totalPaused += Date.now() - pausedAt;
			pausedAt = 0;
		}
		const elapsed = getElapsed();
		const theme = ctx.ui.theme;

		// Show ● while classifying
		const time = theme.fg("dim", ` ${formatElapsed(elapsed)}`);
		ctx.ui.setStatus(STATUS_KEY, theme.fg("dim", "●") + time);

		// Classify async — don't block agent_end. A slow/hanging classify call
		// would otherwise stall the extension runner and keep the spinner up.
		const text = getLastAssistantText(ctx);
		const cleaned = text ? stripMarkdown(text) : "";
		if (!cleaned) {
			const icon = theme.fg("success", "✓");
			ctx.ui.setStatus(STATUS_KEY, icon + time);
			setTabTitle(ctx, `✓ ${formatElapsed(elapsed)}`);
			return;
		}

		void classifyNeedsInput(cleaned).then((needsInput) => {
			const icon = needsInput ? theme.fg("warning", "❓") : theme.fg("success", "✓");
			ctx.ui.setStatus(STATUS_KEY, icon + time);
			const titleIcon = needsInput ? "❓" : "✓";
			setTabTitle(ctx, `${titleIcon} ${formatElapsed(elapsed)}`);
		});
	});

	pi.on("tool_execution_start", async (event) => {
		if (PAUSE_TOOLS.has(event.toolName)) {
			pausedAt = Date.now();
		}
	});

	pi.on("tool_execution_end", async (event) => {
		if (PAUSE_TOOLS.has(event.toolName) && pausedAt) {
			totalPaused += Date.now() - pausedAt;
			pausedAt = 0;
		}
	});

	pi.on("session_switch", async (_event, ctx) => {
		stopTimer();
		ctx.ui.setStatus(STATUS_KEY, undefined);
		setTabTitle(ctx, baseTitle(ctx));
	});

	pi.on("session_shutdown", async () => {
		stopTimer();
	});
}
