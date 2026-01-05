/**
 * Filesystem (rm) command analysis rules for the safety net.
 */

import { basename, normalize, join } from "path";
import { shortOpts } from "./shell.js";

const REASON_RM_RF = "rm -rf is destructive. List files first, then delete individually.";
const REASON_RM_RF_ROOT_HOME = "rm -rf on root or home paths is extremely dangerous.";
const PARANOID_SUFFIX = " [paranoid mode - disable with: unset SAFETY_NET_PARANOID SAFETY_NET_PARANOID_RM]";

export function analyzeRm(
  tokens: string[],
  options: {
    allowTmpdirVar?: boolean;
    cwd?: string | null;
    paranoid?: boolean;
  } = {}
): string | null {
  const { allowTmpdirVar = true, cwd = null, paranoid = false } = options;
  const rest = tokens.slice(1);

  const opts: string[] = [];
  for (const tok of rest) {
    if (tok === "--") break;
    opts.push(tok);
  }

  const optsLower = opts.map((t) => t.toLowerCase());
  const short = shortOpts(opts);
  const recursive = optsLower.includes("--recursive") || short.has("r") || short.has("R");
  const force = optsLower.includes("--force") || short.has("f");

  if (!(recursive && force)) return null;

  const targets = rmTargets(tokens);
  if (targets.some(isRootOrHomePath)) {
    return REASON_RM_RF_ROOT_HOME;
  }

  if (cwd && targets.some((t) => isCwdItself(t, cwd))) {
    return REASON_RM_RF;
  }

  if (targets.length && targets.every((t) => isTempPath(t, { allowTmpdirVar }))) {
    return null;
  }

  if (paranoid) {
    return REASON_RM_RF + PARANOID_SUFFIX;
  }

  if (cwd && targets.length) {
    const home = process.env.HOME;
    if (home && normalize(cwd) === normalize(home)) {
      return REASON_RM_RF_ROOT_HOME;
    }
    if (targets.every((t) => isPathWithinCwd(t, cwd))) {
      return null;
    }
  }
  return REASON_RM_RF;
}

function isCwdItself(path: string, cwd: string): boolean {
  const normalized = normalize(path);
  if (normalized === "." || normalized === "") return true;

  let resolved: string;
  if (path.startsWith("/")) {
    resolved = normalize(path);
  } else {
    resolved = normalize(join(cwd, path));
  }

  return resolved === normalize(cwd);
}

function isPathWithinCwd(path: string, cwd: string): boolean {
  if (path.startsWith("~") || path.startsWith("$HOME") || path.startsWith("${HOME}")) {
    return false;
  }

  if (path.includes("$") || path.includes("`")) {
    return false;
  }

  const normalized = normalize(path);
  if (normalized === "." || normalized === "") return false;

  let resolved: string;
  if (path.startsWith("/")) {
    resolved = normalize(path);
  } else {
    resolved = normalize(join(cwd, path));
  }

  const cwdNormalized = normalize(cwd);
  if (resolved === cwdNormalized) return false;

  return resolved.startsWith(cwdNormalized + "/");
}

function rmTargets(tokens: string[]): string[] {
  const targets: string[] = [];
  let afterDoubleDash = false;
  for (const tok of tokens.slice(1)) {
    if (afterDoubleDash) {
      targets.push(tok);
      continue;
    }
    if (tok === "--") {
      afterDoubleDash = true;
      continue;
    }
    if (tok.startsWith("-") && tok !== "-") continue;
    targets.push(tok);
  }
  return targets;
}

function isTempPath(path: string, options: { allowTmpdirVar: boolean }): boolean {
  if (path.startsWith("/")) {
    const normalized = normalize(path);
    return (
      normalized === "/tmp" ||
      normalized.startsWith("/tmp/") ||
      normalized === "/var/tmp" ||
      normalized.startsWith("/var/tmp/")
    );
  }

  if (!options.allowTmpdirVar) return false;

  for (const prefix of ["$TMPDIR", "${TMPDIR}"]) {
    if (path === prefix) return true;
    if (path.startsWith(prefix + "/")) {
      const rest = path.slice(prefix.length + 1);
      if (rest.split("/").includes("..")) return false;
      return true;
    }
  }

  return false;
}

function isRootOrHomePath(path: string): boolean {
  return (
    path === "/" ||
    (path.startsWith("/") && normalize(path) === "/") ||
    path === "~" ||
    path.startsWith("~/") ||
    path === "$HOME" ||
    path.startsWith("$HOME/") ||
    path.startsWith("${HOME}")
  );
}
