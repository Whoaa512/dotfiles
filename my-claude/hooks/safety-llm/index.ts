#!/usr/bin/env bun
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";

const CACHE_DIR = join(homedir(), ".cc-safety-llm");
const ALLOWLIST_PATH = join(CACHE_DIR, "allowlist.json");
const LOG_PATH = join(CACHE_DIR, "safety.log.jsonl");

interface HookInput {
  tool_name: string;
  tool_input: {
    command: string;
    description?: string;
  };
  cwd?: string;
}

interface Allowlist {
  exact: string[];
  prefixes: string[];
}

interface LogEntry {
  ts: string;
  command: string;
  description?: string;
  decision: "allow" | "deny" | "ask";
  reason?: string;
  source: "allowlist" | "review" | "error";
  durationMs: number;
}

type HookDecision = "allow" | "deny" | "ask";

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function log(entry: LogEntry) {
  ensureCacheDir();
  appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
}

function loadAllowlist(): Allowlist {
  if (!existsSync(ALLOWLIST_PATH)) {
    const initial: Allowlist = {
      exact: [],
      prefixes: [
        "ls",
        "cat ",
        "echo ",
        "pwd",
        "which ",
        "type ",
        "file ",
        "head ",
        "tail ",
        "wc ",
        "tree ",
        "fd ",
        "rg ",
        "git status",
        "git log",
        "git diff",
        "git branch",
        "git show",
        "git fetch",
        "git add",
        "git commit",
      ],
    };
    ensureCacheDir();
    writeFileSync(ALLOWLIST_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(readFileSync(ALLOWLIST_PATH, "utf-8"));
}

function saveAllowlist(allowlist: Allowlist) {
  ensureCacheDir();
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(allowlist, null, 2));
}

function isAllowed(command: string, allowlist: Allowlist): boolean {
  const trimmed = command.trim();
  if (allowlist.exact.includes(trimmed)) return true;
  for (const prefix of allowlist.prefixes) {
    if (trimmed === prefix.trim() || trimmed.startsWith(prefix)) return true;
  }
  return false;
}

function output(decision: HookDecision, message?: string) {
  const result: Record<string, unknown> = {
    hookSpecificOutput: {
      permissionDecision: decision,
      ...(message && { message }),
    },
  };
  console.log(JSON.stringify(result));
}

async function reviewWithClaude(
  command: string,
  cwd: string,
  description?: string
): Promise<{ safe: boolean; reason: string; suggestedPrefix?: string }> {
  const prompt = `You are a bash command safety evaluator for Claude Code.

Context:
- Working directory: ${cwd}
- User: developer using Claude Code CLI

Command to evaluate:
${command}
${description ? `Description: ${description}` : ""}

## UNSAFE (block):
- rm -rf on system dirs (/, /etc, /usr, /var, /home, ~) or outside project
- git push --force (without --force-with-lease)
- git reset --hard, git clean -f (data loss)
- dd, mkfs, wipefs (system destruction)
- chmod -R 777, chown -R on system paths
- Fork bombs, pipe-to-shell (curl|bash)
- DROP DATABASE, TRUNCATE without WHERE

## SAFE (allow):
- Read-only: ls, cat, head, tail, grep, rg, find (without -delete), tree
- Safe git: status, diff, log, add, commit, fetch, pull, branch
- Build tools: npm, pnpm, cargo, go, make, bazel
- rm -rf strictly within project dir or /tmp
- git push (without --force)

Respond with ONLY valid JSON:
{
  "safe": true/false,
  "reason": "brief explanation",
  "suggested_prefix": "if safe and generalizable, suggest a prefix to allowlist (e.g. 'npm '), otherwise null"
}`;

  const proc = Bun.spawn(["claude", "--print", "--model", "haiku", "--output-format", "text", prompt], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${output.slice(0, 200)}`);

  const result = JSON.parse(jsonMatch[0]);
  return {
    safe: result.safe === true,
    reason: result.reason || "No reason provided",
    suggestedPrefix: result.suggested_prefix || undefined,
  };
}

async function main() {
  const input = readFileSync(0, "utf-8");
  const hookInput: HookInput = JSON.parse(input);

  if (hookInput.tool_name !== "Bash") {
    process.exit(0);
  }

  const command = hookInput.tool_input.command;
  const description = hookInput.tool_input.description;
  const cwd = hookInput.cwd || process.cwd();

  if (!command) {
    process.exit(0);
  }

  const allowlist = loadAllowlist();

  if (isAllowed(command, allowlist)) {
    log({
      ts: new Date().toISOString(),
      command,
      description,
      decision: "allow",
      source: "allowlist",
      durationMs: Date.now() - globalStartTime,
    });
    output("allow");
    process.exit(0);
  }

  const review = await reviewWithClaude(command, cwd, description);

  if (review.safe) {
    if (review.suggestedPrefix) {
      allowlist.prefixes.push(review.suggestedPrefix);
      saveAllowlist(allowlist);
    }
    log({
      ts: new Date().toISOString(),
      command,
      description,
      decision: "allow",
      reason: review.reason,
      source: "review",
      durationMs: Date.now() - globalStartTime,
    });
    output("allow");
  } else {
    log({
      ts: new Date().toISOString(),
      command,
      description,
      decision: "deny",
      reason: review.reason,
      source: "review",
      durationMs: Date.now() - globalStartTime,
    });
    output("deny", `🛡️ ${review.reason}`);
  }
}

const globalStartTime = Date.now();
let parsedCommand: string | undefined;
let parsedDescription: string | undefined;

main().catch((e) => {
  if (parsedCommand) {
    log({
      ts: new Date().toISOString(),
      command: parsedCommand,
      description: parsedDescription,
      decision: "ask",
      reason: e.message,
      source: "error",
      durationMs: Date.now() - globalStartTime,
    });
  }
  // Defer to user on error instead of blocking
  output("ask", `⚠️ Safety check error: ${e.message}`);
  process.exit(0);
});
