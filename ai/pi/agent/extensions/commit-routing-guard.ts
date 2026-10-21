/**
 * Blocks commits that violate the CLAUDE.work.md notes-routing rules. The prose
 * rule failed 8 times in 30 days: handoff/notes .md committed into the shared
 * ergo repo (2x), confidential EAP/transcript material committed into the
 * company-readable ~/work/cj repo (3x), plus work content in public dotfiles.
 *
 * Repo kinds:
 *   shared   (ergo*, twig*)      -> no notes/, handoff, design-doc, .worktrees/ paths
 *   cj       (~/work/cj)         -> no people/confidential content in added lines
 *   dotfiles (~/code/dotfiles)   -> no airbnb/musta.ch/iap-auth content in added lines
 * Escape hatch: prefix the command with `# ok-commit`.
 */

import { execSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type RepoKind = "shared" | "cj" | "dotfiles" | null;

const OVERRIDE = /^\s*#\s*ok-commit\b/;
const COMMIT_CMD =
	/\b(?:git\b[^|;&]*\bcommit\b|gt\s+(?:create|modify|absorb)\b)/;
const ALL_FLAG =
	/\bgit\b[^|;&]*\bcommit\b[^|;&]*\s(?:-[a-zA-Z]*[aA]\b|--all\b)/;

const SHARED_PATH = /(^|\/)notes\/|handoff|design-doc|\.worktrees\//i;
const SHARED_ALLOW = /^(?:_infra\/docs\/|docs\/)|(^|\/)README\.md$/;

const CJ_LINE =
	/\b(EAP|transcript|1:1|one[- ]on[- ]one|skip[- ]level|perf(ormance)? review|comp(ensation)?|confidential|PIP)\b/i;
const DOTFILES_LINE = /musta\.ch|airbnb|\biap-auth\b|a\.musta/i;

const HINTS: Record<NonNullable<RepoKind>, string> = {
	shared:
		"notes/handoffs belong in ~/work/cj/notes (or cj-private); see CLAUDE.work.md routing table",
	cj: "people/confidential content → ~/work/cj-private/notes",
	dotfiles: "dotfiles is public; work-specific content → ~/work/cj/ai",
};

export function isCommitCommand(command: string): boolean {
	return COMMIT_CMD.test(command);
}

export function classifyRepo(rootRealpath: string): RepoKind {
	const root = rootRealpath.replace(/\/+$/, "");
	if (root.endsWith("/code/dotfiles")) return "dotfiles";
	if (root.endsWith("/work/cj")) return "cj";
	if (/^(ergo\d*|twig\d*)$/.test(basename(root))) return "shared";
	if (/\/work\/(ergo|twig)(\/|$)/.test(root)) return "shared";
	return null;
}

export function offendingPaths(repoKind: RepoKind, paths: string[]): string[] {
	if (repoKind !== "shared") return [];
	return paths.filter((p) => SHARED_PATH.test(p) && !SHARED_ALLOW.test(p));
}

export function addedLines(diffText: string): string[] {
	return diffText
		.split("\n")
		.filter((l) => l.startsWith("+") && !l.startsWith("+++"))
		.map((l) => l.slice(1));
}

export function offendingLines(repoKind: RepoKind, diffText: string): string[] {
	const pattern =
		repoKind === "cj"
			? CJ_LINE
			: repoKind === "dotfiles"
				? DOTFILES_LINE
				: null;
	if (!pattern) return [];
	return addedLines(diffText).filter((l) => pattern.test(l));
}

export function resolveEffectiveCwd(command: string, cwd: string): string {
	const cdMatch = command.match(/^\s*cd\s+(\S+)\s*(?:&&|;)/);
	if (cdMatch) return resolve(cwd, cdMatch[1]);
	const gitCFlag = command.match(/\bgit\s+-C\s+(\S+)/);
	if (gitCFlag) return resolve(cwd, gitCFlag[1]);
	return cwd;
}

function git(cwd: string, args: string): string | null {
	try {
		return execSync(`git ${args}`, {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
	} catch {
		return null;
	}
}

function repoRoot(cwd: string): string | null {
	const out = git(cwd, "rev-parse --show-toplevel")?.trim();
	if (!out) return null;
	try {
		return realpathSync(out);
	} catch {
		return out;
	}
}

function formatList(items: string[]): string {
	const preview = items.slice(0, 8).join("\n  ");
	const more = items.length > 8 ? `\n  …and ${items.length - 8} more` : "";
	return `  ${preview}${more}`;
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return;
		const command = event.input.command as string;
		if (!isCommitCommand(command)) return;
		if (OVERRIDE.test(command)) return;

		const cwd = resolveEffectiveCwd(command, ctx.cwd);
		const root = repoRoot(cwd);
		if (!root) return;
		const kind = classifyRepo(root);
		if (!kind) return;

		const includeUnstaged = ALL_FLAG.test(command);
		const staged = git(cwd, "diff --cached --name-only") ?? "";
		const unstaged = includeUnstaged
			? (git(cwd, "diff --name-only") ?? "")
			: "";
		const paths = `${staged}\n${unstaged}`.split("\n").filter(Boolean);

		const badPaths = offendingPaths(kind, paths);
		if (badPaths.length > 0) {
			return {
				block: true,
				reason:
					`Blocked: ${kind} repo commit includes notes/handoff paths:\n${formatList(badPaths)}\n` +
					`${HINTS[kind]}. If cj explicitly approved, prefix the command with \`# ok-commit\`.`,
			};
		}

		if (kind === "shared") return;
		const diff =
			(git(cwd, "diff --cached") ?? "") +
			(includeUnstaged ? (git(cwd, "diff") ?? "") : "");
		const badLines = offendingLines(kind, diff);
		if (badLines.length === 0) return;

		return {
			block: true,
			reason:
				`Blocked: ${kind} repo commit adds lines that look misrouted:\n${formatList(badLines.map((l) => l.trim().slice(0, 100)))}\n` +
				`${HINTS[kind]}. If cj explicitly approved, prefix the command with \`# ok-commit\`.`,
		};
	});
}
