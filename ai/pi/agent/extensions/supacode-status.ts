import net from "node:net";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

type SupacodeEnv = {
	socketPath: string;
	worktreeID: string;
	tabID: string;
	surfaceID: string;
};

function supacodeEnv(): SupacodeEnv | undefined {
	const socketPath = process.env.SUPACODE_SOCKET_PATH;
	const worktreeID = process.env.SUPACODE_WORKTREE_ID;
	const tabID = process.env.SUPACODE_TAB_ID;
	const surfaceID = process.env.SUPACODE_SURFACE_ID;

	if (!socketPath || !worktreeID || !tabID || !surfaceID) return undefined;
	return { socketPath, worktreeID, tabID, surfaceID };
}

function sendToSupacode(payload: string) {
	const env = supacodeEnv();
	if (!env) return;

	const client = net.createConnection(env.socketPath);
	client.on("error", () => {});
	client.end(payload);
}

function setBusy(active: boolean) {
	const env = supacodeEnv();
	if (!env) return;

	sendToSupacode(`${env.worktreeID} ${env.tabID} ${env.surfaceID} ${active ? "1" : "0"}\n`);
}

function sendNotification(title: string, body: string) {
	const env = supacodeEnv();
	if (!env) return;

	const payload = JSON.stringify({
		hook_event_name: "agent_end",
		title,
		last_assistant_message: body,
	});
	sendToSupacode(`${env.worktreeID} ${env.tabID} ${env.surfaceID} pi\n${payload}\n`);
}

function contentText(content: unknown): string | undefined {
	if (typeof content === "string") return content.trim() || undefined;
	if (!Array.isArray(content)) return undefined;

	const text = content
		.map((part: any) => {
			if (typeof part === "string") return part;
			if (part?.type === "text" && typeof part.text === "string") return part.text;
			return undefined;
		})
		.filter(Boolean)
		.join("\n")
		.trim();

	return text || undefined;
}

function lastAssistantTextFromMessages(messages: unknown): string | undefined {
	if (!Array.isArray(messages)) return undefined;

	for (let index = messages.length - 1; index >= 0; index--) {
		const message: any = messages[index];
		if (message?.role !== "assistant") continue;
		const text = contentText(message.content);
		if (text) return text;
	}

	return undefined;
}

function lastAssistantTextFromSession(ctx: ExtensionContext): string | undefined {
	const entries = ctx.sessionManager.getBranch();
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry: any = entries[index];
		if (entry.type !== "message") continue;
		if (entry.message?.role !== "assistant") continue;
		const text = contentText(entry.message.content);
		if (text) return text;
	}

	return undefined;
}

function summarize(text: string): string {
	const singleLine = text.replace(/\s+/g, " ").trim();
	if (singleLine.length <= 500) return singleLine;
	return `${singleLine.slice(0, 497)}…`;
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_start", async () => {
		setBusy(true);
	});

	pi.on("agent_end", async (event, ctx) => {
		setBusy(false);

		const text = lastAssistantTextFromMessages((event as any).messages) ?? lastAssistantTextFromSession(ctx);
		if (!text) return;

		sendNotification("Pi finished", summarize(text));
	});

	pi.on("session_shutdown", async () => {
		setBusy(false);
	});
}
