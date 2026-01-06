/**
 * Git command analysis rules for the safety net.
 */

import { stripTokenWrappers } from "./normalize.js";
import { shortOpts } from "./shell.js";

const REASON_GIT_CHECKOUT_DOUBLE_DASH =
  "git checkout -- discards uncommitted changes permanently. Use 'git stash' first.";
const REASON_GIT_CHECKOUT_REF_DOUBLE_DASH =
  "git checkout <ref> -- <path> overwrites working tree. Use 'git stash' first.";
const REASON_GIT_CHECKOUT_REF_PATHSPEC =
  "git checkout <ref> <path> overwrites working tree. Use 'git stash' first.";
const REASON_GIT_CHECKOUT_PATHSPEC_FROM_FILE =
  "git checkout --pathspec-from-file overwrites working tree. Use 'git stash' first.";
const REASON_GIT_RESTORE =
  "git restore discards uncommitted changes. Use 'git stash' or 'git diff' first.";
const REASON_GIT_RESTORE_WORKTREE =
  "git restore --worktree discards uncommitted changes permanently.";
const REASON_GIT_RESET_HARD =
  "git reset --hard destroys uncommitted changes. Use 'git stash' first.";
const REASON_GIT_RESET_MERGE = "git reset --merge can lose uncommitted changes.";
const REASON_GIT_CLEAN_FORCE =
  "git clean -f removes untracked files permanently. Review with 'git clean -n' first.";
const REASON_GIT_PUSH_FORCE =
  "Force push can destroy remote history. Use --force-with-lease if necessary.";
const REASON_GIT_WORKTREE_REMOVE_FORCE =
  "git worktree remove --force can delete worktree files. Verify the path first.";
const REASON_GIT_BRANCH_DELETE_FORCE =
  "git branch -D force-deletes without merge check. Use -d for safety.";
const REASON_GIT_STASH_DROP =
  "git stash drop permanently deletes stashed changes. List stashes first with 'git stash list'.";
const REASON_GIT_STASH_CLEAR = "git stash clear permanently deletes ALL stashed changes.";

export function analyzeGit(tokens: string[]): string | null {
  const [sub, rest] = gitSubcommandAndRest(tokens);
  if (!sub) return null;

  const subLower = stripTokenWrappers(sub).toLowerCase();
  const restNormalized = rest.map(stripTokenWrappers);
  const restLower = restNormalized.map((t) => t.toLowerCase());
  const short = shortOpts(restNormalized);

  if (subLower === "checkout") {
    if (restNormalized.includes("--")) {
      const idx = restNormalized.indexOf("--");
      return idx === 0 ? REASON_GIT_CHECKOUT_DOUBLE_DASH : REASON_GIT_CHECKOUT_REF_DOUBLE_DASH;
    }
    if (restNormalized.includes("-b") || short.has("b")) return null;
    if (restNormalized.includes("-B") || short.has("B")) return null;
    if (restLower.includes("--orphan")) return null;

    const hasPathspecFromFile = restLower.some(
      (t) => t === "--pathspec-from-file" || t.startsWith("--pathspec-from-file=")
    );
    if (hasPathspecFromFile) return REASON_GIT_CHECKOUT_PATHSPEC_FROM_FILE;

    const positional = checkoutPositionalArgs(rest);
    if (positional.length >= 2) return REASON_GIT_CHECKOUT_REF_PATHSPEC;
    return null;
  }

  if (subLower === "restore") {
    if (restLower.includes("-h") || restLower.includes("--help") || restLower.includes("--version")) {
      return null;
    }
    if (restLower.includes("--worktree")) return REASON_GIT_RESTORE_WORKTREE;
    if (restLower.includes("--staged")) return null;
    return REASON_GIT_RESTORE;
  }

  if (subLower === "reset") {
    if (restLower.includes("--hard")) return REASON_GIT_RESET_HARD;
    if (restLower.includes("--merge")) return REASON_GIT_RESET_MERGE;
    return null;
  }

  if (subLower === "clean") {
    const hasForce = restLower.includes("--force") || short.has("f");
    if (hasForce) return REASON_GIT_CLEAN_FORCE;
    return null;
  }

  if (subLower === "push") {
    const hasForceWithLease = restLower.some((t) => t.startsWith("--force-with-lease"));
    const hasForce = restLower.includes("--force") || short.has("f");
    if (hasForce && !hasForceWithLease) return REASON_GIT_PUSH_FORCE;
    if (restLower.includes("--force") && hasForceWithLease) return REASON_GIT_PUSH_FORCE;
    if (short.has("f") && hasForceWithLease) return REASON_GIT_PUSH_FORCE;
    return null;
  }

  if (subLower === "worktree") {
    if (!restLower.length) return null;
    if (restLower[0] !== "remove") return null;

    let restForOpts = rest;
    if (rest.includes("--")) {
      restForOpts = rest.slice(0, rest.indexOf("--"));
    }
    const restForOptsLower = restForOpts.map((t) => t.toLowerCase());
    const shortForOpts = shortOpts(restForOpts);
    const hasForce = restForOptsLower.includes("--force") || shortForOpts.has("f");
    if (hasForce) return REASON_GIT_WORKTREE_REMOVE_FORCE;
    return null;
  }

  if (subLower === "branch") {
    if (rest.includes("-D") || short.has("D")) return REASON_GIT_BRANCH_DELETE_FORCE;
    if (rest.includes("-d") || short.has("d")) return null;
    return null;
  }

  if (subLower === "stash") {
    if (!restLower.length) return null;
    if (restLower[0] === "drop") return REASON_GIT_STASH_DROP;
    if (restLower[0] === "clear") return REASON_GIT_STASH_CLEAR;
    return null;
  }

  return null;
}

function gitSubcommandAndRest(tokens: string[]): [string | null, string[]] {
  if (!tokens.length || tokens[0].toLowerCase() !== "git") {
    return [null, []];
  }

  const optsWithValue = new Set(["-c", "-C", "--exec-path", "--git-dir", "--namespace", "--super-prefix", "--work-tree"]);
  const optsNoValue = new Set(["-p", "-P", "-h", "--help", "--no-pager", "--paginate", "--version", "--bare", "--no-replace-objects", "--literal-pathspecs", "--noglob-pathspecs", "--icase-pathspecs"]);

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === "--") {
      i++;
      break;
    }

    if (!tok.startsWith("-") || tok === "-") break;

    if (optsNoValue.has(tok)) {
      i++;
      continue;
    }

    if (optsWithValue.has(tok)) {
      i += 2;
      continue;
    }

    if (tok.startsWith("--")) {
      if (tok.includes("=")) {
        const opt = tok.split("=")[0];
        if (optsWithValue.has(opt)) {
          i++;
          continue;
        }
      }
      i++;
      continue;
    }

    if (tok.startsWith("-C") && tok.length > 2) {
      i++;
      continue;
    }
    if (tok.startsWith("-c") && tok.length > 2) {
      i++;
      continue;
    }

    i++;
  }

  if (i >= tokens.length) return [null, []];
  return [tokens[i], tokens.slice(i + 1)];
}

function checkoutPositionalArgs(rest: string[]): string[] {
  const optsWithValue = new Set(["-b", "-B", "--orphan", "--conflict", "-U", "--unified", "--inter-hunk-context", "--pathspec-from-file"]);
  const optsNoValue = new Set(["-f", "--force", "-m", "--merge", "-q", "--quiet", "--detach", "--ignore-skip-worktree-bits", "--overwrite-ignore", "--no-overlay", "--overlay", "--progress", "--no-progress", "--guess", "--no-guess", "--pathspec-file-nul"]);

  const positionals: string[] = [];
  let i = 0;
  while (i < rest.length) {
    const tok = rest[i];
    if (tok === "--") break;

    if (tok === "-") {
      positionals.push(tok);
      i++;
      continue;
    }

    if (tok.startsWith("-")) {
      if (optsNoValue.has(tok)) {
        i++;
        continue;
      }

      if (tok.startsWith("--") && tok.includes("=")) {
        const opt = tok.split("=")[0];
        if (optsWithValue.has(opt)) {
          i++;
          continue;
        }
        i++;
        continue;
      }

      if (tok.startsWith("-U") && tok.length > 2) {
        i++;
        continue;
      }
      if (tok.startsWith("-b") && tok.length > 2) {
        i++;
        continue;
      }
      if (tok.startsWith("-B") && tok.length > 2) {
        i++;
        continue;
      }

      if (optsWithValue.has(tok)) {
        i += 2;
        continue;
      }

      if (tok === "--recurse-submodules") {
        if (i + 1 < rest.length && ["checkout", "on-demand"].includes(rest[i + 1])) {
          i += 2;
          continue;
        }
        i++;
        continue;
      }
      if (tok === "-t" || tok === "--track") {
        if (i + 1 < rest.length && ["direct", "inherit"].includes(rest[i + 1])) {
          i += 2;
          continue;
        }
        i++;
        continue;
      }

      if (tok.startsWith("--")) {
        if (i + 1 < rest.length && !rest[i + 1].startsWith("-")) {
          i += 2;
          continue;
        }
        i++;
        continue;
      }

      i++;
      continue;
    }

    positionals.push(tok);
    i++;
  }

  return positionals;
}
