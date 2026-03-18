import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

export default function (pi: ExtensionAPI) {
	pi.registerCommand("speak", {
		description: "Read the last assistant response aloud via naturalreader",
		handler: async (args, ctx) => {
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
}
