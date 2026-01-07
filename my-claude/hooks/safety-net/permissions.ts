/**
 * Parse and match Claude Code permissions allow/deny patterns.
 *
 * Pattern format:
 *   - "Bash(cmd)" - exact match for command "cmd"
 *   - "Bash(cmd:*)" - prefix match for commands starting with "cmd"
 *
 * Matching logic:
 *   1. If command matches any deny pattern -> not pre-approved
 *   2. If command matches any allow pattern -> pre-approved (skip analysis)
 *   3. Otherwise -> not pre-approved (run full analysis)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface Settings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
}

export interface ParsedPattern {
  prefix: string;
  isWildcard: boolean;
}

export function parseBashPattern(pattern: string): ParsedPattern | null {
  // Match "Bash(something)" or "Bash(something:*)"
  const match = pattern.match(/^Bash\((.+)\)$/);
  if (!match) return null;

  const inner = match[1];
  if (inner.endsWith(":*")) {
    return {
      prefix: inner.slice(0, -2),
      isWildcard: true,
    };
  }
  return {
    prefix: inner,
    isWildcard: false,
  };
}

export function commandMatchesPattern(command: string, pattern: ParsedPattern): boolean {
  const trimmed = command.trim();
  if (pattern.isWildcard) {
    return trimmed.startsWith(pattern.prefix);
  }
  return trimmed === pattern.prefix;
}

// Shell operators that indicate chained/piped commands
const SHELL_OPERATORS = /[;&|]|\|\|/;

export function isSimpleCommand(command: string): boolean {
  // Quick check: if command contains shell operators, it's not simple
  // This is conservative - we'd rather run analysis on edge cases
  return !SHELL_OPERATORS.test(command);
}

export function loadSettings(cwd: string | null): Settings | null {
  // Check project settings first, then global
  const paths: string[] = [];
  if (cwd) {
    paths.push(join(cwd, ".claude", "settings.json"));
    paths.push(join(cwd, ".claude", "settings.local.json"));
  }
  paths.push(join(homedir(), ".claude", "settings.json"));
  paths.push(join(homedir(), ".claude", "settings.local.json"));

  // Merge all settings files (later files override)
  let merged: Settings = {};
  for (const p of paths.reverse()) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, "utf-8");
        const parsed = JSON.parse(content) as Settings;
        if (parsed.permissions) {
          merged.permissions = {
            allow: [...(merged.permissions?.allow || []), ...(parsed.permissions.allow || [])],
            deny: [...(merged.permissions?.deny || []), ...(parsed.permissions.deny || [])],
          };
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return merged.permissions ? merged : null;
}

export function checkCommandAgainstPatterns(
  command: string,
  allow: string[],
  deny: string[]
): boolean {
  // Only bypass analysis for simple commands (no pipes, chains, etc.)
  // Chained commands like "ls && rm -rf /" should always go through full analysis
  if (!isSimpleCommand(command)) {
    return false;
  }

  // Parse all patterns
  const denyPatterns = deny.map(parseBashPattern).filter((p): p is ParsedPattern => p !== null);
  const allowPatterns = allow.map(parseBashPattern).filter((p): p is ParsedPattern => p !== null);

  // Check deny first - if matches deny, not pre-approved
  for (const pattern of denyPatterns) {
    if (commandMatchesPattern(command, pattern)) {
      return false;
    }
  }

  // Check allow
  for (const pattern of allowPatterns) {
    if (commandMatchesPattern(command, pattern)) {
      return true;
    }
  }

  return false;
}

export function isCommandPreApproved(command: string, cwd: string | null): boolean {
  const settings = loadSettings(cwd);
  if (!settings?.permissions) return false;

  const { allow = [], deny = [] } = settings.permissions;
  return checkCommandAgainstPatterns(command, allow, deny);
}
