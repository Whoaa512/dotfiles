/**
 * Token normalization utilities for safety-net.
 *
 * Consolidates various normalization functions used across the codebase:
 * - stripTokenWrappers (safety-net.ts) - strips $(), backticks, brackets
 * - normalizeArg (rules_git.ts) - strips shell wrappers from args
 * - normalizeCmdToken (safety-net.ts) - full normalization for command matching
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
 * Normalize an argument by stripping shell wrappers.
 * Alias for stripTokenWrappers for backwards compatibility.
 */
export function normalizeArg(arg: string): string {
  return stripTokenWrappers(arg);
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
