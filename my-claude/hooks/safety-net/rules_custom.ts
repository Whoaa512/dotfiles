/**
 * Custom rule matching logic.
 */

import { basename } from "path";
import { CustomRule } from "./config.js";
import { shortOpts } from "./shell.js";

function normalizeCommand(token: string): string {
  return basename(token);
}

function extractSubcommand(tokens: string[]): string | null {
  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === "--") {
      i++;
      if (i < tokens.length) return tokens[i];
      return null;
    }

    if (tok.startsWith("--")) {
      i++;
      continue;
    }

    if (tok.startsWith("-") && tok.length >= 2) {
      i++;
      continue;
    }

    return tok;
  }

  return null;
}

export function checkCustomRules(tokens: string[], rules: CustomRule[]): string | null {
  if (!tokens.length || !rules.length) return null;

  const command = normalizeCommand(tokens[0]);
  const subcommand = extractSubcommand(tokens);
  const tokenSet = new Set(tokens);
  const short = shortOpts(tokens);

  for (const rule of rules) {
    if (rule.command !== command) continue;

    if (rule.subcommand !== null) {
      if (subcommand !== rule.subcommand) continue;
    }

    for (const blockedArg of rule.blockArgs) {
      if (tokenSet.has(blockedArg)) {
        return `[${rule.name}] ${rule.reason}`;
      }

      if (
        blockedArg.length === 2 &&
        blockedArg[0] === "-" &&
        blockedArg[1] !== "-" &&
        short.has(blockedArg[1])
      ) {
        return `[${rule.name}] ${rule.reason}`;
      }
    }
  }

  return null;
}
