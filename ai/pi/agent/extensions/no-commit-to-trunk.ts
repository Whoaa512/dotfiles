/**
 * Prevents committing directly to trunk branches (main/master).
 * Blocks git commit and gt create when on a protected branch.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";

const PROTECTED_BRANCHES = ["main", "master"];
const COMMIT_PATTERNS = [/\bgit\s+commit\b/, /\bgt\s+(create|modify)\b/];

function getCurrentBranch(cwd: string): string | null {
	try {
		return execSync("git rev-parse --abbrev-ref HEAD", { cwd, encoding: "utf-8" }).trim();
	} catch {
		return null;
	}
}

const projectDirsAllowedToCommitToMain = [
	/work\/cj\/?/, // Allow commits in the /work/cj directory (e.g. for documentation updates)
	/(cj_winslow|cjw|\~)\/\.(pi|claude|codex)\/?/, // agent dirs in home dir
];


export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return;

		if (projectDirsAllowedToCommitToMain.some((pattern) => pattern.test(ctx.cwd))) return;

		const command = event.input.command as string;
		const isCommit = COMMIT_PATTERNS.some((p) => p.test(command));
		if (!isCommit) return;
		const isCdIntoCjDir = /\bcd\b/.test(command) && projectDirsAllowedToCommitToMain.some((pattern) => pattern.test(command));
		if (isCdIntoCjDir) return;

		const branch = getCurrentBranch(ctx.cwd);
		if (!branch || !PROTECTED_BRANCHES.includes(branch)) return;

		return {
			block: true,
			reason: `Blocked: cannot commit directly to ${branch}. Create a feature branch first (e.g. gt branch create <name>).`,
		};
	});
}
