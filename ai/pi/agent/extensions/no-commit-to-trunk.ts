/**
 * Prevents committing directly to trunk branches (main/master).
 * Blocks git commit and gt create when on a protected branch.
 *
 * Exceptions: add regex patterns (one per line) to ~/.pi/trunk-commit-allow.txt
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROTECTED_BRANCHES = ["main", "master"];
const COMMIT_PATTERNS = [/\bgit\s+commit\b/, /\bgt\s+(create|modify)\b/];

function getCurrentBranch(cwd: string): string | null {
	try {
		return execSync("git rev-parse --abbrev-ref HEAD", { cwd, encoding: "utf-8" }).trim();
	} catch {
		return null;
	}
}

function loadAllowList(): RegExp[] {
	const configPath = join(process.env.HOME ?? "~", ".pi", "trunk-commit-allow.txt");
	try {
		return readFileSync(configPath, "utf-8")
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l && !l.startsWith("#"))
			.map((l) => new RegExp(l));
	} catch {
		return [];
	}
}

const allowList = loadAllowList();

function resolveEffectiveCwd(command: string, cwd: string): string {
	const cdMatch = command.match(/^\s*cd\s+(\S+)\s*(?:&&|;)/);
	if (!cdMatch) {
		const gitCFlag = command.match(/\bgit\s+-C\s+(\S+)/);
		if (gitCFlag) {
			return join(cwd, gitCFlag[1]);
		}
		return cwd;
	}
	return join(cwd, cdMatch[1]);
}


export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setStatus("trunk-guard", "🔒");
	});

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return;

		if (allowList.some((pattern) => pattern.test(ctx.cwd))) return;

		const command = event.input.command as string;
		const isCommit = COMMIT_PATTERNS.some((p) => p.test(command));
		if (!isCommit) return;

		const effectiveCwd = resolveEffectiveCwd(command, ctx.cwd);
		if (allowList.some((pattern) => pattern.test(effectiveCwd))) return;

		const isCdIntoAllowedDir = /\bcd\b/.test(command) && allowList.some((pattern) => pattern.test(command));
		if (isCdIntoAllowedDir) return;

		const branch = getCurrentBranch(effectiveCwd);
		if (!branch || !PROTECTED_BRANCHES.includes(branch)) return;

		return {
			block: true,
			reason: `Blocked: cannot commit directly to ${branch}. Create a feature branch first (e.g. gt branch create <name>).`,
		};
	});
}
