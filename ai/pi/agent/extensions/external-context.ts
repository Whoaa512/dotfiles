/**
 * External Context Extension
 *
 * Loads AGENTS.md/CLAUDE.md files from external directories (e.g., ~/.claude for
 * Claude Code compatibility). Appends their content to the system prompt.
 *
 * Configuration:
 * In your extension, modify CONTEXT_DIRS to specify which directories to search:
 * - "~/.claude" - Load ~/.claude/AGENTS.md or ~/.claude/CLAUDE.md
 * - Subdirs are also checked (e.g., .claude/AGENTS.md in project dirs)
 *
 * Usage:
 * 1. Copy this file to ~/.pi/agent/extensions/
 * 2. Edit CONTEXT_DIRS below to match your setup
 *
 * The extension will:
 * - Load context files from specified global directories (e.g., ~/.claude)
 * - Traverse up from cwd to find matching subdirs (e.g., .claude/)
 * - Dedupe by file path
 * - Append all found context to the system prompt
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Configure which directories to search for context files
// Each entry can be:
// - "~/.claude" - searches ~/.claude for AGENTS.md/CLAUDE.md
// - Also searches .claude/ subdirs in project ancestors
const CONTEXT_DIRS = ["~/.claude"];

const CONTEXT_FILENAMES = ["AGENTS.md", "AGENTS.local.md", "CLAUDE.md", "CLAUDE.local.md"];

function resolvePath(p: string): string {
	if (p === "~") return os.homedir();
	if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
	return path.resolve(p);
}

function loadContextFilesFromDir(dir: string): Array<{ path: string; content: string }> {
	const results: Array<{ path: string; content: string }> = [];
	for (const filename of CONTEXT_FILENAMES) {
		const filePath = path.join(dir, filename);
		if (fs.existsSync(filePath)) {
			try {
				results.push({ path: filePath, content: fs.readFileSync(filePath, "utf-8") });
			} catch {
				// Ignore read errors
			}
		}
	}
	return results;
}

function loadExternalContextFiles(cwd: string, contextDirs: string[]): Array<{ path: string; content: string }> {
	const files: Array<{ path: string; content: string }> = [];
	const seenPaths = new Set<string>();

	const addFile = (file: { path: string; content: string }) => {
		if (!seenPaths.has(file.path)) {
			files.push(file);
			seenPaths.add(file.path);
		}
	};

	// Load from global context directories (e.g., ~/.claude)
	for (const dir of contextDirs) {
		const resolved = resolvePath(dir);
		for (const file of loadContextFilesFromDir(resolved)) {
			addFile(file);
		}
	}

	// Traverse ancestors looking for matching subdirs
	let currentDir = cwd;
	const root = path.resolve("/");
	const ancestorFiles: Array<{ path: string; content: string }> = [];

	while (true) {
		for (const dir of contextDirs) {
			// For "~/.claude", check ".claude" subdirs in ancestors
			if (dir.startsWith("~/.")) {
				const subdirName = dir.slice(2); // ".claude" from "~/.claude"
				const subdir = path.join(currentDir, subdirName);
				for (const file of loadContextFilesFromDir(subdir)) {
					if (!seenPaths.has(file.path)) {
						ancestorFiles.unshift(file);
						seenPaths.add(file.path);
					}
				}
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
		contextFiles = loadExternalContextFiles(ctx.cwd, CONTEXT_DIRS);
		if (contextFiles.length > 0 && ctx.hasUI) {
			ctx.ui.notify(`Loaded ${contextFiles.length} external context file(s)`, "info");
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
