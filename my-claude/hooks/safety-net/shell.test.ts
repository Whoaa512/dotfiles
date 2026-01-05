import { describe, test, expect } from "bun:test";
import { shlexSplit, splitShellCommands, stripWrappers, shortOpts } from "./shell.js";

describe("splitShellCommands", () => {
  test("simple command", () => {
    expect(splitShellCommands("ls")).toEqual(["ls"]);
  });

  test("command with arguments", () => {
    expect(splitShellCommands("ls -la /tmp")).toEqual(["ls -la /tmp"]);
  });

  test("semicolon separated", () => {
    expect(splitShellCommands("echo hello; ls")).toEqual(["echo hello", "ls"]);
  });

  test("newline separated", () => {
    expect(splitShellCommands("echo hello\nls")).toEqual(["echo hello", "ls"]);
  });

  test("pipe separated", () => {
    expect(splitShellCommands("ls | grep foo")).toEqual(["ls", "grep foo"]);
  });

  test("double ampersand", () => {
    expect(splitShellCommands("cd /tmp && ls")).toEqual(["cd /tmp", "ls"]);
  });

  test("double pipe (or)", () => {
    expect(splitShellCommands("false || true")).toEqual(["false", "true"]);
  });

  test("background (&)", () => {
    expect(splitShellCommands("sleep 10 & echo done")).toEqual(["sleep 10", "echo done"]);
  });

  test("preserves quoted strings with separators", () => {
    expect(splitShellCommands("echo 'hello; world'")).toEqual(["echo 'hello; world'"]);
    expect(splitShellCommands('echo "hello && world"')).toEqual(['echo "hello && world"']);
  });

  test("escaped characters", () => {
    expect(splitShellCommands("echo hello\\;world")).toEqual(["echo hello\\;world"]);
  });

  test("pipe and redirect", () => {
    expect(splitShellCommands("cat file >&2")).toEqual(["cat file >&2"]);
  });

  test("mixed operators", () => {
    expect(splitShellCommands("cmd1 && cmd2 | cmd3; cmd4")).toEqual([
      "cmd1",
      "cmd2",
      "cmd3",
      "cmd4",
    ]);
  });

  test("empty input", () => {
    expect(splitShellCommands("")).toEqual([]);
  });

  test("whitespace only", () => {
    expect(splitShellCommands("   ")).toEqual([]);
  });
});

describe("shlexSplit", () => {
  test("simple tokens", () => {
    expect(shlexSplit("ls -la")).toEqual(["ls", "-la"]);
  });

  test("single quoted string", () => {
    expect(shlexSplit("echo 'hello world'")).toEqual(["echo", "hello world"]);
  });

  test("double quoted string", () => {
    expect(shlexSplit('echo "hello world"')).toEqual(["echo", "hello world"]);
  });

  test("escaped space", () => {
    expect(shlexSplit("echo hello\\ world")).toEqual(["echo", "hello world"]);
  });

  test("mixed quotes", () => {
    expect(shlexSplit(`echo 'single' "double"`)).toEqual(["echo", "single", "double"]);
  });

  test("returns null for unclosed quotes", () => {
    expect(shlexSplit("echo 'unclosed")).toBeNull();
    expect(shlexSplit('echo "unclosed')).toBeNull();
  });

  test("empty string", () => {
    expect(shlexSplit("")).toEqual([]);
  });

  test("complex bash command", () => {
    const result = shlexSplit("git commit -m 'fix: the bug'");
    expect(result).toEqual(["git", "commit", "-m", "fix: the bug"]);
  });

  test("nested quotes", () => {
    expect(shlexSplit(`bash -c "echo 'hello'"`)).toEqual(["bash", "-c", "echo 'hello'"]);
  });
});

describe("stripWrappers", () => {
  test("no wrapper", () => {
    expect(stripWrappers(["git", "status"])).toEqual(["git", "status"]);
  });

  test("sudo wrapper", () => {
    expect(stripWrappers(["sudo", "rm", "-rf", "/tmp/foo"])).toEqual(["rm", "-rf", "/tmp/foo"]);
  });

  test("sudo with flags", () => {
    expect(stripWrappers(["sudo", "-u", "root", "ls"])).toEqual(["root", "ls"]);
  });

  test("env wrapper", () => {
    expect(stripWrappers(["env", "rm", "-rf", "/tmp/foo"])).toEqual(["rm", "-rf", "/tmp/foo"]);
  });

  test("env with variables", () => {
    expect(stripWrappers(["FOO=bar", "git", "status"])).toEqual(["git", "status"]);
  });

  test("command wrapper", () => {
    expect(stripWrappers(["command", "git", "status"])).toEqual(["git", "status"]);
  });

  test("command with flags", () => {
    expect(stripWrappers(["command", "-v", "git"])).toEqual(["git"]);
  });

  test("nested wrappers", () => {
    expect(stripWrappers(["sudo", "env", "command", "git", "status"])).toEqual(["git", "status"]);
  });

  test("env assignments before command", () => {
    expect(stripWrappers(["HOME=/tmp", "PATH=/bin", "ls"])).toEqual(["ls"]);
  });

  test("empty input", () => {
    expect(stripWrappers([])).toEqual([]);
  });

  test("sudo with double dash", () => {
    expect(stripWrappers(["sudo", "--", "rm", "-rf"])).toEqual(["rm", "-rf"]);
  });
});

describe("shortOpts", () => {
  test("single short option", () => {
    expect(shortOpts(["-f"])).toEqual(new Set(["f"]));
  });

  test("combined short options", () => {
    expect(shortOpts(["-rf"])).toEqual(new Set(["r", "f"]));
  });

  test("multiple short option flags", () => {
    expect(shortOpts(["-r", "-f"])).toEqual(new Set(["r", "f"]));
  });

  test("mixed short and long", () => {
    expect(shortOpts(["-r", "--force"])).toEqual(new Set(["r"]));
  });

  test("stops at double dash", () => {
    expect(shortOpts(["-r", "--", "-f"])).toEqual(new Set(["r"]));
  });

  test("ignores non-option arguments", () => {
    expect(shortOpts(["file.txt", "-f"])).toEqual(new Set(["f"]));
  });

  test("ignores standalone dash", () => {
    expect(shortOpts(["-"])).toEqual(new Set());
  });

  test("ignores long options", () => {
    expect(shortOpts(["--recursive", "--force"])).toEqual(new Set());
  });

  test("empty input", () => {
    expect(shortOpts([])).toEqual(new Set());
  });

  test("breaks on non-alpha", () => {
    expect(shortOpts(["-f1"])).toEqual(new Set(["f"]));
  });
});
