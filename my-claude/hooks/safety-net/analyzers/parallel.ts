/**
 * GNU parallel command parsing and analysis.
 */

import { normalizeCmdToken } from "../normalize.js";

export interface ParallelTemplateResult {
  template: string[];
  args: string[];
  argsDynamic: boolean;
}

/**
 * Extract template and args from parallel invocation.
 * @returns Template tokens, args after :::, and whether args come from stdin
 */
export function extractParallelTemplateAndArgs(
  tokens: string[]
): ParallelTemplateResult | null {
  if (!tokens.length || normalizeCmdToken(tokens[0]) !== "parallel") return null;

  const argsDynamic = !tokens.includes(":::");
  let marker: number;
  let args: string[];

  if (argsDynamic) {
    marker = tokens.length;
    args = [];
  } else {
    marker = tokens.indexOf(":::");
    args = tokens.slice(marker + 1);
  }

  const consumesValue = new Set([
    "-j", "--jobs", "-S", "--sshlogin", "--sshloginfile", "--results",
    "--joblog", "--workdir", "--tmpdir", "--tempdir", "--tagstring",
  ]);

  let i = 1;
  while (i < marker) {
    const tok = tokens[i];
    if (tok === "--") {
      i++;
      break;
    }
    if (!tok.startsWith("-") || tok === "-") break;

    if (consumesValue.has(tok)) {
      i += 2;
      continue;
    }

    if (tok.startsWith("--")) {
      const longOptsWithValue = [
        "--jobs=", "--sshlogin=", "--sshloginfile=", "--results=",
        "--joblog=", "--workdir=", "--tmpdir=", "--tempdir=", "--tagstring=",
      ];
      if (longOptsWithValue.some((opt) => tok.startsWith(opt))) {
        i++;
        continue;
      }
      i++;
      continue;
    }

    if ((tok.startsWith("-j") || tok.startsWith("-S")) && tok.length > 2) {
      i++;
      continue;
    }

    i++;
  }

  const template = tokens.slice(i, marker);
  return { template, args, argsDynamic };
}
