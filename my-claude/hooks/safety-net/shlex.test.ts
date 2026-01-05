import { describe, test, expect } from "bun:test";
import { shlexSplit } from "./shlex.js";

describe("shlexSplit", () => {
  describe("basic splitting", () => {
    test("simple tokens", () => {
      expect(shlexSplit("a b c")).toEqual(["a", "b", "c"]);
    });

    test("multiple spaces", () => {
      expect(shlexSplit("a   b")).toEqual(["a", "b"]);
    });

    test("tabs and spaces", () => {
      expect(shlexSplit("a\tb\t c")).toEqual(["a", "b", "c"]);
    });

    test("empty string", () => {
      expect(shlexSplit("")).toEqual([]);
    });

    test("whitespace only", () => {
      expect(shlexSplit("   \t\n  ")).toEqual([]);
    });

    test("single token", () => {
      expect(shlexSplit("hello")).toEqual(["hello"]);
    });

    test("leading/trailing whitespace", () => {
      expect(shlexSplit("  a b  ")).toEqual(["a", "b"]);
    });
  });

  describe("single quotes", () => {
    test("simple single quoted string", () => {
      expect(shlexSplit("'hello world'")).toEqual(["hello world"]);
    });

    test("single quotes preserve spaces", () => {
      expect(shlexSplit("echo 'hello world'")).toEqual(["echo", "hello world"]);
    });

    test("single quotes preserve special chars", () => {
      expect(shlexSplit("'$HOME'")).toEqual(["$HOME"]);
      expect(shlexSplit("'\\n'")).toEqual(["\\n"]);
    });

    test("single quotes preserve double quotes", () => {
      expect(shlexSplit("'say \"hi\"'")).toEqual(['say "hi"']);
    });

    test("empty single quotes", () => {
      expect(shlexSplit("''")).toEqual([""]);
    });

    test("adjacent single quoted strings", () => {
      expect(shlexSplit("'a''b'")).toEqual(["ab"]);
    });

    test("single quotes in middle of word", () => {
      expect(shlexSplit("foo'bar baz'qux")).toEqual(["foobar bazqux"]);
    });
  });

  describe("double quotes", () => {
    test("simple double quoted string", () => {
      expect(shlexSplit('"hello world"')).toEqual(["hello world"]);
    });

    test("double quotes preserve spaces", () => {
      expect(shlexSplit('echo "hello world"')).toEqual(["echo", "hello world"]);
    });

    test("escaped quote inside double quotes", () => {
      expect(shlexSplit('"say \\"hi\\""')).toEqual(['say "hi"']);
    });

    test("escaped backslash inside double quotes", () => {
      expect(shlexSplit('"a\\\\b"')).toEqual(["a\\b"]);
    });

    test("escaped dollar inside double quotes", () => {
      expect(shlexSplit('"\\$HOME"')).toEqual(["$HOME"]);
    });

    test("escaped backtick inside double quotes", () => {
      expect(shlexSplit('"\\`cmd\\`"')).toEqual(["`cmd`"]);
    });

    test("non-escapable char keeps backslash", () => {
      expect(shlexSplit('"\\n"')).toEqual(["\\n"]);
      expect(shlexSplit('"\\t"')).toEqual(["\\t"]);
    });

    test("empty double quotes", () => {
      expect(shlexSplit('""')).toEqual([""]);
    });

    test("double quotes preserve single quotes", () => {
      expect(shlexSplit(`"it\\'s"`)).toEqual(["it\\'s"]);
    });

    test("line continuation in double quotes", () => {
      expect(shlexSplit('"hello\\\nworld"')).toEqual(["helloworld"]);
    });
  });

  describe("backslash escapes outside quotes", () => {
    test("escaped space", () => {
      expect(shlexSplit("a\\ b")).toEqual(["a b"]);
    });

    test("escaped backslash", () => {
      expect(shlexSplit("a\\\\b")).toEqual(["a\\b"]);
    });

    test("escaped quote chars", () => {
      expect(shlexSplit("\\'")).toEqual(["'"]);
      expect(shlexSplit('\\"')).toEqual(['"']);
    });

    test("line continuation", () => {
      expect(shlexSplit("hello\\\nworld")).toEqual(["helloworld"]);
    });

    test("escaped special chars", () => {
      expect(shlexSplit("\\$HOME")).toEqual(["$HOME"]);
      expect(shlexSplit("\\#not-comment")).toEqual(["#not-comment"]);
    });

    test("trailing backslash", () => {
      expect(shlexSplit("hello\\")).toEqual(["hello\\"]);
    });
  });

  describe("hash character (not comment in shlex.split)", () => {
    test("hash at start is token", () => {
      expect(shlexSplit("# comment")).toEqual(["#", "comment"]);
    });

    test("hash after token is separate token", () => {
      expect(shlexSplit("hello # comment")).toEqual(["hello", "#", "comment"]);
    });

    test("hash in single quotes preserved", () => {
      expect(shlexSplit("'#not a comment'")).toEqual(["#not a comment"]);
    });

    test("hash in double quotes preserved", () => {
      expect(shlexSplit('"#not a comment"')).toEqual(["#not a comment"]);
    });

    test("escaped hash", () => {
      expect(shlexSplit("\\#hash")).toEqual(["#hash"]);
    });

    test("hash attached to word", () => {
      expect(shlexSplit("foo#bar")).toEqual(["foo#bar"]);
    });
  });

  describe("mixed quotes", () => {
    test("single then double", () => {
      expect(shlexSplit("'single' \"double\"")).toEqual(["single", "double"]);
    });

    test("adjacent mixed quotes", () => {
      expect(shlexSplit("'a'\"b\"")).toEqual(["ab"]);
    });

    test("nested quotes scenario", () => {
      expect(shlexSplit('bash -c "echo \'hello\'"')).toEqual(["bash", "-c", "echo 'hello'"]);
    });

    test("single quotes inside double quotes", () => {
      expect(shlexSplit("\"it's fine\"")).toEqual(["it's fine"]);
    });

    test("double quotes inside single quotes", () => {
      expect(shlexSplit("'say \"hi\"'")).toEqual(['say "hi"']);
    });
  });

  describe("unclosed quotes", () => {
    test("unclosed single quote", () => {
      expect(shlexSplit("'unclosed")).toBeNull();
    });

    test("unclosed double quote", () => {
      expect(shlexSplit('"unclosed')).toBeNull();
    });

    test("unclosed after content", () => {
      expect(shlexSplit("echo 'hello")).toBeNull();
    });
  });

  describe("real-world examples", () => {
    test("git commit", () => {
      expect(shlexSplit("git commit -m 'fix: the bug'")).toEqual([
        "git", "commit", "-m", "fix: the bug"
      ]);
    });

    test("find command", () => {
      expect(shlexSplit("find . -name '*.ts' -type f")).toEqual([
        "find", ".", "-name", "*.ts", "-type", "f"
      ]);
    });

    test("curl with JSON", () => {
      expect(shlexSplit('curl -X POST -d \'{"key":"value"}\'')).toEqual([
        "curl", "-X", "POST", "-d", '{"key":"value"}'
      ]);
    });

    test("bash -c with complex command", () => {
      expect(shlexSplit('bash -c "echo \\"hello world\\""')).toEqual([
        "bash", "-c", 'echo "hello world"'
      ]);
    });

    test("ssh command", () => {
      expect(shlexSplit("ssh user@host 'ls -la /tmp'")).toEqual([
        "ssh", "user@host", "ls -la /tmp"
      ]);
    });

    test("docker run with env vars", () => {
      expect(shlexSplit('docker run -e "FOO=bar" image')).toEqual([
        "docker", "run", "-e", "FOO=bar", "image"
      ]);
    });

    test("complex nested bash", () => {
      expect(shlexSplit("bash -c 'echo \"hi\"'")).toEqual([
        "bash", "-c", 'echo "hi"'
      ]);
    });

    test("grep with regex", () => {
      expect(shlexSplit("grep -E 'foo|bar' file.txt")).toEqual([
        "grep", "-E", "foo|bar", "file.txt"
      ]);
    });
  });

  describe("edge cases", () => {
    test("empty quotes between words", () => {
      expect(shlexSplit("a '' b")).toEqual(["a", "", "b"]);
    });

    test("only quotes", () => {
      expect(shlexSplit("''")).toEqual([""]);
      expect(shlexSplit('""')).toEqual([""]);
    });

    test("newlines in input", () => {
      expect(shlexSplit("a\nb")).toEqual(["a", "b"]);
    });

    test("carriage return", () => {
      expect(shlexSplit("a\rb")).toEqual(["a", "b"]);
    });

    test("complex escaping", () => {
      expect(shlexSplit('"\\\\"')).toEqual(["\\"]);
    });

    test("escaped newline at start of word", () => {
      expect(shlexSplit("\\\nabc")).toEqual(["abc"]);
    });
  });
});
