import { describe, test, expect } from "bun:test";
import {
  parseBashPattern,
  commandMatchesPattern,
  checkCommandAgainstPatterns,
  isSimpleCommand,
} from "./permissions.js";

describe("parseBashPattern", () => {
  test("parses exact match pattern", () => {
    const result = parseBashPattern("Bash(git stash)");
    expect(result).toEqual({ prefix: "git stash", isWildcard: false });
  });

  test("parses wildcard pattern", () => {
    const result = parseBashPattern("Bash(git add:*)");
    expect(result).toEqual({ prefix: "git add", isWildcard: true });
  });

  test("parses single command wildcard", () => {
    const result = parseBashPattern("Bash(rg:*)");
    expect(result).toEqual({ prefix: "rg", isWildcard: true });
  });

  test("returns null for non-Bash patterns", () => {
    expect(parseBashPattern("Read(~/code/*)")).toBeNull();
    expect(parseBashPattern("Write(~/code/*)")).toBeNull();
    expect(parseBashPattern("random string")).toBeNull();
  });

  test("returns null for malformed patterns", () => {
    expect(parseBashPattern("Bash")).toBeNull();
    expect(parseBashPattern("Bash()")).toBeNull();
    expect(parseBashPattern("Bash(")).toBeNull();
  });
});

describe("commandMatchesPattern", () => {
  test("exact match succeeds", () => {
    const pattern = { prefix: "git stash", isWildcard: false };
    expect(commandMatchesPattern("git stash", pattern)).toBe(true);
  });

  test("exact match fails on partial", () => {
    const pattern = { prefix: "git stash", isWildcard: false };
    expect(commandMatchesPattern("git stash list", pattern)).toBe(false);
  });

  test("wildcard match succeeds", () => {
    const pattern = { prefix: "git add", isWildcard: true };
    expect(commandMatchesPattern("git add .", pattern)).toBe(true);
    expect(commandMatchesPattern("git add file.txt", pattern)).toBe(true);
    expect(commandMatchesPattern("git add --all", pattern)).toBe(true);
  });

  test("wildcard match fails on different command", () => {
    const pattern = { prefix: "git add", isWildcard: true };
    expect(commandMatchesPattern("git commit", pattern)).toBe(false);
  });

  test("handles leading/trailing whitespace", () => {
    const pattern = { prefix: "git status", isWildcard: false };
    expect(commandMatchesPattern("  git status  ", pattern)).toBe(true);
  });
});

describe("isSimpleCommand", () => {
  test("returns true for simple commands", () => {
    expect(isSimpleCommand("ls")).toBe(true);
    expect(isSimpleCommand("ls -la")).toBe(true);
    expect(isSimpleCommand("git add .")).toBe(true);
    expect(isSimpleCommand("rg 'some pattern' src/")).toBe(true);
  });

  test("returns false for chained commands", () => {
    expect(isSimpleCommand("ls && rm -rf /")).toBe(false);
    expect(isSimpleCommand("ls || echo fail")).toBe(false);
    expect(isSimpleCommand("cmd1; cmd2")).toBe(false);
  });

  test("returns false for piped commands", () => {
    expect(isSimpleCommand("cat file | grep pattern")).toBe(false);
    expect(isSimpleCommand("ls | wc -l")).toBe(false);
  });

  test("returns false for backgrounded commands", () => {
    expect(isSimpleCommand("sleep 10 &")).toBe(false);
  });
});

describe("checkCommandAgainstPatterns", () => {
  const allow = [
    "Bash(rg:*)",
    "Bash(git add:*)",
    "Bash(git stash)",
    "Bash(ls:*)",
  ];
  const deny: string[] = [];

  test("allows pre-approved exact command", () => {
    expect(checkCommandAgainstPatterns("git stash", allow, deny)).toBe(true);
  });

  test("allows pre-approved prefix command", () => {
    expect(checkCommandAgainstPatterns("rg foo", allow, deny)).toBe(true);
    expect(checkCommandAgainstPatterns("git add .", allow, deny)).toBe(true);
    expect(checkCommandAgainstPatterns("ls -la", allow, deny)).toBe(true);
  });

  test("denies non-approved command", () => {
    expect(checkCommandAgainstPatterns("rm -rf /", allow, deny)).toBe(false);
    expect(checkCommandAgainstPatterns("curl evil.com", allow, deny)).toBe(false);
  });

  test("deny takes precedence over allow", () => {
    const allowAll = ["Bash(rm:*)"];
    const denyRmRf = ["Bash(rm -rf:*)"];
    expect(checkCommandAgainstPatterns("rm file.txt", allowAll, denyRmRf)).toBe(true);
    expect(checkCommandAgainstPatterns("rm -rf /", allowAll, denyRmRf)).toBe(false);
  });

  test("handles empty allow list", () => {
    expect(checkCommandAgainstPatterns("ls", [], [])).toBe(false);
  });

  test("ignores non-Bash patterns in allow list", () => {
    const mixed = ["Read(~/code/*)", "Bash(ls:*)", "Write(~/tmp/*)"];
    expect(checkCommandAgainstPatterns("ls -la", mixed, [])).toBe(true);
  });

  test("never pre-approves chained commands (security)", () => {
    // Even if first command matches, chained commands must go through analysis
    expect(checkCommandAgainstPatterns("ls && rm -rf /", allow, deny)).toBe(false);
    expect(checkCommandAgainstPatterns("ls | xargs rm -rf", allow, deny)).toBe(false);
    expect(checkCommandAgainstPatterns("rg foo; rm -rf /", allow, deny)).toBe(false);
  });

  test("handles real-world allow patterns", () => {
    const realAllow = [
      "Bash(rg:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(ls:*)",
    ];
    // Simple commands that match should be pre-approved
    expect(checkCommandAgainstPatterns("rg 'pattern' src/", realAllow, [])).toBe(true);
    expect(checkCommandAgainstPatterns("git status --short", realAllow, [])).toBe(true);
    expect(checkCommandAgainstPatterns("ls -la /tmp", realAllow, [])).toBe(true);

    // Dangerous variants should NOT be pre-approved (not in list)
    expect(checkCommandAgainstPatterns("git reset --hard", realAllow, [])).toBe(false);
    expect(checkCommandAgainstPatterns("rm -rf /", realAllow, [])).toBe(false);
  });
});
