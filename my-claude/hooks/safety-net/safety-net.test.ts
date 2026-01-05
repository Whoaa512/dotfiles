import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { spawn } from "bun";
import { join } from "path";

const HOOK_PATH = join(import.meta.dir, "safety-net.ts");

interface HookInput {
  tool_name: string;
  tool_input: {
    command: string;
  };
  cwd?: string;
  session_id?: string;
}

interface HookOutput {
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision: "allow" | "deny";
    permissionDecisionReason?: string;
  };
}

async function runHook(input: HookInput, env: Record<string, string> = {}): Promise<HookOutput | null> {
  const proc = spawn({
    cmd: ["bun", "run", HOOK_PATH],
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });

  proc.stdin.write(JSON.stringify(input));
  proc.stdin.end();

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  if (!output.trim()) return null;
  return JSON.parse(output);
}

function bashInput(command: string, cwd?: string): HookInput {
  return {
    tool_name: "Bash",
    tool_input: { command },
    ...(cwd && { cwd }),
  };
}

describe("safety-net hook", () => {
  describe("non-Bash tools", () => {
    test("passes through non-Bash tools", async () => {
      const result = await runHook({
        tool_name: "Read",
        tool_input: { command: "git reset --hard" },
      });
      expect(result).toBeNull();
    });

    test("passes through Write tool", async () => {
      const result = await runHook({
        tool_name: "Write",
        tool_input: { command: "rm -rf /" },
      });
      expect(result).toBeNull();
    });
  });

  describe("safe commands", () => {
    test("allows simple ls", async () => {
      const result = await runHook(bashInput("ls -la"));
      expect(result).toBeNull();
    });

    test("allows git status", async () => {
      const result = await runHook(bashInput("git status"));
      expect(result).toBeNull();
    });

    test("allows git log", async () => {
      const result = await runHook(bashInput("git log --oneline"));
      expect(result).toBeNull();
    });

    test("allows git commit", async () => {
      const result = await runHook(bashInput("git commit -m 'fix bug'"));
      expect(result).toBeNull();
    });

    test("allows git checkout -b (new branch)", async () => {
      const result = await runHook(bashInput("git checkout -b feature-branch"));
      expect(result).toBeNull();
    });
  });

  describe("git blocking", () => {
    test("blocks git reset --hard", async () => {
      const result = await runHook(bashInput("git reset --hard"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain("git reset --hard");
    });

    test("blocks git checkout -- file", async () => {
      const result = await runHook(bashInput("git checkout -- file.txt"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("blocks git clean -f", async () => {
      const result = await runHook(bashInput("git clean -f"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("blocks git push --force", async () => {
      const result = await runHook(bashInput("git push --force"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("blocks git stash drop", async () => {
      const result = await runHook(bashInput("git stash drop"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });
  });

  describe("rm blocking", () => {
    test("blocks rm -rf /", async () => {
      const result = await runHook(bashInput("rm -rf /"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain("root or home");
    });

    test("blocks rm -rf ~", async () => {
      const result = await runHook(bashInput("rm -rf ~"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("allows rm -rf /tmp/foo", async () => {
      const result = await runHook(bashInput("rm -rf /tmp/foo"));
      expect(result).toBeNull();
    });

    test("allows rm -rf ./subdir with cwd", async () => {
      const result = await runHook(bashInput("rm -rf ./subdir", "/project"));
      expect(result).toBeNull();
    });
  });

  describe("wrapper recursion", () => {
    test("blocks bash -c 'git reset --hard'", async () => {
      const result = await runHook(bashInput("bash -c 'git reset --hard'"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain("git reset --hard");
    });

    test("blocks sh -c 'rm -rf /'", async () => {
      const result = await runHook(bashInput("sh -c 'rm -rf /'"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("blocks sudo rm -rf /", async () => {
      const result = await runHook(bashInput("sudo rm -rf /"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("blocks env rm -rf /", async () => {
      const result = await runHook(bashInput("env rm -rf /"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("blocks nested wrappers", async () => {
      const result = await runHook(bashInput("sudo bash -c 'git reset --hard'"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });
  });

  describe("xargs blocking", () => {
    test("blocks xargs rm -rf", async () => {
      const result = await runHook(bashInput("find . -name '*.log' | xargs rm -rf"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain("xargs");
    });

    test("allows safe xargs usage", async () => {
      const result = await runHook(bashInput("find . -name '*.txt' | xargs cat"));
      expect(result).toBeNull();
    });
  });

  describe("find -delete blocking", () => {
    test("blocks find -delete", async () => {
      const result = await runHook(bashInput("find . -name '*.log' -delete"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain("find -delete");
    });

    test("allows find -print", async () => {
      const result = await runHook(bashInput("find . -name '*.log' -print"));
      expect(result).toBeNull();
    });
  });

  describe("chained commands", () => {
    test("blocks dangerous command in chain", async () => {
      const result = await runHook(bashInput("ls && git reset --hard"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("allows safe command chain", async () => {
      const result = await runHook(bashInput("git status && git log --oneline"));
      expect(result).toBeNull();
    });

    test("blocks dangerous command after pipe", async () => {
      const result = await runHook(bashInput("echo test | git reset --hard"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });
  });

  describe("command substitution", () => {
    test("blocks $() command substitution with dangerous content", async () => {
      const result = await runHook(bashInput("echo $(git reset --hard)"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("blocks backtick command substitution with dangerous content", async () => {
      const result = await runHook(bashInput("echo `git reset --hard`"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("blocks nested command substitution", async () => {
      const result = await runHook(bashInput("$($(git reset --hard))"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("blocks rm -rf in command substitution", async () => {
      const result = await runHook(bashInput("echo $(rm -rf /)"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });
  });

  describe("invalid input handling", () => {
    test("handles empty command", async () => {
      const result = await runHook(bashInput(""));
      expect(result).toBeNull();
    });

    test("handles whitespace-only command", async () => {
      const result = await runHook(bashInput("   "));
      expect(result).toBeNull();
    });
  });

  describe("output format", () => {
    test("includes hookEventName in output", async () => {
      const result = await runHook(bashInput("git reset --hard"));
      expect(result?.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
    });

    test("includes command excerpt in reason", async () => {
      const result = await runHook(bashInput("git reset --hard"));
      expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain("Command:");
    });

    test("includes segment excerpt in reason", async () => {
      const result = await runHook(bashInput("git reset --hard"));
      expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain("Segment:");
    });
  });

  describe("edge cases", () => {
    test("handles complex quoting", async () => {
      const result = await runHook(bashInput(`git commit -m "fix: it's a \"bug\""`));
      expect(result).toBeNull();
    });

    // Conservative: heredoc content is just data to cat, not executed.
    // However, proper heredoc parsing is complex and error-prone.
    // Blocking these rare edge cases is safer than risking a bypass.
    test("blocks heredoc with dangerous content (conservative)", async () => {
      const result = await runHook(bashInput("cat << 'EOF'\ngit reset --hard\nEOF"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    test("handles git with -C flag", async () => {
      const result = await runHook(bashInput("git -C /path reset --hard"));
      expect(result?.hookSpecificOutput?.permissionDecision).toBe("deny");
    });
  });
});
