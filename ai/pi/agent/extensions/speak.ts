import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { execSync, spawn } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const QUEUE_DIR = join(process.env.HOME!, ".pi", "tts-queue");
const DAEMON_SCRIPT = join(dirname(import.meta.url.replace("file://", "")), "pi-tts-daemon.ts");

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

function clearQueue() {
	if (!existsSync(QUEUE_DIR)) return;
	for (const f of readdirSync(QUEUE_DIR)) {
		if (f.endsWith(".json")) {
			try { unlinkSync(join(QUEUE_DIR, f)); } catch {}
		}
	}
}

function queueMessage(message: string) {
	mkdirSync(QUEUE_DIR, { recursive: true });
	const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
	writeFileSync(join(QUEUE_DIR, filename), JSON.stringify({ message, timestamp: Date.now() }));
}

async function classifyNeedsInput(text: string): Promise<boolean> {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) return false;

	try {
		const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "openai/gpt-4.1-nano",
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
		const data = await res.json();
		const answer = data.choices?.[0]?.message?.content?.trim()?.toLowerCase() ?? "";
		return answer.includes("input");
	} catch {
		return false;
	}
}

function ensureDaemon() {
	try {
		execSync("tmux has-session -t pi-tts 2>/dev/null");
	} catch {
		const cmd = `bun run ${DAEMON_SCRIPT}`;
		execSync(`tmux new-session -d -s pi-tts '${cmd}'`);
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async () => {
		ensureDaemon();
	});

	pi.on("input", async () => {
		clearQueue();
		return { action: "continue" as const };
	});

	pi.on("agent_end", async (_event, ctx) => {
		const text = getLastAssistantText(ctx);
		if (!text) return;

		const cleaned = stripMarkdown(text);
		if (!cleaned) return;

		const needsInput = await classifyNeedsInput(cleaned);
		if (needsInput) {
			const summary = cleaned.length > 300
				? cleaned.slice(0, 297) + "..."
				: cleaned;
			queueMessage(`Hey, pi needs your attention. ${summary}`);
		}
	});

	pi.registerCommand("speak", {
		description: "Read the last assistant response aloud via naturalreader",
		handler: async (_args, ctx) => {
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
			try {
				writeFileSync(tmpFile, cleaned, "utf-8");
				ctx.ui.notify("Speaking...", "info");
				execSync(`naturalreader speak --file "${tmpFile}" --voice Echo --source openai --type pro`, {
					stdio: "inherit",
					timeout: 120_000,
				});
			} catch (err: any) {
				if (err.status !== null) {
					ctx.ui.notify(`naturalreader failed: ${err.message}`, "error");
				}
			} finally {
				try { unlinkSync(tmpFile); } catch {}
			}
		},
	});

	pi.registerCommand("speak-stop", {
		description: "Clear TTS queue and stop pending notifications",
		handler: async (_args, ctx) => {
			clearQueue();
			ctx.ui.notify("TTS queue cleared", "info");
		},
	});
}
