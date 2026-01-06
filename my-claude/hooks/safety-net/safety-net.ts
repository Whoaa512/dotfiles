/**
 * Git/filesystem safety net for Claude Code.
 *
 * Blocks destructive commands that can lose uncommitted work or delete files.
 * This hook runs before Bash commands execute and can deny dangerous operations.
 *
 * Exit behavior:
 *   - Exit 0 with JSON containing permissionDecision: "deny" = block command
 *   - Exit 0 with no output = allow command
 */

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import { loadConfig, type Config } from "./config.js";
import { normalizeCmdToken } from "./normalize.js";
import { checkCustomRules } from "./rules_custom.js";
import {
  analyzePipeToShell,
  analyzeForkBomb,
  analyzeDecodeToShell,
  analyzeGitHistory,
  analyzeSecureDelete,
  analyzeDdDevice,
  analyzeGitFilterBranch,
  analyzeVariableCommand,
  analyzeEval,
  analyzeVariableFlags,
  analyzeChmod,
  analyzeChown,
  analyzeFilesystemDestruction,
} from "./rules_dangerous.js";
import { analyzeGit } from "./rules_git.js";
import { analyzeRm } from "./rules_rm.js";
import { splitShellCommands, shlexSplit, stripWrappers, shortOpts, extractDashCArg } from "./shell.js";
import { extractXargsChildCommand, xargsReplacementTokens } from "./analyzers/xargs.js";
import { extractParallelTemplateAndArgs } from "./analyzers/parallel.js";
import { findDangerousAction as findDangerousActionCore } from "./analyzers/find.js";
import {
  dangerousInText,
  dangerousFindDeleteInText,
  redactSecrets,
  formatSafeExcerpt,
} from "./analyzers/text-heuristics.js";

const MAX_RECURSION_DEPTH = 5;

const STRICT_SUFFIX = " [strict mode - disable with: unset SAFETY_NET_STRICT]";

const PARANOID_INTERPRETERS_SUFFIX =
  " [paranoid mode - disable with: unset SAFETY_NET_PARANOID SAFETY_NET_PARANOID_INTERPRETERS]";

const REASON_XARGS_RM_RF =
  "xargs can feed arbitrary input to rm -rf. List files first, then delete individually.";

const REASON_PARALLEL_RM_RF =
  "parallel can feed arbitrary input to rm -rf. List files first, then delete individually.";

function findDangerousAction(args: string[]): string | null {
  return findDangerousActionCore(args, dangerousInText, dangerousFindDeleteInText);
}

function envTruthy(name: string): boolean {
  const val = (process.env[name] || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(val);
}

function strictMode(): boolean {
  return envTruthy("SAFETY_NET_STRICT");
}

function paranoidMode(): boolean {
  return envTruthy("SAFETY_NET_PARANOID");
}

function paranoidRmMode(): boolean {
  return paranoidMode() || envTruthy("SAFETY_NET_PARANOID_RM");
}

function paranoidInterpretersMode(): boolean {
  return paranoidMode() || envTruthy("SAFETY_NET_PARANOID_INTERPRETERS");
}

function hasShellDashC(tokens: string[]): boolean {
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "--") break;
    if (tok === "-c") return true;
    if (tok.startsWith("-") && tok.length > 1 && /^[a-z]+$/i.test(tok.slice(1))) {
      const letters = new Set(tok.slice(1));
      if (letters.has("c") && [...letters].every((c) => ["c", "l", "i", "s"].includes(c))) {
        return true;
      }
    }
  }
  return false;
}

function extractPythonishCodeArg(tokens: string[]): string | null {
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "--") return null;
    if (tok === "-c" || tok === "-e") {
      return i + 1 < tokens.length ? tokens[i + 1] : null;
    }
  }
  return null;
}

function rmHasRecursiveForce(tokens: string[]): boolean {
  if (!tokens.length) return false;

  const opts: string[] = [];
  for (const tok of tokens.slice(1)) {
    if (tok === "--") break;
    opts.push(tok);
  }

  const optsLower = opts.map((t) => t.toLowerCase());
  const short = shortOpts(opts);
  const recursive = optsLower.includes("--recursive") || short.has("r") || short.has("R");
  const force = optsLower.includes("--force") || short.has("f");
  return recursive && force;
}

interface AnalysisContext {
  depth: number;
  cwd: string | null;
  strict: boolean;
  paranoidRm: boolean;
  paranoidInterpreters: boolean;
  config: Config | null;
  pipeTarget: string | null;
}

function analyzeSegment(
  segment: string,
  ctx: AnalysisContext
): [string, string] | null {
  const tokens = shlexSplit(segment);
  if (tokens === null) {
    if (ctx.strict) {
      return [segment, "Unable to parse shell command safely." + STRICT_SUFFIX];
    }
    const reason = dangerousInText(segment) || dangerousFindDeleteInText(segment);
    return reason ? [segment, reason] : null;
  }
  if (!tokens.length) return null;

  const strippedTokens = stripWrappers(tokens);
  if (!strippedTokens.length) return null;

  const head = normalizeCmdToken(strippedTokens[0]);

  // Fork bomb detection (check raw segment text)
  const forkBombReason = analyzeForkBomb(segment);
  if (forkBombReason) return [segment, forkBombReason];

  // Pipe-to-shell detection (curl | bash, wget | sh, bash <(curl...))
  const pipeToShellReason = analyzePipeToShell(strippedTokens, ctx.pipeTarget, segment);
  if (pipeToShellReason) return [segment, pipeToShellReason];

  // Decode-to-shell detection (base64 -d | bash, xxd -r | sh)
  const decodeToShellReason = analyzeDecodeToShell(strippedTokens, ctx.pipeTarget);
  if (decodeToShellReason) return [segment, decodeToShellReason];

  // Filesystem destruction commands (mkfs, wipefs, mkswap)
  const fsDestroyReason = analyzeFilesystemDestruction(strippedTokens);
  if (fsDestroyReason) return [segment, fsDestroyReason];

  // Secure delete detection (shred --remove, srm)
  const secureDeleteReason = analyzeSecureDelete(strippedTokens);
  if (secureDeleteReason) return [segment, secureDeleteReason];

  // dd writing to device files
  const ddDeviceReason = analyzeDdDevice(strippedTokens);
  if (ddDeviceReason) return [segment, ddDeviceReason];

  // git filter-branch --force (history rewrite)
  const filterBranchReason = analyzeGitFilterBranch(strippedTokens);
  if (filterBranchReason) return [segment, filterBranchReason];

  // Variable expansion bypass detection
  const varCmdReason = analyzeVariableCommand(strippedTokens, segment);
  if (varCmdReason) return [segment, varCmdReason];

  // Eval with dangerous commands
  const evalReason = analyzeEval(strippedTokens, segment);
  if (evalReason) return [segment, evalReason];

  // Variable flag construction (rm -$R$F)
  const varFlagReason = analyzeVariableFlags(strippedTokens, segment);
  if (varFlagReason) return [segment, varFlagReason];

  // chmod -R 777/666 (world-writable recursive)
  const chmodReason = analyzeChmod(strippedTokens);
  if (chmodReason) return [segment, chmodReason];

  // chown -R on sensitive paths
  const chownReason = analyzeChown(strippedTokens);
  if (chownReason) return [segment, chownReason];

  // Shell wrapper recursion: bash/sh/zsh -c '...'
  if (["bash", "sh", "zsh", "dash", "ksh"].includes(head)) {
    const cmdStr = extractDashCArg(strippedTokens);
    if (cmdStr !== null) {
      if (ctx.depth >= MAX_RECURSION_DEPTH) {
        return [segment, "Command analysis recursion limit reached."];
      }
      const analyzed = analyzeCommand(cmdStr, { ...ctx, depth: ctx.depth + 1, pipeTarget: null });
      if (analyzed) return analyzed;
    } else if (ctx.strict && hasShellDashC(strippedTokens)) {
      return [segment, "Unable to parse shell -c wrapper safely." + STRICT_SUFFIX];
    }
  }

  // Interpreter one-liners (python/node/ruby/perl -c/-e)
  if (["python", "python3", "node", "ruby", "perl"].includes(head)) {
    const code = extractPythonishCodeArg(strippedTokens);
    if (code !== null) {
      const reason = dangerousInText(code) || dangerousFindDeleteInText(code);
      if (reason) return [segment, reason];
      if (ctx.paranoidInterpreters) {
        return [segment, "Cannot safely analyze interpreter one-liners." + PARANOID_INTERPRETERS_SUFFIX];
      }
    }
  }

  const allowTmpdirVar = !/\bTMPDIR=/.test(segment);

  // xargs handling
  if (head === "xargs") {
    let child = extractXargsChildCommand(strippedTokens);
    if (child === null) {
      if (ctx.depth === 0 && ctx.config?.rules.length) {
        const reason = checkCustomRules(strippedTokens, ctx.config.rules);
        if (reason) return [segment, reason];
      }
      return null;
    }
    child = stripWrappers(child);
    if (!child.length) return null;

    const childHead = normalizeCmdToken(child[0]);

    if (childHead === "rm" && rmHasRecursiveForce(["rm", ...child.slice(1)])) {
      return [segment, REASON_XARGS_RM_RF];
    }
    if (childHead === "busybox" && child.length >= 3) {
      const applet = normalizeCmdToken(child[1]);
      if (applet === "rm" && rmHasRecursiveForce(["rm", ...child.slice(2)])) {
        return [segment, REASON_XARGS_RM_RF];
      }
    }

    if (["bash", "sh", "zsh", "dash", "ksh"].includes(childHead)) {
      const cmdStr = extractDashCArg(child);
      if (cmdStr !== null) {
        const replTokens = xargsReplacementTokens(strippedTokens);
        if (replTokens.size && replTokens.has(cmdStr.trim())) {
          return [segment, `xargs ${child[0]} -c can execute arbitrary commands from input.`];
        }
        if (replTokens.size && [...replTokens].some((t) => t && cmdStr.includes(t))) {
          const reason = dangerousInText(cmdStr);
          if (reason && reason.startsWith("rm -rf")) {
            return [segment, REASON_XARGS_RM_RF];
          }
        }
        if (ctx.depth >= MAX_RECURSION_DEPTH) {
          return [segment, "Command analysis recursion limit reached."];
        }
        const analyzed = analyzeCommand(cmdStr, { ...ctx, depth: ctx.depth + 1, pipeTarget: null });
        if (analyzed) return analyzed;
      } else if (hasShellDashC(child)) {
        return [segment, `xargs ${child[0]} -c can execute arbitrary commands from input.`];
      }
    }

    if (childHead === "busybox" && child.length >= 2) {
      const applet = normalizeCmdToken(child[1]);
      if (applet === "rm") {
        const reason = analyzeRm(["rm", ...child.slice(2)], {
          allowTmpdirVar,
          cwd: ctx.cwd,
          paranoid: ctx.paranoidRm,
        });
        return reason ? [segment, reason] : null;
      }
      if (applet === "find") {
        const reason = findDangerousAction(child.slice(2));
        if (reason) return [segment, reason];
      }
    }

    if (childHead === "git") {
      const reason = analyzeGit(["git", ...child.slice(1)]);
      return reason ? [segment, reason] : null;
    }
    if (childHead === "rm") {
      const reason = analyzeRm(["rm", ...child.slice(1)], {
        allowTmpdirVar,
        cwd: ctx.cwd,
        paranoid: ctx.paranoidRm,
      });
      return reason ? [segment, reason] : null;
    }
    if (childHead === "find") {
      const reason = findDangerousAction(child.slice(1));
      if (reason) return [segment, reason];
    }

    if (ctx.depth === 0 && ctx.config?.rules.length) {
      const reason = checkCustomRules(strippedTokens, ctx.config.rules);
      if (reason) return [segment, reason];
    }

    return null;
  }

  // parallel handling
  if (head === "parallel") {
    const extracted = extractParallelTemplateAndArgs(strippedTokens);
    if (!extracted) return null;

    let { template, args: argsAfterMarker, argsDynamic } = extracted;
    template = stripWrappers(template);

    if (!template.length) {
      if (!argsDynamic) {
        for (const cmdStr of argsAfterMarker) {
          if (ctx.depth >= MAX_RECURSION_DEPTH) {
            return [segment, "Command analysis recursion limit reached."];
          }
          const analyzed = analyzeCommand(cmdStr, { ...ctx, depth: ctx.depth + 1, pipeTarget: null });
          if (analyzed) return analyzed;
        }
      }
      if (ctx.depth === 0 && ctx.config?.rules.length) {
        const reason = checkCustomRules(strippedTokens, ctx.config.rules);
        if (reason) return [segment, reason];
      }
      return null;
    }

    const templateHead = normalizeCmdToken(template[0]);

    if (["bash", "sh", "zsh", "dash", "ksh"].includes(templateHead)) {
      const cmdStr = extractDashCArg(template);
      if (cmdStr !== null) {
        if (cmdStr.includes("{}")) {
          if (argsDynamic) {
            if (cmdStr.trim() === "{}") {
              return [segment, `parallel ${template[0]} -c can execute arbitrary commands from input.`];
            }
            const reason = dangerousInText(cmdStr);
            if (reason && reason.startsWith("rm -rf")) {
              return [segment, REASON_PARALLEL_RM_RF];
            }
          } else if (argsAfterMarker.length) {
            for (const arg of argsAfterMarker) {
              if (ctx.depth >= MAX_RECURSION_DEPTH) {
                return [segment, "Command analysis recursion limit reached."];
              }
              const analyzed = analyzeCommand(cmdStr.replace("{}", arg), {
                ...ctx,
                depth: ctx.depth + 1,
                pipeTarget: null,
              });
              if (analyzed) return analyzed;
            }
            return null;
          }
        }
        if (ctx.depth >= MAX_RECURSION_DEPTH) {
          return [segment, "Command analysis recursion limit reached."];
        }
        const analyzed = analyzeCommand(cmdStr, { ...ctx, depth: ctx.depth + 1, pipeTarget: null });
        if (analyzed) return analyzed;
      } else if (hasShellDashC(template)) {
        return [segment, `parallel ${template[0]} -c can execute arbitrary commands from input.`];
      }
    }

    if (templateHead === "busybox" && template.length >= 2) {
      const applet = normalizeCmdToken(template[1]);
      if (applet === "rm") {
        const rmTemplate = ["rm", ...template.slice(2)];
        if (argsDynamic && rmHasRecursiveForce(rmTemplate)) {
          return [segment, REASON_PARALLEL_RM_RF];
        }

        let rmTemplates = [rmTemplate];
        if (argsAfterMarker.length) {
          if (rmTemplate.some((tok) => tok.includes("{}"))) {
            rmTemplates = argsAfterMarker.map((arg) =>
              rmTemplate.map((tok) => tok.replace("{}", arg))
            );
          } else {
            rmTemplates = argsAfterMarker.map((arg) => [...rmTemplate, arg]);
          }
        }

        for (const rmTokens of rmTemplates) {
          const reason = analyzeRm(rmTokens, {
            allowTmpdirVar,
            cwd: ctx.cwd,
            paranoid: ctx.paranoidRm,
          });
          if (reason) return [segment, reason];
        }
        return null;
      }
      if (applet === "find") {
        const reason = findDangerousAction(template.slice(2));
        if (reason) return [segment, reason];
      }
    }

    if (templateHead === "git") {
      const reason = analyzeGit(["git", ...template.slice(1)]);
      return reason ? [segment, reason] : null;
    }
    if (templateHead === "rm") {
      if (argsDynamic && rmHasRecursiveForce(["rm", ...template.slice(1)])) {
        return [segment, REASON_PARALLEL_RM_RF];
      }

      let templates = [template];
      if (argsAfterMarker.length) {
        if (template.some((tok) => tok.includes("{}"))) {
          templates = argsAfterMarker.map((arg) =>
            template.map((tok) => tok.replace("{}", arg))
          );
        } else {
          templates = argsAfterMarker.map((arg) => [...template, arg]);
        }
      }

      for (const rmTokens of templates) {
        const reason = analyzeRm(["rm", ...rmTokens.slice(1)], {
          allowTmpdirVar,
          cwd: ctx.cwd,
          paranoid: ctx.paranoidRm,
        });
        if (reason) return [segment, reason];
      }
      return null;
    }
    if (templateHead === "find") {
      const reason = findDangerousAction(template.slice(1));
      if (reason) return [segment, reason];
    }

    if (ctx.depth === 0 && ctx.config?.rules.length) {
      const reason = checkCustomRules(strippedTokens, ctx.config.rules);
      if (reason) return [segment, reason];
    }

    return null;
  }

  // busybox handling
  if (head === "busybox" && strippedTokens.length >= 2) {
    const applet = normalizeCmdToken(strippedTokens[1]);
    if (applet === "rm") {
      const reason = analyzeRm(["rm", ...strippedTokens.slice(2)], {
        allowTmpdirVar,
        cwd: ctx.cwd,
        paranoid: ctx.paranoidRm,
      });
      return reason ? [segment, reason] : null;
    }
    if (applet === "find") {
      const reason = findDangerousAction(strippedTokens.slice(2));
      if (reason) return [segment, reason];
    }
  }

  // Direct git/rm/find
  if (head === "git") {
    const reason = analyzeGit(["git", ...strippedTokens.slice(1)]);
    if (reason) return [segment, reason];
    const historyReason = analyzeGitHistory(["git", ...strippedTokens.slice(1)]);
    if (historyReason) return [segment, historyReason];
    if (ctx.depth === 0 && ctx.config?.rules.length) {
      const customReason = checkCustomRules(strippedTokens, ctx.config.rules);
      if (customReason) return [segment, customReason];
    }
    return null;
  }

  if (head === "rm") {
    const reason = analyzeRm(["rm", ...strippedTokens.slice(1)], {
      allowTmpdirVar,
      cwd: ctx.cwd,
      paranoid: ctx.paranoidRm,
    });
    if (reason) return [segment, reason];
    if (ctx.depth === 0 && ctx.config?.rules.length) {
      const customReason = checkCustomRules(strippedTokens, ctx.config.rules);
      if (customReason) return [segment, customReason];
    }
    return null;
  }

  if (head === "find") {
    const reason = findDangerousAction(strippedTokens.slice(1));
    if (reason) return [segment, reason];
    if (ctx.depth === 0 && ctx.config?.rules.length) {
      const customReason = checkCustomRules(strippedTokens, ctx.config.rules);
      if (customReason) return [segment, customReason];
    }
    return null;
  }

  // Embedded destructive commands in other contexts
  for (let i = 1; i < strippedTokens.length; i++) {
    const cmd = normalizeCmdToken(strippedTokens[i]);
    if (cmd === "rm") {
      const reason = analyzeRm(["rm", ...strippedTokens.slice(i + 1)], {
        allowTmpdirVar,
        cwd: ctx.cwd,
        paranoid: ctx.paranoidRm,
      });
      if (reason) return [segment, reason];
    }
    if (cmd === "git") {
      const reason = analyzeGit(["git", ...strippedTokens.slice(i + 1)]);
      if (reason) return [segment, reason];
      const historyReason = analyzeGitHistory(["git", ...strippedTokens.slice(i + 1)]);
      if (historyReason) return [segment, historyReason];
    }
    if (cmd === "find") {
      const reason = findDangerousAction(strippedTokens.slice(i + 1));
      if (reason) return [segment, reason];
    }
  }

  const heuristicReason = dangerousInText(segment);
  if (heuristicReason) return [segment, heuristicReason];

  if (ctx.depth === 0 && ctx.config?.rules.length) {
    const customReason = checkCustomRules(strippedTokens, ctx.config.rules);
    if (customReason) return [segment, customReason];
  }

  return null;
}

function segmentChangesCwd(segment: string): boolean {
  let tokens = shlexSplit(segment);
  if (tokens !== null) {
    while (tokens.length && ["{", "(", "$("].includes(tokens[0])) {
      tokens = tokens.slice(1);
    }
    tokens = stripWrappers(tokens);
    if (tokens.length && tokens[0].toLowerCase() === "builtin") {
      tokens = tokens.slice(1);
    }
    if (tokens.length) {
      return ["cd", "pushd", "popd"].includes(normalizeCmdToken(tokens[0]));
    }
  }

  return /^\s*(?:\$\(\s*)?[({]*\s*(?:command\s+|builtin\s+)?(?:cd|pushd|popd)(?:\s|$)/i.test(
    segment
  );
}

function extractPipeTarget(segment: string): string | null {
  const tokens = shlexSplit(segment);
  if (!tokens?.length) return null;
  const stripped = stripWrappers(tokens);
  if (!stripped.length) return null;
  return normalizeCmdToken(stripped[0]);
}

function analyzeCommand(
  command: string,
  ctx: AnalysisContext
): [string, string] | null {
  // Check for fork bombs on raw command before splitting (splitting breaks fork bomb patterns)
  const forkBombReason = analyzeForkBomb(command);
  if (forkBombReason) return [command, forkBombReason];

  let effectiveCwd = ctx.cwd;
  let config = ctx.config;

  const segments = splitShellCommands(command);
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const nextSegment = i + 1 < segments.length ? segments[i + 1] : null;
    const pipeTarget = nextSegment ? extractPipeTarget(nextSegment) : null;

    const analyzed = analyzeSegment(segment, {
      ...ctx,
      cwd: effectiveCwd,
      config,
      pipeTarget,
    });
    if (analyzed) return analyzed;

    if (effectiveCwd !== null && segmentChangesCwd(segment)) {
      effectiveCwd = null;
      config = loadConfig(null);
    }
  }

  return null;
}

function sanitizeSessionIdForFilename(sessionId: string): string | null {
  const raw = sessionId.trim();
  if (!raw) return null;

  let safe = raw.replace(/[^A-Za-z0-9_.-]+/g, "_");
  safe = safe.replace(/^[._-]+|[._-]+$/g, "").slice(0, 128);
  if (!safe || safe === "." || safe === "..") return null;
  return safe;
}

function writeAuditLog(
  sessionId: string,
  command: string,
  segment: string,
  reason: string,
  cwd: string | null
): void {
  const logsDir = join(homedir(), ".cc-safety-net", "logs");
  const safeSessionId = sanitizeSessionIdForFilename(sessionId);
  if (!safeSessionId) return;

  try {
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    const logFile = join(logsDir, `${safeSessionId}.jsonl`);

    const entry = {
      ts: new Date().toISOString(),
      command: redactSecrets(command).slice(0, 300),
      segment: redactSecrets(segment).slice(0, 300),
      reason,
      cwd,
    };

    appendFileSync(logFile, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Ignore logging errors
  }
}

interface HookInput {
  tool_name?: string;
  tool_input?: {
    command?: string;
  };
  cwd?: string;
  session_id?: string;
}

async function main(): Promise<number> {
  const strict = strictMode();
  const paranoidRm = paranoidRmMode();
  const paranoidInterpreters = paranoidInterpretersMode();

  let inputData: HookInput;
  try {
    const stdin = await Bun.stdin.text();
    inputData = JSON.parse(stdin);
  } catch {
    if (!strict) return 0;
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "BLOCKED by Safety Net\n\nReason: Invalid hook input.",
        },
      })
    );
    return 0;
  }

  if (typeof inputData !== "object" || inputData === null) {
    if (!strict) return 0;
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            "BLOCKED by Safety Net\n\nReason: Invalid hook input structure.",
        },
      })
    );
    return 0;
  }

  if (inputData.tool_name !== "Bash") return 0;

  const toolInput = inputData.tool_input;
  if (typeof toolInput !== "object" || toolInput === null) {
    if (!strict) return 0;
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            "BLOCKED by Safety Net\n\nReason: Invalid hook input structure.",
        },
      })
    );
    return 0;
  }

  const command = toolInput.command;
  if (typeof command !== "string" || !command.trim()) return 0;

  let cwd = typeof inputData.cwd === "string" ? inputData.cwd.trim() : null;
  if (cwd === "") cwd = null;

  const config = loadConfig(cwd);

  const analyzed = analyzeCommand(command, {
    depth: 0,
    cwd,
    strict,
    paranoidRm,
    paranoidInterpreters,
    config,
    pipeTarget: null,
  });

  if (analyzed) {
    const [segment, reason] = analyzed;

    const sessionId = inputData.session_id;
    if (typeof sessionId === "string" && sessionId) {
      writeAuditLog(sessionId, command, segment, reason, cwd);
    }

    const output = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "BLOCKED by Safety Net\n\n" +
          `Reason: ${reason}\n\n` +
          formatSafeExcerpt("Command", command) +
          formatSafeExcerpt("Segment", segment) +
          "If this operation is truly needed, ask the user for explicit " +
          "permission and have them run the command manually.",
      },
    };
    console.log(JSON.stringify(output));
    return 0;
  }

  return 0;
}

main().then((code) => process.exit(code));
