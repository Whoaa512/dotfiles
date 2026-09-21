/**
 * Blocks destructive git commands while the working tree has uncommitted or
 * untracked changes. Enforces the CLAUDE.md "Never discard uncommitted work" rule,
 * which prose alone failed to hold (2026-09-03: `git reset --hard` ate .asana.json).
 *
 * Blocked when dirty: reset --hard/--merge, checkout -- <paths> / checkout .,
 * restore <paths>, clean -f/-d/-x, stash drop/clear, branch -D/-d, worktree remove --force.
 * Chains that preserve first (`git stash push -u … && git reset --hard`, `git commit … && …`) pass.
 * Escape hatch: prefix the command with `# ok-discard` once the user has explicitly agreed.
 */

import { execSync } from "node:child_process";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const OVERRIDE = /^\s*#\s*ok-discard\b/;
const PRESERVES_FIRST =
	/\bgit\b[^|;&]*\b(?:stash(?:\s+push|\s+save)?\s*(?:-|&&|;|$)|commit\b)/;

export const DESTRUCTIVE_PATTERNS: RegExp[] = [
	/\bgit\b[^|;&]*\breset\s+(?:[^|;&]*\s)?--(?:hard|merge)\b/,
	/\bgit\b[^|;&]*\bcheckout\s+(?:[^|;&]*\s)?(?:--\s+\S|\.(?:\s|$))/,
	/\bgit\b[^|;&]*\brestore\b(?!\s+--staged\b)/,
	/\bgit\b[^|;&]*\bclean\b[^|;&]*\s-[a-zA-Z]*[fdx]/,
	/\bgit\b[^|;&]*\bstash\s+(?:drop|clear)\b/,
	/\bgit\b[^|;&]*\bbranch\s+(?:[^|;&]*\s)?-[a-zA-Z]*[dD]\b/,
	/\bgit\b[^|;&]*\bworktree\s+remove\b[^|;&]*--force/,
];

export function isDestructive(command: string): boolean {
	if (!DESTRUCTIVE_PATTERNS.some((p) => p.test(command))) return false;
	return !PRESERVES_FIRST.test(command);
}

export function resolveEffectiveCwd(command: string, cwd: string): string {
	const cdMatch = command.match(/^\s*cd\s+(\S+)\s*(?:&&|;)/);
	if (cdMatch) return resolve(cwd, cdMatch[1]);
	const gitCFlag = command.match(/\bgit\s+-C\s+(\S+)/);
	if (gitCFlag) return resolve(cwd, gitCFlag[1]);
	return cwd;
}

function dirtyEntries(cwd: string): string[] {
	try {
		const out = execSync("git status --porcelain --untracked-files=all", {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		return out.split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return;
		const command = event.input.command as string;
		if (!isDestructive(command)) return;
		if (OVERRIDE.test(command)) return;

		const cwd = resolveEffectiveCwd(command, ctx.cwd);
		const dirty = dirtyEntries(cwd);
		if (dirty.length === 0) return;

		const preview = dirty.slice(0, 8).join("\n  ");
		const more = dirty.length > 8 ? `\n  …and ${dirty.length - 8} more` : "";
		return {
			block: true,
			reason:
				`Blocked: destructive git command with a dirty tree (${dirty.length} uncommitted/untracked):\n  ${preview}${more}\n` +
				`Preserve first: \`git stash push -u -m "<why>"\` (or commit), then retry. ` +
				`If cj explicitly approved discarding, prefix the command with \`# ok-discard\`.`,
		};
	});
}
