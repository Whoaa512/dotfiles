/**
 * TypeScript implementation of Python's shlex.split(s, posix=True)
 *
 * State machine states:
 * - 'space': between tokens, consuming whitespace
 * - 'word': building a token
 * - 'single': inside single quotes (literal)
 * - 'double': inside double quotes (some escapes)
 * - 'escape': after backslash outside quotes
 * - 'escape_double': after backslash inside double quotes
 */

type State =
	| "space"
	| "word"
	| "single"
	| "double"
	| "escape"
	| "escape_double";

const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);
const DOUBLE_ESCAPABLE = new Set(["\\", '"', "$", "`", "\n"]);

export function shlexSplit(s: string): string[] | null {
	const tokens: string[] = [];
	let token = "";
	let state: State = "space";

	for (let i = 0; i < s.length; i++) {
		const ch = s[i];

		switch (state) {
			case "space":
				if (WHITESPACE.has(ch)) {
					continue;
				}
				if (ch === "'") {
					state = "single";
					continue;
				}
				if (ch === '"') {
					state = "double";
					continue;
				}
				if (ch === "\\") {
					state = "escape";
					continue;
				}
				// Start a new token
				token = ch;
				state = "word";
				break;

			case "word":
				if (WHITESPACE.has(ch)) {
					tokens.push(token);
					token = "";
					state = "space";
					continue;
				}
				if (ch === "'") {
					state = "single";
					continue;
				}
				if (ch === '"') {
					state = "double";
					continue;
				}
				if (ch === "\\") {
					state = "escape";
					continue;
				}
				token += ch;
				break;

			case "single":
				// Inside single quotes: everything is literal until closing quote
				if (ch === "'") {
					state = "word";
					continue;
				}
				token += ch;
				break;

			case "double":
				// Inside double quotes: backslash only escapes certain chars
				if (ch === '"') {
					state = "word";
					continue;
				}
				if (ch === "\\") {
					state = "escape_double";
					continue;
				}
				token += ch;
				break;

			case "escape":
				// Backslash outside quotes: escaped char is literal
				// Escaped newline is line continuation (skip both)
				if (ch === "\n") {
					state = "word";
					continue;
				}
				token += ch;
				state = "word";
				break;

			case "escape_double":
				// Backslash inside double quotes
				if (DOUBLE_ESCAPABLE.has(ch)) {
					// Escaped newline is line continuation
					if (ch === "\n") {
						state = "double";
						continue;
					}
					token += ch;
				} else {
					// Backslash is literal if not followed by escapable char
					token += `\\${ch}`;
				}
				state = "double";
				break;
		}
	}

	// Handle end of input
	if (state === "single" || state === "double") {
		// Unclosed quotes
		return null;
	}

	if (state === "escape" || state === "escape_double") {
		// Trailing backslash - treat as literal
		token += "\\";
	}

	if (token || state === "word") {
		tokens.push(token);
	}

	return tokens;
}
