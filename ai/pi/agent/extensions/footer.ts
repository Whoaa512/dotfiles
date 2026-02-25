import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { hostname } from "node:os";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const sessionFile = ctx.sessionManager.getSessionFile();
		const filename = sessionFile?.split("/").pop()?.replace(".jsonl", "") ?? "ephemeral";
		const id = filename.includes("_") ? filename.split("_").slice(1).join("_") : filename;

		const isSSH = !!process.env.SSH_CONNECTION || !!process.env.SSH_TTY;
		const user = process.env.USER || process.env.LOGNAME || "";
		const host = isSSH ? hostname() : null;

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					const lines = footerData.renderDefault(width);
					if (lines.length === 0) return lines;

					const firstLine = lines[0]!;
					const firstLineWidth = visibleWidth(firstLine);
					const gap = 2;
					const available = width - firstLineWidth - gap;

					if (available > 0) {
						const fullLabel = host ? `${user}@${host} | ${id}` : id;
						const idOnly = id;
						const text = visibleWidth(fullLabel) <= available ? fullLabel : idOnly;
						const truncated = text.length > available ? text.slice(-(available)) : text;
						const label = theme.fg("dim", truncated);
						const pad = " ".repeat(available - visibleWidth(label));
						lines[0] = firstLine + " ".repeat(gap) + pad + label;
					}

					return lines;
				},
			};
		});
	});
}
