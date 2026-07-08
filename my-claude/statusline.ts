#!/usr/bin/env bun
// Claude Code statusline — pi-footer-style git + usage pace. Run via statusline.sh wrapper.
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, statSync, mkdirSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

const HOME = process.env.HOME || "";
const input = JSON.parse(readFileSync(0, "utf8"));

// ---- colors ----
const c = (n: string, s: string) => `\x1b[${n}m${s}\x1b[0m`;
const dim = (s: string) => c("2", s);
const fg = (n: number, s: string) => c(`38;5;${n}`, s);
const sky = (s: string) => fg(117, s);
const purple = (s: string) => fg(147, s);
const gray = (s: string) => fg(249, s);
const green = (s: string) => fg(150, s);
const yellow = (s: string) => fg(180, s);
const red = (s: string) => fg(203, s);
const mint = (s: string) => fg(158, s);
const peach = (s: string) => fg(215, s);
const gold = (s: string) => fg(222, s);
const lavender = (s: string) => fg(189, s);

// ---- git (ported from pi footer.ts) ----
function gitSegment(): string {
  let out: string;
  try {
    out = execSync("git status --porcelain=v2 --branch 2>/dev/null", { encoding: "utf8", timeout: 2000 });
  } catch {
    return "";
  }
  let branch = "";
  let ahead = 0, behind = 0, staged = 0, unstaged = 0, untracked = 0, conflicted = 0;
  for (const line of out.split("\n")) {
    if (line.startsWith("# branch.head ")) {
      const b = line.slice(14);
      branch = b === "(detached)" ? "detached" : b;
    } else if (line.startsWith("# branch.ab ")) {
      const m = line.match(/\+(\d+) -(\d+)/);
      if (m) { ahead = +m[1]!; behind = +m[2]!; }
    } else if (line.startsWith("u ")) conflicted++;
    else if (line.startsWith("1 ") || line.startsWith("2 ")) {
      const xy = line.split(" ")[1]!;
      if (xy[0] !== ".") staged++;
      if (xy[1] !== ".") unstaged++;
    } else if (line.startsWith("? ")) untracked++;
  }
  if (!branch) return "";

  let stashes = 0;
  let action = "";
  try {
    const gitDir = execSync("git rev-parse --git-dir 2>/dev/null", { encoding: "utf8", timeout: 1000 }).trim();
    const stashOut = execSync("git stash list 2>/dev/null", { encoding: "utf8", timeout: 1000 }).trim();
    stashes = stashOut ? stashOut.split("\n").length : 0;
    if (existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply"))) action = "rebase";
    else if (existsSync(join(gitDir, "MERGE_HEAD"))) action = "merge";
    else if (existsSync(join(gitDir, "CHERRY_PICK_HEAD"))) action = "cherry-pick";
    else if (existsSync(join(gitDir, "REVERT_HEAD"))) action = "revert";
    else if (existsSync(join(gitDir, "BISECT_LOG"))) action = "bisect";
  } catch {}

  if (branch.length > 32) branch = branch.slice(0, 12) + "…" + branch.slice(-12);
  const dirty = staged || unstaged || conflicted;
  const parts = [(dirty ? yellow : green)(` ${branch}`)];
  if (behind) parts.push(green(`⇣${behind}`));
  if (ahead) parts.push(green(`⇡${ahead}`));
  if (stashes) parts.push(green(`*${stashes}`));
  if (action) parts.push(red(action));
  if (conflicted) parts.push(red(`~${conflicted}`));
  if (staged) parts.push(yellow(`+${staged}`));
  if (unstaged) parts.push(yellow(`!${unstaged}`));
  if (untracked) parts.push(dim(`?${untracked}`));
  return parts.join(" ");
}

// ---- session jsonl: message activity ----
function relTime(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function activitySegment(sessionId: string, cwd: string): string {
  try {
    const enc = cwd.replace(/\//g, "-");
    const file = join(HOME, ".claude", "projects", enc, `${sessionId}.jsonl`);
    if (!existsSync(file)) return "";
    const text = readFileSync(file, "utf8");
    let u = 0, a = 0, lastU = 0, lastA = 0;
    for (const line of text.split("\n")) {
      const isU = line.includes('"type":"user"') && !line.includes('"toolUseResult"');
      const isA = !isU && line.includes('"type":"assistant"');
      if (!isU && !isA) continue;
      const tm = line.match(/"timestamp":"([^"]+)"/);
      const ts = tm ? Date.parse(tm[1]!) : 0;
      if (isU) { u++; if (ts) lastU = ts; }
      else { a++; if (ts) lastA = ts; }
    }
    const parts: string[] = [];
    if (lastU) parts.push(`u×${u} ${relTime(lastU)}`);
    if (lastA) parts.push(`a×${a} ${relTime(lastA)}`);
    return parts.join(" · ");
  } catch {
    return "";
  }
}

// ---- usage API (cached, background refresh) ----
const CACHE_DIR = join(HOME, ".claude", "cache");
const USAGE_CACHE = join(CACHE_DIR, "usage-api.json");
const TOKEN_FILE = join(HOME, "nova", ".secrets", "claude-max-usage.token");
const TTL_MS = 60_000;

function refreshUsageInBackground() {
  if (!existsSync(TOKEN_FILE)) return;
  try { mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
  const marker = join(CACHE_DIR, "usage-api.attempt");
  try {
    if (Date.now() - statSync(marker).mtimeMs < TTL_MS) return;
  } catch {}
  try { require("node:fs").writeFileSync(marker, ""); } catch {}
  const cmd = `curl -sS -f --max-time 5 "https://api.anthropic.com/api/oauth/usage" -H "Authorization: Bearer $(cat ${TOKEN_FILE})" -H "anthropic-beta: oauth-2025-04-20" -H "Content-Type: application/json" -H "User-Agent: claude-code/2.1.59" > "${USAGE_CACHE}.tmp" && mv "${USAGE_CACHE}.tmp" "${USAGE_CACHE}"`;
  const child = spawn("bash", ["-c", cmd], { detached: true, stdio: "ignore" });
  child.unref();
}

function usageSegment(): string {
  let cached: any = null;
  let stale = true;
  try {
    const st = statSync(USAGE_CACHE);
    stale = Date.now() - st.mtimeMs > TTL_MS;
    cached = JSON.parse(readFileSync(USAGE_CACHE, "utf8"));
  } catch {}
  if (stale) refreshUsageInBackground();
  const fh = cached?.five_hour;
  if (!fh || fh.utilization == null) return "";

  const used = Math.round(fh.utilization);
  const resetMs = fh.resets_at ? Date.parse(fh.resets_at) - Date.now() : 0;
  const windowMs = 300 * 60_000;
  const expected = Math.min(100, Math.max(0, ((windowMs - resetMs) / windowMs) * 100));
  const delta = used - expected;
  const pace =
    Math.abs(delta) <= 2 ? "on pace"
    : delta > 0 ? `${Math.round(Math.abs(delta))}% deficit`
    : `${Math.round(Math.abs(delta))}% reserve`;
  const paint = delta > 6 ? red : delta > 2 ? peach : mint;
  const resetsIn = resetMs > 0
    ? `${Math.floor(resetMs / 3600_000)}h${Math.floor((resetMs % 3600_000) / 60_000)}m`
    : "now";
  let seg = paint(`5h ${used}% · ${pace} · ↻${resetsIn}`);

  const sd = cached?.seven_day;
  if (sd?.utilization != null && sd.utilization > 80) {
    seg += " " + red(`7d ${Math.round(sd.utilization)}%`);
  }
  return seg;
}

// ---- assemble ----
const cwd: string = input.workspace?.current_dir || input.cwd || "unknown";
const dir = cwd.startsWith(HOME) ? `~${cwd.slice(HOME.length)}` : cwd;
const model = input.model?.display_name || "Claude";
const ccVersion = input.version || "";
const outputStyle = input.output_style?.name || "";
const sessionId: string = input.session_id || "";
const isSSH = !!process.env.SSH_CONNECTION || !!process.env.SSH_TTY;

// Line 1: identity
const l1: string[] = [sky(dir)];
const git = gitSegment();
if (git) l1.push(git);
l1.push(purple(model));
if (ccVersion) l1.push(gray(`v${ccVersion}`));
if (outputStyle && outputStyle !== "default") l1.push(gray(outputStyle));
if (sessionId) l1.push(dim(sessionId.slice(0, 8)));
if (isSSH) l1.push(dim(`${process.env.USER || ""}@${hostname()}`));

// Line 2: context + usage + cost/tokens + activity
const l2: string[] = [];
const ctxSize = input.context_window?.context_window_size || 200000;
const usage = input.context_window?.current_usage;
if (usage) {
  const cur = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  const remPct = Math.max(0, Math.min(100, 100 - Math.round((cur * 100) / ctxSize)));
  const filled = Math.round(remPct / 10);
  const bar = "=".repeat(filled) + "-".repeat(10 - filled);
  const paint = remPct <= 20 ? red : remPct <= 40 ? peach : mint;
  l2.push(paint(`ctx ${remPct}% [${bar}]`));
}
const usageSeg = usageSegment();
if (usageSeg) l2.push(usageSeg);

const cost = input.cost?.total_cost_usd;
const durMs = input.cost?.total_duration_ms;
if (typeof cost === "number") {
  let s = gold(`$${cost.toFixed(2)}`);
  if (durMs > 0) s += gold(` ($${((cost * 3600000) / durMs).toFixed(2)}/h)`);
  l2.push(s);
}
const inTok = input.context_window?.total_input_tokens || 0;
const outTok = input.context_window?.total_output_tokens || 0;
const tot = inTok + outTok;
if (tot > 0) {
  const tokStr = tot >= 1000 ? `${(tot / 1000).toFixed(1)}k` : `${tot}`;
  let s = `${tokStr} tok`;
  if (durMs > 0) s += ` (${Math.round((tot * 60000) / durMs)} tpm)`;
  l2.push(lavender(s));
}
if (sessionId) {
  const act = activitySegment(sessionId, cwd);
  if (act) l2.push(dim(act));
}

console.log(l1.join("  "));
if (l2.length) console.log(l2.join("  "));
