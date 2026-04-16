/**
 * External Context Extension (supplemental)
 *
 * Upstream pi now natively loads AGENTS.md/CLAUDE.md from ~/.claude/,
 * ~/.pi/agent/, and ancestor directories. This extension supplements
 * that by loading files upstream doesn't cover:
 *
 * 1. .local.md variants (AGENTS.local.md, CLAUDE.local.md) from ~/.claude/
 * 2. .claude/ subdirectories in project ancestors
 *    (e.g., ~/code/my-project/.claude/AGENTS.local.md)
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const LOCAL_FILENAMES = ["AGENTS.local.md", "CLAUDE.local.md"];
const ALL_CLAUDE_SUBDIR_FILENAMES = ["AGENTS.md", "AGENTS.local.md", "CLAUDE.md", "CLAUDE.local.md"];

function tryRead(filePath: string): { path: string; content: string } | null {
	try {
		if (!fs.existsSync(filePath)) return null;
		return { path: filePath, content: fs.readFileSync(filePath, "utf-8") };
	} catch {
		return null;
	}
}

function loadSupplementalContextFiles(cwd: string): Array<{ path: string; content: string }> {
	const files: Array<{ path: string; content: string }> = [];
	const seenPaths = new Set<string>();

	const addFile = (file: { path: string; content: string }) => {
		if (seenPaths.has(file.path)) return;
		files.push(file);
		seenPaths.add(file.path);
	};

	const claudeDir = path.join(os.homedir(), ".claude");
	for (const filename of LOCAL_FILENAMES) {
		const f = tryRead(path.join(claudeDir, filename));
		if (f) addFile(f);
	}

	let currentDir = cwd;
	const root = path.resolve("/");
	const ancestorFiles: Array<{ path: string; content: string }> = [];

	while (true) {
		const subdir = path.join(currentDir, ".claude");
		for (const filename of ALL_CLAUDE_SUBDIR_FILENAMES) {
			const f = tryRead(path.join(subdir, filename));
			if (f && !seenPaths.has(f.path)) {
				ancestorFiles.unshift(f);
				seenPaths.add(f.path);
			}
		}

		if (currentDir === root) break;
		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) break;
		currentDir = parentDir;
	}

	files.push(...ancestorFiles);
	return files;
}

export default function externalContextExtension(pi: ExtensionAPI) {
	let contextFiles: Array<{ path: string; content: string }> = [];

	pi.on("session_start", async (_event, ctx) => {
		contextFiles = loadSupplementalContextFiles(ctx.cwd);
		if (contextFiles.length > 0 && ctx.hasUI) {
			ctx.ui.notify(`Loaded ${contextFiles.length} supplemental context file(s)`, "info");
		}
	});

	pi.on("before_agent_start", async (event) => {
		if (contextFiles.length === 0) return;

		const contextSection = contextFiles
			.map((f) => {
				const relativePath = f.path.startsWith(os.homedir()) ? `~${f.path.slice(os.homedir().length)}` : f.path;
				return `## ${relativePath}\n\n${f.content}`;
			})
			.join("\n\n");

		return {
			systemPrompt:
				event.systemPrompt +
				`

# External Context

${contextSection}
`,
		};
	});
}
