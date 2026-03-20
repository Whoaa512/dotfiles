import { complete, getModel } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join, basename } from "path";

const MEMORY_DIR = join(process.env.HOME ?? "", "work/cj-private/ai-memory/sessions");

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
		const apiKey = model ? await ctx.modelRegistry.getApiKey(model).catch(() => undefined) : undefined;

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
	});
}
