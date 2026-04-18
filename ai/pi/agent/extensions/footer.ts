import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { execSync } from "node:child_process";
import { hostname } from "node:os";

interface GitStatus {
	branch: string | null;
	ahead: number;
	behind: number;
	stashes: number;
	staged: number;
	unstaged: number;
	untracked: number;
	conflicted: number;
	action: string | null;
}

function getGitStatus(): GitStatus | null {
	try {
		const porcelain = execSync("git status --porcelain=v2 --branch 2>/dev/null", {
			encoding: "utf8",
			timeout: 2000,
		});

		let branch: string | null = null;
		let ahead = 0;
		let behind = 0;
		let staged = 0;
		let unstaged = 0;
		let untracked = 0;
		let conflicted = 0;

		for (const line of porcelain.split("\n")) {
			if (line.startsWith("# branch.head ")) {
				const b = line.slice(14);
				branch = b === "(detached)" ? "detached" : b;
			} else if (line.startsWith("# branch.ab ")) {
				const match = line.match(/\+(\d+) -(\d+)/);
				if (match) {
					ahead = parseInt(match[1]!, 10);
					behind = parseInt(match[2]!, 10);
				}
			} else if (line.startsWith("u ")) {
				conflicted++;
			} else if (line.startsWith("1 ") || line.startsWith("2 ")) {
				const xy = line.split(" ")[1]!;
				if (xy[0] !== ".") staged++;
				if (xy[1] !== ".") unstaged++;
			} else if (line.startsWith("? ")) {
				untracked++;
			}
		}

		let stashes = 0;
		try {
			const stashOut = execSync("git stash list 2>/dev/null", { encoding: "utf8", timeout: 1000 });
			stashes = stashOut.trim() ? stashOut.trim().split("\n").length : 0;
		} catch {}

		let action: string | null = null;
		try {
			const gitDir = execSync("git rev-parse --git-dir 2>/dev/null", { encoding: "utf8", timeout: 1000 }).trim();
			const { existsSync } = require("node:fs");
			const { join } = require("node:path");
			if (existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply"))) {
				action = "rebase";
			} else if (existsSync(join(gitDir, "MERGE_HEAD"))) {
				action = "merge";
			} else if (existsSync(join(gitDir, "CHERRY_PICK_HEAD"))) {
				action = "cherry-pick";
			} else if (existsSync(join(gitDir, "REVERT_HEAD"))) {
				action = "revert";
			} else if (existsSync(join(gitDir, "BISECT_LOG"))) {
				action = "bisect";
			}
		} catch {}

		return { branch, ahead, behind, stashes, staged, unstaged, untracked, conflicted, action };
	} catch {
		return null;
	}
}

function formatGitStatus(status: GitStatus, theme: any): string {
	const parts: string[] = [];

	// Branch icon + name (truncate long branches like p10k: first 12…last 12)
	if (status.branch) {
		let branch = status.branch;
		if (branch.length > 32) {
			branch = branch.slice(0, 12) + "…" + branch.slice(-12);
		}
		const branchColor = (status.unstaged || status.staged || status.conflicted) ? "warning" : "success";
		parts.push(theme.fg(branchColor, `\uF126 ${branch}`));
	}

	// ⇣N if behind remote
	if (status.behind) parts.push(theme.fg("success", `⇣${status.behind}`));
	// ⇡N if ahead of remote
	if (status.ahead) parts.push(theme.fg("success", `⇡${status.ahead}`));

	// *N stashes
	if (status.stashes) parts.push(theme.fg("success", `*${status.stashes}`));

	// Action (merge, rebase, etc)
	if (status.action) parts.push(theme.fg("error", status.action));

	// ~N conflicts
	if (status.conflicted) parts.push(theme.fg("error", `~${status.conflicted}`));

	// +N staged
	if (status.staged) parts.push(theme.fg("warning", `+${status.staged}`));

	// !N unstaged
	if (status.unstaged) parts.push(theme.fg("warning", `!${status.unstaged}`));

	// ?N untracked
	if (status.untracked) parts.push(theme.fg("muted", `?${status.untracked}`));

	return parts.join(" ");
}

function formatRelative(ts: number): string {
	const diff = Math.max(0, Date.now() - ts);
	const s = Math.floor(diff / 1000);
	if (s < 60) return `${s}s ago`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	return `${d}d ago`;
}

function formatClock(ts: number): string {
	const d = new Date(ts);
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function (pi: ExtensionAPI) {
	let refreshFn: (() => void) | null = null;
	let lastUserTs: number | null = null;
	let lastAssistantTs: number | null = null;

	pi.on("tool_execution_end", async () => {
		refreshFn?.();
	});

	pi.on("message_end", async (event) => {
		const msg: any = event.message;
		const ts = typeof msg?.timestamp === "number" ? msg.timestamp : Date.now();
		if (msg?.role === "user") lastUserTs = ts;
		else if (msg?.role === "assistant") lastAssistantTs = ts;
		refreshFn?.();
	});

	pi.on("session_start", async (_event, ctx) => {
		const sessionFile = ctx.sessionManager.getSessionFile();
		const filename = sessionFile?.split("/").pop()?.replace(".jsonl", "") ?? "ephemeral";
		const id = filename.includes("_") ? filename.split("_").slice(1).join("_") : filename;

		const isSSH = !!process.env.SSH_CONNECTION || !!process.env.SSH_TTY;
		const user = process.env.USER || process.env.LOGNAME || "";
		const host = isSSH ? hostname() : null;

		let cachedGitStatus: GitStatus | null | undefined = undefined;
		let gitStatusTimer: ReturnType<typeof setInterval> | null = null;

		function refreshGitStatus() {
			cachedGitStatus = getGitStatus();
		}

		refreshGitStatus();
		refreshFn = refreshGitStatus;
		gitStatusTimer = setInterval(refreshGitStatus, 5000);

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => {
				refreshGitStatus();
				tui.requestRender();
			});

			return {
				dispose: () => {
					unsub();
					if (gitStatusTimer) clearInterval(gitStatusTimer);
				},
				invalidate() {},
				render(width: number): string[] {
					const lines = footerData.renderDefault(width);
					if (lines.length === 0) return lines;

					// Replace the first line (pwd line) with git-status-enriched version
					// The default footer's first line is: dim(pwd (branch))
					// We want: dim(pwd) + colored git status
					if (cachedGitStatus) {
						let pwd = process.cwd();
						const home = process.env.HOME || process.env.USERPROFILE;
						if (home && pwd.startsWith(home)) {
							pwd = `~${pwd.slice(home.length)}`;
						}

						const sessionName = ctx.sessionManager.getSessionName();
						if (sessionName) {
							pwd = `${pwd} • ${sessionName}`;
						}

						const gitStr = formatGitStatus(cachedGitStatus, theme);
						const pwdStr = theme.fg("dim", pwd);
						const combined = gitStr ? `${pwdStr} ${gitStr}` : pwdStr;
						lines[0] = truncateToWidth(combined, width, theme.fg("dim", "..."));
					}

					// Append session id / ssh info on the right of line 1
					const firstLine = lines[0]!;
					const firstLineWidth = visibleWidth(firstLine);
					const gap = 2;
					const available = width - firstLineWidth - gap;

					if (available > 0) {
						const tsParts: string[] = [];
						if (lastUserTs) tsParts.push(`u ${formatRelative(lastUserTs)} (${formatClock(lastUserTs)})`);
						if (lastAssistantTs) tsParts.push(`a ${formatRelative(lastAssistantTs)} (${formatClock(lastAssistantTs)})`);
						const tsStr = tsParts.join(" · ");
						const base = host ? `${user}@${host} | ${id}` : id;
						const fullLabel = tsStr ? `${tsStr} | ${base}` : base;
						const idOnly = tsStr ? `${tsStr} | ${id}` : id;
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
