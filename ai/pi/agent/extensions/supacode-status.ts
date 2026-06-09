import net from "node:net";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

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

// New protocol: JSON event envelope. `surface_id` scopes the event app-side;
// `agent` must be a valid SkillAgent rawValue ("pi"); `pid` drives the
// liveness sweep + record creation. Activity events (busy/idle) only mutate
// an existing record, so session_start must fire first to create it.
function sendEvent(eventName: string) {
	const env = supacodeEnv();
	if (!env) return;

	const envelope = {
		event: eventName,
		v: 1,
		agent: "pi",
		surface_id: env.surfaceID,
		pid: process.pid,
	};
	sendToSupacode(`${JSON.stringify(envelope)}\n`);
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
	// Extension load = agent process running. Pi has no SessionStart hook,
	// so fire it ourselves to create the presence record busy/idle mutate.
	sendEvent("session_start");

	pi.on("agent_start", async () => {
		sendEvent("busy");
	});

	pi.on("agent_end", async (event, ctx) => {
		sendEvent("idle");

		const text = lastAssistantTextFromMessages((event as any).messages) ?? lastAssistantTextFromSession(ctx);
		if (!text) return;

		sendNotification("Pi finished", summarize(text));
	});

	pi.on("session_shutdown", async () => {
		sendEvent("session_end");
		sendEvent("idle");
	});
}
