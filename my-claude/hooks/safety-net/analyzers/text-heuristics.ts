/**
 * Text-based heuristic detection for dangerous patterns.
 * Used when shell parsing fails or for additional safety checks.
 */

const REASON_FIND_DELETE =
  "find -delete permanently deletes matched files. Use -print first.";

/**
 * Detect dangerous patterns in raw command text.
 * Fallback when proper parsing isn't possible.
 */
export function dangerousInText(text: string): string | null {
  const original = text;
  const t = text.toLowerCase();

  if (
    /(?<![\w/\\])(?:\/[^\s'";|&]+\/)?rm\b[^\n;|&]*(?:\s-(?:[a-z]*r[a-z]*f|[a-z]*f[a-z]*r)\b|\s-r\b[^\n;|&]*\s-f\b|\s-f\b[^\n;|&]*\s-r\b|\s--recursive\b[^\n;|&]*\s--force\b|\s--force\b[^\n;|&]*\s--recursive\b)/.test(
      t
    )
  ) {
    return "rm -rf is destructive. List files first, then delete individually.";
  }

  if (t.includes("git reset --hard")) {
    return "git reset --hard destroys uncommitted changes. Use 'git stash' first.";
  }
  if (t.includes("git reset --merge")) {
    return "git reset --merge can lose uncommitted changes.";
  }
  if (t.includes("git clean -f") || t.includes("git clean --force")) {
    return "git clean -f removes untracked files permanently. Review with 'git clean -n' first.";
  }
  if (
    (t.includes("git push --force") || /\bgit\s+push\s+-f\b/.test(t)) &&
    !t.includes("--force-with-lease")
  ) {
    return "Force push can destroy remote history. Use --force-with-lease if necessary.";
  }
  if (/(?:^|\s)git\s+branch\b/i.test(original) && /\s-D\b/.test(original)) {
    return "git branch -D force-deletes without merge check. Use -d for safety.";
  }
  if (t.includes("git stash drop")) {
    return "git stash drop permanently deletes stashed changes. List stashes first with 'git stash list'.";
  }
  if (t.includes("git stash clear")) {
    return "git stash clear permanently deletes ALL stashed changes.";
  }
  if (t.includes("git checkout --")) {
    return "git checkout -- discards uncommitted changes permanently. Use 'git stash' first.";
  }
  if (
    /\bgit\s+restore\b/.test(t) &&
    !t.includes("--staged") &&
    !t.includes("--help") &&
    !t.includes("--version")
  ) {
    if (t.includes("--worktree")) {
      return "git restore --worktree discards uncommitted changes permanently.";
    }
    return "git restore discards uncommitted changes. Use 'git stash' or 'git diff' first.";
  }

  return null;
}

/**
 * Detect find -delete in text (with exceptions for echo/rg).
 */
export function dangerousFindDeleteInText(text: string): string | null {
  const t = text.toLowerCase();
  const stripped = t.trimStart();
  if (stripped.startsWith("echo ") || stripped.startsWith("rg ")) return null;
  if (/\bfind\b[^\n;|&]*\s-delete\b/.test(t)) {
    return REASON_FIND_DELETE;
  }
  return null;
}

/**
 * Redact secrets from text for safe logging/display.
 */
export function redactSecrets(text: string): string {
  let redacted = text;

  redacted = redacted.replace(
    /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASS|KEY|CREDENTIALS)[A-Z0-9_]*)=([^\s]+)/gi,
    "$1=<redacted>"
  );

  redacted = redacted.replace(
    /(['"]?\s*authorization\s*:\s*)([^'"]+)(['"]?)/gi,
    "$1<redacted>$3"
  );

  redacted = redacted.replace(
    /(https?:\/\/)([^\s/:@]+):([^\s@]+)@/gi,
    "$1<redacted>:<redacted>@"
  );

  redacted = redacted.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "<redacted>");

  return redacted;
}

/**
 * Format command excerpt for error messages with redaction and truncation.
 */
export function formatSafeExcerpt(label: string, text: string): string {
  let t = redactSecrets(text);
  if (t.length > 300) t = t.slice(0, 300) + "…";
  return `${label}: ${t}\n\n`;
}
