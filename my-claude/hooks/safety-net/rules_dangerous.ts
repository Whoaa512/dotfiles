/**
 * Detection rules for dangerous shell patterns:
 * - Pipe-to-shell (curl | bash, wget | sh)
 * - Fork bombs
 * - Encoded payload to shell (base64 -d | bash)
 * - Git history destruction (reflog delete, gc --prune=now)
 * - Secure delete commands (shred --remove, srm)
 */

import { basename } from "path";
import { shortOpts } from "./shell.js";

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);

const REASON_PIPE_TO_SHELL =
  "Piping remote content directly to a shell is dangerous. Download first, review, then execute.";

const REASON_PROCESS_SUB_SHELL =
  "Process substitution with remote content is dangerous. Download first, review, then execute.";

const REASON_FORK_BOMB =
  "This appears to be a fork bomb pattern which will exhaust system resources.";

const REASON_DECODE_TO_SHELL =
  "Decoding and piping to shell can execute hidden malicious code. Decode first, review, then execute.";

const REASON_GIT_REFLOG_DELETE =
  "git reflog delete permanently removes recovery points. This makes commits unrecoverable.";

const REASON_GIT_GC_PRUNE_NOW =
  "git gc --prune=now immediately removes unreferenced objects. Use --prune=2.weeks.ago for safety.";

const REASON_SECURE_DELETE =
  "Secure delete commands permanently destroy files beyond recovery. Verify targets carefully.";

const REASON_DD_DEVICE =
  "dd writing to a device can destroy disk data. Verify the output file path carefully.";

const REASON_GIT_FILTER_BRANCH_FORCE =
  "git filter-branch --force rewrites history destructively. Back up refs first.";

function normalizeCmd(token: string): string {
  return basename(token).toLowerCase();
}

/**
 * Detect curl/wget piped to shell patterns.
 * @param tokens - Parsed tokens from the left side of a pipe
 * @param pipeTarget - The command on the right side of the pipe (or null if no pipe)
 * @param fullSegment - The full command segment for process substitution detection
 */
export function analyzePipeToShell(
  tokens: string[],
  pipeTarget: string | null,
  fullSegment?: string
): string | null {
  if (!tokens.length) return null;

  const cmd = normalizeCmd(tokens[0]);

  // Process substitution: bash <(curl ...), source <(curl ...)
  if (fullSegment) {
    if (
      (SHELLS.has(cmd) || cmd === "source" || cmd === ".") &&
      /<\([^)]*(?:curl|wget)[^)]*\)/.test(fullSegment)
    ) {
      return REASON_PROCESS_SUB_SHELL;
    }
  }

  // No pipe target means no pipe-to-shell risk for curl/wget
  if (pipeTarget === null) return null;

  const targetCmd = normalizeCmd(pipeTarget);
  if (!SHELLS.has(targetCmd)) return null;

  // curl | shell
  if (cmd === "curl") {
    return REASON_PIPE_TO_SHELL;
  }

  // wget -O - | shell or wget -qO- | shell
  if (cmd === "wget") {
    const hasStdout = tokens.some((t) => {
      const lower = t.toLowerCase();
      return (
        t === "-O" ||
        t === "-" ||
        lower === "-o-" ||
        lower.startsWith("-qo-") ||
        lower.includes("o-")
      );
    });
    // wget to stdout patterns
    if (hasStdout || tokens.includes("-")) {
      return REASON_PIPE_TO_SHELL;
    }
    // Also block wget | shell even without explicit stdout flag
    // because some versions default to stdout in pipes
    return REASON_PIPE_TO_SHELL;
  }

  return null;
}

/**
 * Detect fork bomb patterns in command text.
 */
export function analyzeForkBomb(segment: string): string | null {
  // Normalize whitespace for pattern matching
  const normalized = segment.replace(/\s+/g, " ").trim();
  const noSpace = segment.replace(/\s+/g, "");

  // Classic :(){ :|:& };: pattern
  // Match variations: :(){:|:&};: or : (){ : | : & }; :
  if (/:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;?\s*:/.test(segment)) {
    return REASON_FORK_BOMB;
  }

  // Generic function fork bomb: name(){ name|name& };name
  // Match: f(){ f|f& };f or bomb(){ bomb|bomb& };bomb
  const funcForkBomb = /(\w+)\s*\(\s*\)\s*\{\s*\1\s*\|\s*\1\s*&\s*\}\s*;?\s*\1/;
  if (funcForkBomb.test(segment)) {
    return REASON_FORK_BOMB;
  }

  // While loop fork: while true; do $0 & done
  if (/while\s+(?:true|:|\[\s*1\s*\])\s*;\s*do\s+.*&\s*done/.test(normalized)) {
    return REASON_FORK_BOMB;
  }

  // Recursive background: $0 & $0 or "$0" & "$0"
  if (/\$0\s*&\s*\$0/.test(segment)) {
    return REASON_FORK_BOMB;
  }

  return null;
}

/**
 * Detect base64/xxd decode piped to shell.
 * @param tokens - Parsed tokens from the left side of a pipe
 * @param pipeTarget - The command on the right side of the pipe (or null if no pipe)
 */
export function analyzeDecodeToShell(
  tokens: string[],
  pipeTarget: string | null
): string | null {
  if (!tokens.length) return null;

  // No pipe target means no decode-to-shell risk
  if (pipeTarget === null) return null;

  const targetCmd = normalizeCmd(pipeTarget);
  if (!SHELLS.has(targetCmd)) return null;

  const cmd = normalizeCmd(tokens[0]);
  const opts = shortOpts(tokens);
  const tokenLower = tokens.map((t) => t.toLowerCase());

  // base64 decode: base64 -d, base64 --decode, base64 -D (macOS)
  if (cmd === "base64") {
    const isDecoding =
      opts.has("d") ||
      opts.has("D") ||
      tokenLower.includes("--decode") ||
      tokenLower.includes("-d") ||
      tokenLower.includes("-D");
    if (isDecoding) {
      return REASON_DECODE_TO_SHELL;
    }
    return null;
  }

  // xxd reverse: xxd -r or xxd -rp
  if (cmd === "xxd") {
    const isReverse = opts.has("r") || tokenLower.some((t) => t.startsWith("-r"));
    if (isReverse) {
      return REASON_DECODE_TO_SHELL;
    }
    return null;
  }

  return null;
}

/**
 * Detect git history destruction commands.
 */
export function analyzeGitHistory(tokens: string[]): string | null {
  if (!tokens.length || normalizeCmd(tokens[0]) !== "git") return null;
  if (tokens.length < 2) return null;

  const subcommand = tokens[1].toLowerCase();

  // git reflog delete
  if (subcommand === "reflog") {
    if (tokens.length >= 3 && tokens[2].toLowerCase() === "delete") {
      return REASON_GIT_REFLOG_DELETE;
    }
    return null;
  }

  // git gc --prune=now or --prune=all
  if (subcommand === "gc") {
    for (const tok of tokens.slice(2)) {
      const lower = tok.toLowerCase();
      if (lower.startsWith("--prune=")) {
        const value = lower.slice("--prune=".length);
        if (value === "now" || value === "all") {
          return REASON_GIT_GC_PRUNE_NOW;
        }
      }
    }
    return null;
  }

  return null;
}

/**
 * Detect secure delete commands (shred --remove, srm).
 */
export function analyzeSecureDelete(tokens: string[]): string | null {
  if (!tokens.length) return null;

  const cmd = normalizeCmd(tokens[0]);
  const opts = shortOpts(tokens);
  const tokenLower = tokens.map((t) => t.toLowerCase());

  // srm is always dangerous
  if (cmd === "srm") {
    return REASON_SECURE_DELETE;
  }

  // shred --remove or -u deletes after overwriting
  if (cmd === "shred") {
    const removes =
      opts.has("u") ||
      tokenLower.includes("--remove") ||
      tokenLower.includes("-u");
    if (removes) {
      return REASON_SECURE_DELETE;
    }
    return null;
  }

  return null;
}

/**
 * Detect dd writing to device files (of=/dev/*).
 */
export function analyzeDdDevice(tokens: string[]): string | null {
  if (!tokens.length) return null;

  const cmd = normalizeCmd(tokens[0]);
  if (cmd !== "dd") return null;

  for (const tok of tokens.slice(1)) {
    // dd uses of=path syntax
    if (tok.startsWith("of=")) {
      const target = tok.slice(3);
      if (target.startsWith("/dev/")) {
        return REASON_DD_DEVICE;
      }
    }
  }

  return null;
}

/**
 * Detect git filter-branch --force (history rewrite).
 */
export function analyzeGitFilterBranch(tokens: string[]): string | null {
  if (!tokens.length || normalizeCmd(tokens[0]) !== "git") return null;
  if (tokens.length < 2) return null;

  const subcommand = tokens[1].toLowerCase();
  if (subcommand !== "filter-branch") return null;

  // Check for --force or -f
  for (const tok of tokens.slice(2)) {
    const lower = tok.toLowerCase();
    if (lower === "--force" || lower === "-f") {
      return REASON_GIT_FILTER_BRANCH_FORCE;
    }
  }

  return null;
}
