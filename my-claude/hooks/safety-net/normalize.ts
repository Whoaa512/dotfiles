/**
 * Token normalization utilities for safety-net.
 *
 * - stripTokenWrappers: strips $(), backticks, brackets
 * - normalizeCmdToken: full normalization for command matching
 * - normalizeCmd: simple basename + lowercase
 */

import { basename } from "path";

/**
 * Strip shell wrappers from a token: $(), backticks, brackets, escapes.
 * Used for matching tokens that may be wrapped in command substitution.
 */
export function stripTokenWrappers(token: string): string {
	let tok = token.trim();
	// Strip leading $( for command substitution
	while (tok.startsWith("$(")) {
		tok = tok.slice(2);
	}
	// Strip leading shell wrappers: backslash, backtick, parens, braces, brackets
	tok = tok.replace(/^[\\`({[]+/, "");
	// Strip trailing shell wrappers
	tok = tok.replace(/[`)}\\]]+$/, "");
	return tok;
}

/**
 * Full normalization for command token matching:
 * 1. Strip wrappers
 * 2. Remove trailing semicolons
 * 3. Lowercase
 * 4. Extract basename (handle paths like /usr/bin/rm)
 */
export function normalizeCmdToken(token: string): string {
	let tok = stripTokenWrappers(token);
	tok = tok.replace(/;+$/, "");
	tok = tok.toLowerCase();
	tok = basename(tok);
	return tok;
}

/**
 * Simple basename + lowercase normalization for command matching.
 * Used when token is already clean (no wrappers).
 */
export function normalizeCmd(token: string): string {
	return basename(token).toLowerCase();
}
