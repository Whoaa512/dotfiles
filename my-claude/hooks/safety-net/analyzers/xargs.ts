/**
 * xargs command parsing and analysis.
 */

import { normalizeCmdToken } from "../normalize.js";

/**
 * Extract the child command from xargs invocation.
 * Returns tokens after xargs options, or null if none found.
 */
export function extractXargsChildCommand(tokens: string[]): string[] | null {
  if (!tokens.length || normalizeCmdToken(tokens[0]) !== "xargs") return null;

  const consumesValue = new Set([
    "-a", "-I", "-J", "-L", "-l", "-n", "-R", "-S", "-s", "-P", "-d", "-E",
    "--arg-file", "--delimiter", "--eof", "--max-args", "--max-lines",
    "--max-procs", "--max-chars", "--process-slot-var",
  ]);

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === "--") {
      i++;
      break;
    }
    if (!tok.startsWith("-") || tok === "-") break;

    if (tok.startsWith("--")) {
      if (consumesValue.has(tok)) {
        i += 2;
        continue;
      }
      const longOptsWithValue = [
        "--arg-file=", "--delimiter=", "--max-args=", "--max-lines=",
        "--max-procs=", "--max-chars=", "--process-slot-var=", "--eof=",
      ];
      if (longOptsWithValue.some((opt) => tok.startsWith(opt))) {
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (tok === "-i") {
      i++;
      continue;
    }
    if (consumesValue.has(tok)) {
      i += 2;
      continue;
    }

    const attachedForms = ["-I", "-i", "-n", "-P", "-L", "-R", "-S", "-s", "-a", "-d", "-E", "-J"];
    if (attachedForms.some((f) => tok.startsWith(f) && tok.length > f.length)) {
      i++;
      continue;
    }

    i++;
  }

  if (i >= tokens.length) return null;
  return tokens.slice(i);
}

/**
 * Extract replacement tokens from xargs (-I, -J, -i).
 * Returns set of placeholder strings like "{}" or custom ones.
 */
export function xargsReplacementTokens(tokens: string[]): Set<string> {
  if (!tokens.length || normalizeCmdToken(tokens[0]) !== "xargs") return new Set();

  const repl = new Set<string>();
  let i = 1;

  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === "--") break;
    if (!tok.startsWith("-") || tok === "-") break;

    if (tok === "-I" || tok === "-J") {
      if (i + 1 < tokens.length) {
        repl.add(tokens[i + 1]);
        i += 2;
        continue;
      }
      break;
    }

    if ((tok.startsWith("-I") || tok.startsWith("-J")) && tok.length > 2) {
      repl.add(tok.slice(2));
      i++;
      continue;
    }

    if (tok === "-i") {
      repl.add("{}");
      i++;
      continue;
    }
    if (tok.startsWith("-i") && tok.length > 2) {
      repl.add(tok.slice(2));
      i++;
      continue;
    }

    if (["--replace", "--replace=", "--replace-str"].includes(tok)) {
      repl.add("{}");
      i++;
      continue;
    }
    if (tok.startsWith("--replace=")) {
      repl.add(tok.split("=", 2)[1] || "{}");
      i++;
      continue;
    }

    i++;
  }

  return repl;
}
