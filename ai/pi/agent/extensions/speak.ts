import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DB_PATH = join(process.env.HOME!, ".pi", "attention.db");

function getDb() {
	const sqlite = require("node:sqlite");
	mkdirSync(join(process.env.HOME!, ".pi"), { recursive: true });
	const db = new sqlite.DatabaseSync(DB_PATH);
	db.exec(`CREATE TABLE IF NOT EXISTS queue (
		session_id TEXT PRIMARY KEY,
		session_file TEXT,
		cwd TEXT,
		summary TEXT NOT NULL,
		timestamp INTEGER NOT NULL
	)`);
	return db;
}

function upsertItem(sessionId: string, sessionFile: string | null, cwd: string, summary: string) {
	const db = getDb();
	try {
		db.prepare(
			`INSERT INTO queue (session_id, session_file, cwd, summary, timestamp)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(session_id) DO UPDATE SET summary = ?, timestamp = ?`
		).run(sessionId, sessionFile, cwd, summary, Date.now(), summary, Date.now());
	} finally {
		db.close();
	}
}

function removeItem(sessionId: string) {
	const db = getDb();
	try {
		db.prepare("DELETE FROM queue WHERE session_id = ?").run(sessionId);
	} finally {
		db.close();
	}
}

function clearAll() {
	const db = getDb();
	try {
		db.exec("DELETE FROM queue");
	} finally {
		db.close();
	}
}

function listItems(): Array<{ session_id: string; session_file: string; cwd: string; summary: string; timestamp: number }> {
	const db = getDb();
	try {
		return db.prepare("SELECT * FROM queue ORDER BY timestamp DESC").all();
	} finally {
		db.close();
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

async function classifyNeedsInput(text: string): Promise<boolean> {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) return false;

	try {
		const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
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
		const data = (await res.json()) as any;
		const answer = data.choices?.[0]?.message?.content?.trim()?.toLowerCase() ?? "";
		return answer.includes("input");
	} catch {
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

export default function (pi: ExtensionAPI) {
	pi.on("input", async (_event, ctx) => {
		const { id } = getSessionInfo(ctx);
		removeItem(id);
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
				execSync(
					`naturalreader speak --file "${tmpFile}" --voice Echo --source openai --type pro`,
					{ stdio: "inherit", timeout: 120_000 }
				);
			} catch (err: any) {
				if (err.status !== null) {
					ctx.ui.notify(`naturalreader failed: ${err.message}`, "error");
				}
			} finally {
				try {
					unlinkSync(tmpFile);
				} catch {}
			}
		},
	});
}
