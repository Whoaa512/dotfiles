/**
 * External Context Extension
 *
 * Adds Claude Code style context files to pi's native context files, so they
 * render as <project_instructions> inside <project_context>:
 *
 * 1. ~/.claude/{AGENTS,AGENTS.local,CLAUDE,CLAUDE.local}.md, before pi's own files
 * 2. the same filenames in .claude/ subdirectories of cwd ancestors, after pi's own files
 *
 * Files are deduped by real path, and `@path` imports are expanded in every
 * context file, including the ones pi loaded itself.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type ContextFile = { path: string; content: string };

const FILENAMES = ["AGENTS.md", "AGENTS.local.md", "CLAUDE.md", "CLAUDE.local.md"];

/** Max number of `@import` hops followed from a context file, matching Claude Code. */
const MAX_IMPORT_DEPTH = 5;

/** `@` followed by a whitespace-free token containing a path separator. */
const IMPORT_PATTERN = /(^|\s)@(?=[^\s]*\/)([^\s]+)/g;

/** Inline code spans, captured so they can be skipped during expansion. */
const INLINE_CODE_PATTERN = /(`+[^`]*`+)/;

function realPath(filePath: string): string {
	try {
		return fs.realpathSync(filePath);
	} catch {
		return filePath;
	}
}

function readFile(filePath: string): string | undefined {
	try {
		if (!fs.statSync(filePath).isFile()) return undefined;
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return undefined;
	}
}

function readContextDir(dir: string): ContextFile[] {
	const files: ContextFile[] = [];
	for (const filename of FILENAMES) {
		const filePath = path.join(dir, filename);
		const content = readFile(filePath);
		if (content !== undefined) files.push({ path: filePath, content });
	}
	return files;
}

function resolveImport(reference: string, containingDir: string, home: string): string {
	if (reference.startsWith("~/")) return path.join(home, reference.slice(2));
	return path.resolve(containingDir, reference);
}

export function expandContextImports(
	content: string,
	containingDir: string,
	home: string,
	chain: Set<string>,
	depth = 0,
): string {
	if (depth >= MAX_IMPORT_DEPTH) return content;

	const expandText = (text: string) =>
		text.replace(IMPORT_PATTERN, (match, prefix: string, reference: string) => {
			if (reference.includes("://")) return match;

			const importPath = resolveImport(reference, containingDir, home);
			const importRealPath = realPath(importPath);
			if (chain.has(importRealPath)) return match;

			// Prose and scoped package names look like imports (`@typescript/native-preview`,
			// "the @/some/dir directory"). Only a real file is an import; anything else stays literal.
			const imported = readFile(importPath);
			if (imported === undefined) return match;

			const nestedChain = new Set(chain).add(importRealPath);
			return prefix + expandContextImports(imported, path.dirname(importPath), home, nestedChain, depth + 1);
		});

	let fenceMarker: string | undefined;
	return content
		.split("\n")
		.map((line) => {
			const fence = line.trimStart().match(/^(```+|~~~+)/);
			if (fence) {
				const marker = fence[1][0];
				if (!fenceMarker) fenceMarker = marker;
				else if (fenceMarker === marker) fenceMarker = undefined;
				return line;
			}
			if (fenceMarker) return line;
			return line
				.split(INLINE_CODE_PATTERN)
				.map((segment, index) => (index % 2 === 1 ? segment : expandText(segment)))
				.join("");
		})
		.join("\n");
}

function loadAncestorClaudeFiles(cwd: string): ContextFile[] {
	const files: ContextFile[] = [];
	let dir = path.resolve(cwd);
	while (true) {
		files.unshift(...readContextDir(path.join(dir, ".claude")));
		const parent = path.dirname(dir);
		if (parent === dir) return files;
		dir = parent;
	}
}

/**
 * ~/.claude files, then pi's own context files, then ancestor .claude/ files.
 * Deduped by real path (first wins), with `@path` imports expanded in all of them.
 */
export function mergeContextFiles(native: ContextFile[], cwd: string, home: string = os.homedir()): ContextFile[] {
	const candidates = [...readContextDir(path.join(home, ".claude")), ...native, ...loadAncestorClaudeFiles(cwd)];
	const seen = new Set<string>();
	const merged: ContextFile[] = [];
	for (const file of candidates) {
		const fileRealPath = realPath(file.path);
		if (seen.has(fileRealPath)) continue;
		seen.add(fileRealPath);
		merged.push({
			path: file.path,
			content: expandContextImports(file.content, path.dirname(fileRealPath), home, new Set([fileRealPath])),
		});
	}
	return merged;
}

export function contextFilesDisabled(argv: string[] = process.argv): boolean {
	return argv.includes("--no-context-files") || argv.includes("-nc");
}

export default function externalContextExtension(pi: ExtensionAPI) {
	if (contextFilesDisabled()) return;

	let notified = false;
	pi.on("session_start", async () => {
		notified = false;
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const options = event.systemPromptOptions;
		const nativeCount = options.contextFiles.length;
		options.contextFiles = mergeContextFiles(options.contextFiles, ctx.cwd);

		const added = options.contextFiles.length - nativeCount;
		if (notified || added <= 0 || !ctx.hasUI) return;
		notified = true;
		ctx.ui.notify(`Loaded ${added} external context file(s)`, "info");
	});
}
