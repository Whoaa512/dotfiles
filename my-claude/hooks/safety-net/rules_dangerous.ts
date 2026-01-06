/**
 * Detection rules for dangerous shell patterns:
 * - Pipe-to-shell (curl | bash, wget | sh)
 * - Fork bombs
 * - Encoded payload to shell (base64 -d | bash)
 * - Git history destruction (reflog delete, gc --prune=now)
 * - Secure delete commands (shred --remove, srm)
 * - Variable expansion bypass (${RM}, $CMD, -$R$F)
 */

import { normalizeCmd } from "./normalize.js";
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

const REASON_VARIABLE_CMD_BYPASS =
  "Variable expansion in command position can bypass safety checks. Use literal command names.";

const REASON_EVAL_DANGEROUS =
  "eval executing potentially dangerous commands. Evaluate the command string directly.";

const REASON_VARIABLE_FLAG_BYPASS =
  "Variable expansion in flags can construct dangerous options like -rf. Use literal flags.";

const REASON_CHMOD_WORLD_WRITABLE =
  "chmod -R 777/666 makes files world-writable recursively. This is a security risk.";

const REASON_CHOWN_SENSITIVE_PATH =
  "chown -R on sensitive system paths can break system ownership. Verify the target path.";

const REASON_FILESYSTEM_DESTRUCTION =
  "Filesystem creation/wiping commands destroy all data on the target device. Never run these.";

const REASON_BROADCAST_KILL =
  "This kills all user processes (PID -1 or no target), which will terminate your session and lose work.";

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

const DANGEROUS_IN_EVAL = [
  /rm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive\s+--force|--force\s+--recursive)/i,
  /git\s+(reset\s+--hard|clean\s+-f|push\s+--force|checkout\s+--)/i,
  /dd\s+.*of=/i,
  /\bshred\b.*(-u|--remove)/i,
];

function containsVariable(token: string): boolean {
  return /\$[A-Za-z_]|\$\{[^}]+\}/.test(token);
}

function isVariableOnly(token: string): boolean {
  const stripped = token.trim();
  return /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(stripped) ||
         /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(stripped);
}

/**
 * Detect variable expansion in command position that could bypass safety.
 * E.g., ${RM} -rf / or $CMD where CMD could be rm
 */
export function analyzeVariableCommand(tokens: string[], segment: string): string | null {
  if (!tokens.length) return null;

  const cmd = tokens[0];

  // Variable in command position: $CMD, ${RM}, etc.
  if (isVariableOnly(cmd)) {
    // Check if the rest looks dangerous
    const restJoined = tokens.slice(1).join(" ");
    if (/-rf\b|--recursive.*--force|--force.*--recursive/.test(restJoined)) {
      return REASON_VARIABLE_CMD_BYPASS;
    }
    // Check for dangerous-looking paths
    if (/\s\/\s*$|\s~\s*$|\s\/\*/.test(restJoined) || tokens.includes("/") || tokens.includes("~")) {
      return REASON_VARIABLE_CMD_BYPASS;
    }
  }

  return null;
}

/**
 * Detect eval with dangerous command strings.
 */
export function analyzeEval(tokens: string[], segment: string): string | null {
  if (!tokens.length) return null;

  const cmd = normalizeCmd(tokens[0]);
  if (cmd !== "eval") return null;

  // Get the eval argument (everything after eval)
  const evalArg = tokens.slice(1).join(" ");

  // Check for dangerous patterns in the eval string
  for (const pattern of DANGEROUS_IN_EVAL) {
    if (pattern.test(evalArg)) {
      return REASON_EVAL_DANGEROUS;
    }
  }

  // Also check if it contains dangerous patterns in the raw segment
  // (handles cases like eval 'rm -rf /')
  const quotedContent = segment.match(/eval\s+(['"])(.*?)\1/);
  if (quotedContent) {
    const content = quotedContent[2];
    for (const pattern of DANGEROUS_IN_EVAL) {
      if (pattern.test(content)) {
        return REASON_EVAL_DANGEROUS;
      }
    }
  }

  return null;
}

/**
 * Detect variable flag construction that could construct -rf.
 * E.g., R=r; F=f; rm -$R$F / or rm -${R}${F} /
 */
export function analyzeVariableFlags(tokens: string[], segment: string): string | null {
  if (!tokens.length) return null;

  const cmd = normalizeCmd(tokens[0]);

  // Only check rm for now (main concern)
  if (cmd !== "rm") return null;

  // Check flags for variable expansion patterns
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "--") break;
    if (!tok.startsWith("-")) continue;

    // Flag contains variable: -$R$F, -${R}${F}, etc.
    if (containsVariable(tok)) {
      // The flag after - contains variables that could construct -rf
      return REASON_VARIABLE_FLAG_BYPASS;
    }
  }

  return null;
}

const SENSITIVE_PATHS = ["/", "/etc", "/usr", "/var", "/home", "~"];

// Filesystem destruction commands - always block
const FILESYSTEM_DESTRUCTION_CMDS = new Set(["mkfs", "wipefs", "mkswap"]);

/**
 * Detect filesystem destruction commands (mkfs, wipefs, mkswap).
 * These destroy all data on the target device - block unconditionally.
 */
export function analyzeFilesystemDestruction(tokens: string[]): string | null {
  if (!tokens.length) return null;

  const cmd = normalizeCmd(tokens[0]);

  // Direct match: mkfs, wipefs, mkswap
  if (FILESYSTEM_DESTRUCTION_CMDS.has(cmd)) {
    return REASON_FILESYSTEM_DESTRUCTION;
  }

  // Match mkfs.* variants (mkfs.ext4, mkfs.xfs, mkfs.btrfs, etc.)
  if (cmd.startsWith("mkfs.")) {
    return REASON_FILESYSTEM_DESTRUCTION;
  }

  return null;
}

/**
 * Detect dangerous chmod patterns (world-writable recursive).
 * Blocks: chmod -R 777, chmod 777 -R, chmod -R 666
 */
export function analyzeChmod(tokens: string[]): string | null {
  if (!tokens.length) return null;

  const cmd = normalizeCmd(tokens[0]);
  if (cmd !== "chmod") return null;

  const opts = shortOpts(tokens);
  const hasRecursive = opts.has("R") || tokens.includes("--recursive");
  if (!hasRecursive) return null;

  // Check for dangerous modes: 777, 666
  for (const tok of tokens.slice(1)) {
    if (tok === "777" || tok === "666") {
      return REASON_CHMOD_WORLD_WRITABLE;
    }
  }

  return null;
}

/**
 * Detect dangerous chown -R on sensitive paths.
 * Blocks: chown -R on /, /etc, /usr, /var, /home, ~ and their subdirectories
 */
export function analyzeChown(tokens: string[]): string | null {
  if (!tokens.length) return null;

  const cmd = normalizeCmd(tokens[0]);
  if (cmd !== "chown") return null;

  const opts = shortOpts(tokens);
  const hasRecursive = opts.has("R") || tokens.includes("--recursive");
  if (!hasRecursive) return null;

  // Check for sensitive paths in arguments
  for (const tok of tokens.slice(1)) {
    if (tok.startsWith("-")) continue;
    // Normalize path for comparison
    const normalized = tok.replace(/\/+$/, "") || "/";
    if (SENSITIVE_PATHS.includes(normalized)) {
      return REASON_CHOWN_SENSITIVE_PATH;
    }
    // Also catch subdirectories of sensitive paths
    for (const sensitive of SENSITIVE_PATHS) {
      if (sensitive === "/" || sensitive === "~") continue; // Already checked above
      if (normalized.startsWith(sensitive + "/")) {
        return REASON_CHOWN_SENSITIVE_PATH;
      }
    }
  }

  return null;
}

// Signals that forcefully terminate (cannot be caught)
const KILL_SIGNALS = new Set(["9", "KILL", "SIGKILL"]);

/**
 * Detect dangerous broadcast kill commands.
 * Blocks:
 *   - kill -9 -1 (kills all user processes)
 *   - kill -KILL -1
 *   - killall -9 without specific process (mass kill)
 *   - pkill -9 without specific pattern (mass kill)
 *
 * Safe: kill -9 1234 (specific PID)
 */
export function analyzeKill(tokens: string[]): string | null {
  if (!tokens.length) return null;

  const cmd = normalizeCmd(tokens[0]);

  if (cmd === "kill") {
    return analyzeKillCmd(tokens);
  }

  if (cmd === "killall") {
    return analyzeKillall(tokens);
  }

  if (cmd === "pkill") {
    return analyzePkill(tokens);
  }

  return null;
}

function analyzeKillCmd(tokens: string[]): string | null {
  const args = tokens.slice(1);
  if (!args.length) return null;

  let hasForceSignal = false;
  let hasTarget = false;

  for (let i = 0; i < args.length; i++) {
    const tok = args[i];
    if (tok === "--") break;

    // Check for -9, -KILL, -SIGKILL
    if (tok.startsWith("-")) {
      const signalPart = tok.slice(1).toUpperCase();
      if (KILL_SIGNALS.has(signalPart) || signalPart === "SIGKILL") {
        hasForceSignal = true;
        continue;
      }
      // Check for -s SIGNAL syntax
      if (tok === "-s") {
        // Next token is the signal, not a target
        if (i + 1 < args.length) {
          const sig = args[i + 1].toUpperCase();
          if (KILL_SIGNALS.has(sig) || sig === "SIGKILL") {
            hasForceSignal = true;
          }
          i++; // Skip the signal value
        }
        continue;
      }
      // Other flag, skip
      continue;
    }

    // Non-flag argument is a target (PID)
    hasTarget = true;
  }

  // Block force signal with no target
  if (hasForceSignal && !hasTarget) {
    return REASON_BROADCAST_KILL;
  }

  return null;
}

function analyzeKillall(tokens: string[]): string | null {
  const args = tokens.slice(1);
  if (!args.length) return null;

  let hasForceSignal = false;
  let hasTarget = false;

  // Flags that take an argument
  const flagsTakingArg = new Set(["-u", "--user"]);

  for (let i = 0; i < args.length; i++) {
    const tok = args[i];
    if (tok === "--") {
      // Everything after -- is target
      if (i + 1 < args.length) hasTarget = true;
      break;
    }

    // Check for -9, -KILL, -SIGKILL, --signal=9
    if (tok.startsWith("-")) {
      const signalPart = tok.slice(1).toUpperCase();
      if (KILL_SIGNALS.has(signalPart) || signalPart === "SIGKILL") {
        hasForceSignal = true;
        continue;
      }
      if (tok.startsWith("--signal=")) {
        const sig = tok.slice("--signal=".length).toUpperCase();
        if (KILL_SIGNALS.has(sig) || sig === "SIGKILL") {
          hasForceSignal = true;
        }
        continue;
      }
      // Other flags: skip both flag and its argument if it takes one
      if (flagsTakingArg.has(tok) && i + 1 < args.length) {
        i++; // Skip the argument
      }
      continue;
    }

    // Non-flag argument is a target (process name)
    hasTarget = true;
  }

  // Block force signal with no target
  if (hasForceSignal && !hasTarget) {
    return REASON_BROADCAST_KILL;
  }

  return null;
}

function analyzePkill(tokens: string[]): string | null {
  const args = tokens.slice(1);
  if (!args.length) return null;

  let hasForceSignal = false;
  let hasTarget = false;

  // Flags that take an argument
  const flagsTakingArg = new Set(["-u", "--user", "-g", "--pgroup", "-P", "--parent", "-s", "--session"]);

  for (let i = 0; i < args.length; i++) {
    const tok = args[i];
    if (tok === "--") {
      // Everything after -- is target/pattern
      if (i + 1 < args.length) hasTarget = true;
      break;
    }

    // Check for -9, -KILL, -SIGKILL, --signal=9
    if (tok.startsWith("-")) {
      const stripped = tok.slice(1);
      const signalPart = stripped.toUpperCase();
      if (KILL_SIGNALS.has(signalPart) || signalPart === "SIGKILL") {
        hasForceSignal = true;
        continue;
      }
      if (tok.startsWith("--signal=")) {
        const sig = tok.slice("--signal=".length).toUpperCase();
        if (KILL_SIGNALS.has(sig) || sig === "SIGKILL") {
          hasForceSignal = true;
        }
        continue;
      }
      // Other flags: skip both flag and its argument if it takes one
      if (flagsTakingArg.has(tok) && i + 1 < args.length) {
        i++; // Skip the argument
      }
      continue;
    }

    // Non-flag argument is the target (pattern/process)
    hasTarget = true;
  }

  // Block force signal with no target
  if (hasForceSignal && !hasTarget) {
    return REASON_BROADCAST_KILL;
  }

  return null;
}
