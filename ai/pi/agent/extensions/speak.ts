import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync, readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const QUEUE_DIR = join(process.env.HOME!, ".pi", "attention-queue");

type QueueItem = { session_id: string; session_file: string; cwd: string; summary: string; timestamp: number };

function itemPath(sessionId: string): string {
	return join(QUEUE_DIR, `${sessionId}.json`);
}

function upsertItem(sessionId: string, sessionFile: string | null, cwd: string, summary: string) {
	mkdirSync(QUEUE_DIR, { recursive: true });
	const item: QueueItem = { session_id: sessionId, session_file: sessionFile ?? "", cwd, summary, timestamp: Date.now() };
	writeFileSync(itemPath(sessionId), JSON.stringify(item), "utf-8");
}

function removeItem(sessionId: string) {
	try { unlinkSync(itemPath(sessionId)); } catch {}
}

function clearAll() {
	try { rmSync(QUEUE_DIR, { recursive: true, force: true }); } catch {}
}

function listItems(): QueueItem[] {
	let files: string[];
	try {
		files = readdirSync(QUEUE_DIR).filter(f => f.endsWith(".json"));
	} catch {
		return [];
	}
	const items: QueueItem[] = [];
	for (const f of files) {
		try {
			items.push(JSON.parse(readFileSync(join(QUEUE_DIR, f), "utf-8")));
		} catch {}
	}
	return items.sort((a, b) => b.timestamp - a.timestamp);
}

let speakingProcess: ChildProcess | null = null;
let speakingTmpFile: string | null = null;

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

	const envModel = process.env.PI_CLASSIFY_MODEL;
	const defaultProvider = "devai";
	const defaultModel = "gpt-5-nano";

	let providerName = defaultProvider;
	let modelId = defaultModel;
	if (envModel?.includes("/")) {
		[providerName, modelId] = envModel.split("/", 2);
	} else if (envModel) {
		modelId = envModel;
	}

	const modelsPath = join(process.env.HOME!, ".pi", "agent", "models.json");
	if (!existsSync(modelsPath)) {
		const apiKey = process.env.OPENROUTER_API_KEY;
		if (!apiKey) { classifyConfigCache = null; return null; }
		classifyConfigCache = { baseUrl: "https://openrouter.ai/api/v1", apiKey, model: `openai/${modelId}` };
		return classifyConfigCache;
	}

	try {
		const modelsJson = JSON.parse(readFileSync(modelsPath, "utf-8"));
		const provider = modelsJson.providers?.[providerName];
		if (!provider?.baseUrl || !provider?.apiKey) {
			classifyConfigCache = null;
			return null;
		}

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

function invalidateClassifyConfig() {
	classifyConfigCache = undefined;
}

async function classifyNeedsInput(text: string): Promise<boolean> {
	const config = loadClassifyConfig();
	if (!config) return false;

	try {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
			...(config.headers ?? {}),
		};

		const res = await fetch(`${config.baseUrl}/chat/completions`, {
			method: "POST",
			headers,
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
		invalidateClassifyConfig();
		return false;
	}
}

function getSessionInfo(ctx: ExtensionContext) {
	return {
		id: ctx.sessionManager.getSessionId(),
		file: ctx.sessionManager.getSessionFile() ?? "",
		cwd: ctx.cwd,
	};
}

function killSpeaking(ui?: ExtensionContext["ui"]) {
	if (!speakingProcess) return false;

	speakingProcess.kill("SIGTERM");
	speakingProcess = null;

	if (speakingTmpFile) {
		try { unlinkSync(speakingTmpFile); } catch {}
		speakingTmpFile = null;
	}

	if (ui) {
		ui.setStatus("tts", undefined);
	}

	return true;
}

export default function (pi: ExtensionAPI) {
	pi.on("input", async (_event, ctx) => {
		const { id } = getSessionInfo(ctx);
		removeItem(id);
		killSpeaking(ctx.ui);
		return { action: "continue" as const };
	});

	pi.on("agent_end", async (_event, ctx) => {
		const text = getLastAssistantText(ctx);
		if (!text) return;

		const cleaned = stripMarkdown(text);
		if (!cleaned) return;

		const needsInput = await classifyNeedsInput(cleaned);
		const { id, file, cwd } = getSessionInfo(ctx);

		if (needsInput) {
			const summary =
				cleaned.length > 200 ? cleaned.slice(0, 197) + "..." : cleaned;
			upsertItem(id, file, cwd, summary);
		} else {
			removeItem(id);
		}
	});

	pi.registerCommand("attention", {
		description: "View/manage the attention queue of sessions waiting for input",
		handler: async (args, ctx) => {
			const parts = args?.trim().split(/\s+/) ?? [];
			const subcommand = parts[0] ?? "";

			if (subcommand === "clear") {
				clearAll();
				ctx.ui.notify("Attention queue cleared", "info");
				return;
			}

			if (subcommand === "dismiss") {
				const target = parts[1];
				if (!target) {
					ctx.ui.notify("Usage: /attention dismiss <session_id>", "error");
					return;
				}
				removeItem(target);
				ctx.ui.notify(`Dismissed ${target}`, "info");
				return;
			}

			const items = listItems();
			if (items.length === 0) {
				ctx.ui.notify("No sessions waiting for attention", "info");
				return;
			}

			const lines = items.map((item) => {
				const age = Math.round((Date.now() - item.timestamp) / 60_000);
				const dir = item.cwd.replace(process.env.HOME!, "~");
				return `[${age}m ago] ${dir}\n  ${item.summary.slice(0, 120)}`;
			});

			ctx.ui.notify(`${items.length} session(s) waiting:\n\n${lines.join("\n\n")}`, "info");
		},
	});

	pi.registerCommand("speak", {
		description: "Read the last assistant response aloud via naturalreader",
		handler: async (_args, ctx) => {
			if (speakingProcess) {
				killSpeaking(ctx.ui);
				ctx.ui.notify("Stopped speaking", "info");
				return;
			}

			const text = getLastAssistantText(ctx);
			if (!text) {
				ctx.ui.notify("No assistant response to read", "error");
				return;
			}

			const cleaned = stripMarkdown(text);
			if (!cleaned) {
				ctx.ui.notify("Last response had no readable text", "error");
				return;
			}

			const tmpFile = join(tmpdir(), `pi-speak-${Date.now()}.txt`);
			writeFileSync(tmpFile, cleaned, "utf-8");
			speakingTmpFile = tmpFile;

			ctx.ui.setStatus("tts", "🔊 Speaking...");

			const child = spawn("naturalreader", [
				"speak", "--file", tmpFile
			], { stdio: ["ignore", "pipe", "pipe"] });

			speakingProcess = child;

			let stderr = "";
			child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

			child.on("close", (code) => {
				if (speakingProcess === child) {
					speakingProcess = null;
					speakingTmpFile = null;
					ctx.ui.setStatus("tts", undefined);
					if (code !== 0 && stderr) {
						ctx.ui.notify(`naturalreader exited ${code}: ${stderr.slice(0, 200)}`, "error");
					}
				}
				try { unlinkSync(tmpFile); } catch {}
			});

			child.on("error", (err) => {
				if (speakingProcess === child) {
					speakingProcess = null;
					speakingTmpFile = null;
					ctx.ui.setStatus("tts", undefined);
					ctx.ui.notify(`naturalreader failed: ${err.message}`, "error");
				}
				try { unlinkSync(tmpFile); } catch {}
			});
		},
	});

	pi.registerCommand("stop", {
		description: "Stop speaking",
		handler: async (_args, ctx) => {
			const wasSpeaking = killSpeaking(ctx.ui);
			ctx.ui.notify(wasSpeaking ? "Stopped speaking" : "Nothing playing", "info");
		},
	});

	pi.registerCommand("speak-stop", {
		description: "Stop speaking",
		handler: async (_args, ctx) => {
			const wasSpeaking = killSpeaking(ctx.ui);
			ctx.ui.notify(wasSpeaking ? "Stopped speaking" : "Nothing playing", "info");
		},
	});
}
