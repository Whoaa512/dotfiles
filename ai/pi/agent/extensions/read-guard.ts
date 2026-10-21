/**
 * Guards the `read` tool against two CLAUDE.md violations prose didn't stop:
 *   - lockfiles/generated files read whole (package-lock.json read 13x in one session)
 *   - whole-file rereads of the same path (38 rereads of the same Swift reducers)
 *
 * Lockfiles/generated paths are blocked; rereads only get a UI nudge.
 */

import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const LOCKFILES =
	/^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|go\.sum|poetry\.lock|uv\.lock|Gemfile\.lock|composer\.lock)$/;
const MINIFIED = /\.min\.(js|css)$/;
const GENERATED_DIR = /\/(dist|build|node_modules)\//;

const REREAD_NUDGE_AT = 3;

export function isBlockedReadPath(path: string): boolean {
	const base = basename(path);
	return (
		LOCKFILES.test(base) || MINIFIED.test(base) || GENERATED_DIR.test(path)
	);
}

export default function (pi: ExtensionAPI) {
	let wholeReads = new Map<string, number>();
	const reset = () => {
		wholeReads = new Map();
	};
	pi.on("session_start", async () => reset());
	pi.on("session_switch", async () => reset());

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "read") return;
		const path = event.input.path as string;
		if (!path) return;

		if (isBlockedReadPath(path)) {
			return {
				block: true,
				reason: `Blocked: ${basename(path)} is a lockfile/generated file; \`rg\` the one line you need instead.`,
			};
		}

		const isWholeFile = event.input.offset == null && event.input.limit == null;
		if (!isWholeFile) return;

		const n = (wholeReads.get(path) ?? 0) + 1;
		wholeReads.set(path, n);
		if (n < REREAD_NUDGE_AT || !ctx.hasUI) return;
		ctx.ui.notify(
			`reread #${n} of ${basename(path)}: use offset/limit`,
			"warning",
		);
	});
}
