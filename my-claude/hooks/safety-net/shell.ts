/**
 * Shell parsing helpers for the safety net.
 */

import { shlexSplit as shlexSplitNative } from "./shlex.js";

export function splitShellCommands(command: string): string[] {
  const parts: string[] = [];
  const buf: string[] = [];
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  let i = 0;
  while (i < command.length) {
    const ch = command[i];

    if (escape) {
      buf.push(ch);
      escape = false;
      i++;
      continue;
    }

    if (ch === "\\" && !inSingle) {
      buf.push(ch);
      escape = true;
      i++;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      buf.push(ch);
      i++;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      buf.push(ch);
      i++;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (command.startsWith("&&", i) || command.startsWith("||", i)) {
        const part = buf.join("").trim();
        if (part) parts.push(part);
        buf.length = 0;
        i += 2;
        continue;
      }
      if (command.startsWith("|&", i)) {
        const part = buf.join("").trim();
        if (part) parts.push(part);
        buf.length = 0;
        i += 2;
        continue;
      }
      if (ch === "|") {
        const part = buf.join("").trim();
        if (part) parts.push(part);
        buf.length = 0;
        i++;
        continue;
      }
      if (ch === "&") {
        const prev = i > 0 ? command[i - 1] : "";
        const nxt = i + 1 < command.length ? command[i + 1] : "";
        if (prev === ">" || prev === "<" || nxt === ">") {
          buf.push(ch);
          i++;
          continue;
        }
        const part = buf.join("").trim();
        if (part) parts.push(part);
        buf.length = 0;
        i++;
        continue;
      }
      if (ch === ";" || ch === "\n") {
        const part = buf.join("").trim();
        if (part) parts.push(part);
        buf.length = 0;
        i++;
        continue;
      }
    }

    buf.push(ch);
    i++;
  }

  const part = buf.join("").trim();
  if (part) parts.push(part);
  return parts;
}

export function shlexSplit(segment: string): string[] | null {
  return shlexSplitNative(segment);
}

function stripEnvAssignments(tokens: string[]): string[] {
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const eqIdx = tok.indexOf("=");
    if (eqIdx < 0) break;
    const key = tok.slice(0, eqIdx);
    if (!key || !/^[a-zA-Z_]/.test(key)) break;
    if (!/^[a-zA-Z0-9_]+$/.test(key)) break;
    i++;
  }
  return tokens.slice(i);
}

export function stripWrappers(tokens: string[]): string[] {
  let previous: string[] | null = null;
  let depth = 0;

  while (tokens.length && !arraysEqual(tokens, previous) && depth < 20) {
    previous = [...tokens];
    depth++;

    tokens = stripEnvAssignments(tokens);
    if (!tokens.length) return tokens;

    const head = tokens[0].toLowerCase();

    if (head === "sudo") {
      const sudoFlagsWithArgs = new Set(["-u", "-g", "-C", "-D", "-h", "-p", "-R", "-T", "-U"]);
      let i = 1;
      while (i < tokens.length) {
        const tok = tokens[i];
        if (tok === "--") {
          i++;
          break;
        }
        if (!tok.startsWith("-")) break;
        if (sudoFlagsWithArgs.has(tok)) {
          i += 2;
          continue;
        }
        i++;
      }
      tokens = tokens.slice(i);
      continue;
    }

    if (head === "env") {
      let i = 1;
      while (i < tokens.length) {
        const tok = tokens[i];
        if (tok === "--") {
          i++;
          break;
        }
        if (["-u", "--unset", "-C", "-P", "-S"].includes(tok)) {
          i += 2;
          continue;
        }
        if (tok.startsWith("--unset=") || tok.startsWith("-u") || tok.startsWith("-C") || tok.startsWith("-P") || tok.startsWith("-S")) {
          if (tok.length > 2) {
            i++;
            continue;
          }
        }
        if (tok.startsWith("-") && tok !== "-") {
          i++;
          continue;
        }
        break;
      }
      tokens = tokens.slice(i);
      continue;
    }

    if (head === "command") {
      let i = 1;
      while (i < tokens.length) {
        const tok = tokens[i];
        if (tok === "--") {
          i++;
          break;
        }
        if (["-p", "-v", "-V"].includes(tok)) {
          i++;
          continue;
        }
        if (tok.startsWith("-") && tok !== "-" && !tok.startsWith("--")) {
          const chars = tok.slice(1);
          if (chars && [...chars].every((c) => ["p", "v", "V"].includes(c))) {
            i++;
            continue;
          }
        }
        break;
      }
      tokens = tokens.slice(i);
      continue;
    }

    break;
  }

  return stripEnvAssignments(tokens);
}

export function shortOpts(tokens: string[]): Set<string> {
  const opts = new Set<string>();
  for (const tok of tokens) {
    if (tok === "--") break;
    if (tok.startsWith("--") || !tok.startsWith("-") || tok === "-") continue;
    for (const ch of tok.slice(1)) {
      if (!/[a-zA-Z]/.test(ch)) break;
      opts.add(ch);
    }
  }
  return opts;
}

function arraysEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Extract the argument to -c flag from shell tokens.
 * Handles: sh -c 'cmd', bash -lc 'cmd', etc.
 */
export function extractDashCArg(tokens: string[]): string | null {
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "--") return null;
    if (tok === "-c") {
      return i + 1 < tokens.length ? tokens[i + 1] : null;
    }
    if (tok.startsWith("-") && tok.length > 1 && /^[a-z]+$/i.test(tok.slice(1))) {
      const letters = new Set(tok.slice(1));
      if (letters.has("c") && [...letters].every((c) => ["c", "l", "i", "s"].includes(c))) {
        return i + 1 < tokens.length ? tokens[i + 1] : null;
      }
    }
  }
  return null;
}
