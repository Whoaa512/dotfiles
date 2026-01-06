/**
 * Comprehensive test suite for shlex.ts
 * Tests derived from Python's test_shlex.py and manual verification against Python 3.14
 *
 * Run: cd /Users/cjw/code/cj/dotfiles/my-claude/hooks/safety-net && bun test shlex-comprehensive
 */
import { describe, expect, test } from "bun:test";
import { shlexSplit } from "./shlex";

// Type for test cases: [input, expected output or null for error]
type TestCase = [string, string[] | null];

describe("shlex.split() comprehensive tests", () => {
	/**
	 * Test data from Python's test_shlex.py posix_data
	 * Format: input|token1|token2|...
	 */
	describe("Python posix_data compatibility", () => {
		const posixData: TestCase[] = [
			["x", ["x"]],
			["foo bar", ["foo", "bar"]],
			[" foo bar", ["foo", "bar"]],
			[" foo bar ", ["foo", "bar"]],
			["foo   bar    bla     fasel", ["foo", "bar", "bla", "fasel"]],
			["x y  z              xxxx", ["x", "y", "z", "xxxx"]],
			["\\x bar", ["x", "bar"]],
			["\\ x bar", [" x", "bar"]],
			["\\ bar", [" bar"]],
			["foo \\x bar", ["foo", "x", "bar"]],
			["foo \\ x bar", ["foo", " x", "bar"]],
			["foo \\ bar", ["foo", " bar"]],
			['foo "bar" bla', ["foo", "bar", "bla"]],
			['"foo" "bar" "bla"', ["foo", "bar", "bla"]],
			['"foo" bar "bla"', ["foo", "bar", "bla"]],
			['"foo" bar bla', ["foo", "bar", "bla"]],
			["foo 'bar' bla", ["foo", "bar", "bla"]],
			["'foo' 'bar' 'bla'", ["foo", "bar", "bla"]],
			["'foo' bar 'bla'", ["foo", "bar", "bla"]],
			["'foo' bar bla", ["foo", "bar", "bla"]],
			['blurb foo"bar"bar"fasel" baz', ["blurb", "foobarbarfasel", "baz"]],
			["blurb foo'bar'bar'fasel' baz", ["blurb", "foobarbarfasel", "baz"]],
			['""', [""]],
			["''", [""]],
			['foo "" bar', ["foo", "", "bar"]],
			["foo '' bar", ["foo", "", "bar"]],
			['foo "" "" "" bar', ["foo", "", "", "", "bar"]],
			["foo '' '' '' bar", ["foo", "", "", "", "bar"]],
			['\\"', ['"']],
			['"\\""', ['"']],
			['"foo\\ bar"', ["foo\\ bar"]],
			['"foo\\\\ bar"', ["foo\\ bar"]],
			['"foo\\\\ bar\\""', ['foo\\ bar"']],
			['"foo\\\\" bar\\"', ["foo\\", 'bar"']],
			['"foo\\\\ bar\\" dfadf"', ['foo\\ bar" dfadf']],
			['"foo\\\\\\ bar\\" dfadf"', ['foo\\\\ bar" dfadf']],
			['"foo\\\\\\x bar\\" dfadf"', ['foo\\\\x bar" dfadf']],
			['"foo\\x bar\\" dfadf"', ['foo\\x bar" dfadf']],
			["\\'", ["'"]],
			["'foo\\ bar'", ["foo\\ bar"]],
			["'foo\\\\ bar'", ["foo\\\\ bar"]],
			[
				'\\"foo\\\\\\x bar\\" df\'a\\ \'df\\"',
				['"foo\\x', 'bar"', 'dfa\\ df"'],
			],
			['\\"foo', ['"foo']],
			['\\"foo\\x', ['"foox']],
			['"foo\\x"', ["foo\\x"]],
			['"foo\\ "', ["foo\\ "]],
			["foo\\ xx", ["foo xx"]],
			["foo\\ x\\x", ["foo xx"]],
			['foo\\ x\\x\\"', ['foo xx"']],
			['"foo\\ x\\x"', ["foo\\ x\\x"]],
			['"foo\\ x\\x\\\\"', ["foo\\ x\\x\\"]],
			['"foo\\ x\\x\\\\""foobar"', ["foo\\ x\\x\\foobar"]],
			['"foo\\ x\\x\\\\"\\\'foobar"', null], // No closing quotation
			["\"foo\\ x\\x\\\\\"\\'''\"fo'obar\"", ["foo\\ x\\x\\'fo'obar"]],
			["'don'\\''t'", ["don't"]],
			["'foo\\ bar'", ["foo\\ bar"]],
			["'foo\\\\ bar'", ["foo\\\\ bar"]],
			["foo\\ bar", ["foo bar"]],
			// Comment handling - comments=False by default in split(), so # is literal
			["foo#bar", ["foo#bar"]],
			[":-) ;-)", [":-)", ";-)"]],
			["áéíóú", ["áéíóú"]],
		];

		for (const [input, expected] of posixData) {
			test(`split(${JSON.stringify(input)})`, () => {
				const result = shlexSplit(input);
				expect(result).toEqual(expected);
			});
		}
	});

	describe("Basic splitting", () => {
		test("simple words", () => {
			expect(shlexSplit("echo hello world")).toEqual([
				"echo",
				"hello",
				"world",
			]);
		});

		test("empty string", () => {
			expect(shlexSplit("")).toEqual([]);
		});

		test("whitespace only", () => {
			expect(shlexSplit("   ")).toEqual([]);
			expect(shlexSplit("\t\t")).toEqual([]);
			expect(shlexSplit("\n\n")).toEqual([]);
		});

		test("mixed whitespace", () => {
			expect(shlexSplit("foo\tbar")).toEqual(["foo", "bar"]);
			expect(shlexSplit("foo\nbar")).toEqual(["foo", "bar"]);
			expect(shlexSplit("foo\rbar")).toEqual(["foo", "bar"]);
		});
	});

	describe("Single quote handling", () => {
		test("single quoted string", () => {
			expect(shlexSplit("'hello world'")).toEqual(["hello world"]);
		});

		test("backslash is literal in single quotes", () => {
			expect(shlexSplit("'foo\\bar'")).toEqual(["foo\\bar"]);
			expect(shlexSplit("'foo\\\\bar'")).toEqual(["foo\\\\bar"]);
		});

		test("double quote is literal in single quotes", () => {
			expect(shlexSplit("'foo\"bar'")).toEqual(['foo"bar']);
		});

		test("unclosed single quote returns null", () => {
			expect(shlexSplit("'hello")).toBeNull();
			expect(shlexSplit("foo 'bar")).toBeNull();
		});
	});

	describe("Double quote handling", () => {
		test("double quoted string", () => {
			expect(shlexSplit('"hello world"')).toEqual(["hello world"]);
		});

		test("escapable characters in double quotes", () => {
			// Only \\ \" \$ \` \newline are escapable
			expect(shlexSplit('"foo\\\\bar"')).toEqual(["foo\\bar"]);
			expect(shlexSplit('"foo\\"bar"')).toEqual(['foo"bar']);
			expect(shlexSplit('"foo\\$bar"')).toEqual(["foo$bar"]);
			expect(shlexSplit('"foo\\`bar"')).toEqual(["foo`bar"]);
		});

		test("non-escapable characters keep backslash", () => {
			expect(shlexSplit('"foo\\nbar"')).toEqual(["foo\\nbar"]);
			expect(shlexSplit('"foo\\tbar"')).toEqual(["foo\\tbar"]);
			expect(shlexSplit('"foo\\xbar"')).toEqual(["foo\\xbar"]);
		});

		test("single quote is literal in double quotes", () => {
			expect(shlexSplit('"foo\'bar"')).toEqual(["foo'bar"]);
		});

		test("unclosed double quote returns null", () => {
			expect(shlexSplit('"hello')).toBeNull();
			expect(shlexSplit('foo "bar')).toBeNull();
		});
	});

	describe("Backslash outside quotes", () => {
		test("escapes any character", () => {
			expect(shlexSplit("foo\\xbar")).toEqual(["fooxbar"]);
			expect(shlexSplit("foo\\ bar")).toEqual(["foo bar"]);
			expect(shlexSplit("foo\\\\bar")).toEqual(["foo\\bar"]);
		});

		test("escapes quotes", () => {
			expect(shlexSplit('\\"foo')).toEqual(['"foo']);
			expect(shlexSplit("\\'foo")).toEqual(["'foo"]);
		});
	});

	describe("Line continuation", () => {
		/**
		 * NOTE: Python shlex keeps the newline after backslash outside quotes.
		 * Our implementation removes both (true shell behavior).
		 * For safety-net purposes, either behavior is acceptable.
		 */
		test("backslash-newline outside quotes", () => {
			const input = "foo\\\nbar";
			const result = shlexSplit(input);
			// Python: ['foo\nbar'], bash: ['foobar']
			// We do bash-style, which is fine for our use case
			expect(result).toEqual(["foobar"]);
		});

		test("backslash-newline inside double quotes", () => {
			const input = '"foo\\\nbar"';
			const result = shlexSplit(input);
			// Line continuation in double quotes removes both backslash and newline
			expect(result).toEqual(["foobar"]);
		});

		test("backslash-newline inside single quotes is literal", () => {
			const input = "'foo\\\nbar'";
			const result = shlexSplit(input);
			// Single quotes: everything is literal
			expect(result).toEqual(["foo\\\nbar"]);
		});
	});

	describe("Mixed quotes", () => {
		test("adjacent quoted strings concatenate", () => {
			expect(shlexSplit("'foo'\"bar\"")).toEqual(["foobar"]);
			expect(shlexSplit("\"foo\"'bar'")).toEqual(["foobar"]);
			expect(shlexSplit("foo'bar'baz")).toEqual(["foobarbaz"]);
			expect(shlexSplit('foo"bar"baz')).toEqual(["foobarbaz"]);
		});

		test("switching between quote types", () => {
			expect(shlexSplit("'foo'\"bar\"'baz'")).toEqual(["foobarbaz"]);
		});
	});

	describe("Nested -c command patterns", () => {
		test("bash -c with simple command", () => {
			expect(shlexSplit("bash -c 'echo hello'")).toEqual([
				"bash",
				"-c",
				"echo hello",
			]);
		});

		test("bash -c with double quotes inside", () => {
			expect(shlexSplit("bash -c 'echo \"hello world\"'")).toEqual([
				"bash",
				"-c",
				'echo "hello world"',
			]);
		});

		test("bash -c with variables", () => {
			expect(shlexSplit("bash -c 'echo $HOME'")).toEqual([
				"bash",
				"-c",
				"echo $HOME",
			]);
		});

		test("python -c with escaped quotes", () => {
			expect(shlexSplit('python -c "print(\\"hello\\")"')).toEqual([
				"python",
				"-c",
				'print("hello")',
			]);
		});

		test("complex nested command", () => {
			expect(shlexSplit('sh -c "echo \\"test\\" && exit 0"')).toEqual([
				"sh",
				"-c",
				'echo "test" && exit 0',
			]);
		});
	});

	describe("Empty strings", () => {
		test("empty single quotes", () => {
			expect(shlexSplit("''")).toEqual([""]);
		});

		test("empty double quotes", () => {
			expect(shlexSplit('""')).toEqual([""]);
		});

		test("empty strings in command", () => {
			expect(shlexSplit("echo '' foo")).toEqual(["echo", "", "foo"]);
			expect(shlexSplit('echo "" foo')).toEqual(["echo", "", "foo"]);
		});

		test("multiple empty strings", () => {
			expect(shlexSplit("'' '' ''")).toEqual(["", "", ""]);
			expect(shlexSplit('"" "" ""')).toEqual(["", "", ""]);
		});
	});

	describe("Unicode and special characters", () => {
		test("unicode letters", () => {
			expect(shlexSplit("café naïve")).toEqual(["café", "naïve"]);
			expect(shlexSplit("日本語 中文")).toEqual(["日本語", "中文"]);
		});

		test("emoji", () => {
			expect(shlexSplit("echo 🎉 🚀")).toEqual(["echo", "🎉", "🚀"]);
		});

		test("special shell chars treated as literals with whitespace_split", () => {
			// In split() with whitespace_split=True, most special chars are literal
			expect(shlexSplit("foo|bar")).toEqual(["foo|bar"]);
			expect(shlexSplit("foo;bar")).toEqual(["foo;bar"]);
			expect(shlexSplit("foo&bar")).toEqual(["foo&bar"]);
			expect(shlexSplit("foo>bar")).toEqual(["foo>bar"]);
			expect(shlexSplit("foo<bar")).toEqual(["foo<bar"]);
			expect(shlexSplit("foo(bar)")).toEqual(["foo(bar)"]);
		});

		test("dollar signs", () => {
			expect(shlexSplit("$HOME")).toEqual(["$HOME"]);
			expect(shlexSplit("${VAR}")).toEqual(["${VAR}"]);
			expect(shlexSplit('"$HOME"')).toEqual(["$HOME"]);
		});

		test("backticks", () => {
			expect(shlexSplit("`cmd`")).toEqual(["`cmd`"]);
			expect(shlexSplit('"`cmd`"')).toEqual(["`cmd`"]);
		});
	});

	describe("Error cases", () => {
		test("unclosed single quote", () => {
			expect(shlexSplit("foo 'bar")).toBeNull();
			expect(shlexSplit("'")).toBeNull();
		});

		test("unclosed double quote", () => {
			expect(shlexSplit('foo "bar')).toBeNull();
			expect(shlexSplit('"')).toBeNull();
		});

		/**
		 * NOTE: Python shlex raises ValueError for trailing backslash.
		 * Our implementation treats it as literal backslash.
		 * This is a deviation, but acceptable for safety-net.
		 */
		test("trailing backslash (deviation from Python)", () => {
			// Python: raises ValueError("No escaped character")
			// We: return the token with trailing backslash
			const result = shlexSplit("foo\\");
			// Our implementation is lenient here
			expect(result).toEqual(["foo\\"]);
		});
	});

	describe("Real-world command patterns", () => {
		test("git commit with message", () => {
			expect(shlexSplit('git commit -m "Fix bug #123"')).toEqual([
				"git",
				"commit",
				"-m",
				"Fix bug #123",
			]);
		});

		test("find with exec", () => {
			expect(shlexSplit("find . -name '*.js' -exec echo {} \\;")).toEqual([
				"find",
				".",
				"-name",
				"*.js",
				"-exec",
				"echo",
				"{}",
				";",
			]);
		});

		test("ssh with remote command", () => {
			expect(shlexSplit("ssh user@host 'cd /app && ./deploy.sh'")).toEqual([
				"ssh",
				"user@host",
				"cd /app && ./deploy.sh",
			]);
		});

		test("curl with data", () => {
			expect(
				shlexSplit('curl -X POST -d \'{"key":"value"}\' http://api'),
			).toEqual(["curl", "-X", "POST", "-d", '{"key":"value"}', "http://api"]);
		});

		test("awk command", () => {
			expect(shlexSplit("awk '{print $1}' file.txt")).toEqual([
				"awk",
				"{print $1}",
				"file.txt",
			]);
		});

		test("sed command", () => {
			expect(shlexSplit("sed 's/foo/bar/g' input.txt")).toEqual([
				"sed",
				"s/foo/bar/g",
				"input.txt",
			]);
		});

		test("grep with regex", () => {
			expect(shlexSplit("grep -E 'foo|bar' file.txt")).toEqual([
				"grep",
				"-E",
				"foo|bar",
				"file.txt",
			]);
		});

		test("docker run", () => {
			expect(
				shlexSplit('docker run -e "VAR=value" -v /host:/container image'),
			).toEqual([
				"docker",
				"run",
				"-e",
				"VAR=value",
				"-v",
				"/host:/container",
				"image",
			]);
		});
	});

	describe("Edge cases from Python test_shlex.py", () => {
		test("don't pattern", () => {
			expect(shlexSplit("'don'\\''t'")).toEqual(["don't"]);
		});

		test("complex escape sequences", () => {
			expect(shlexSplit('"foo\\\\ bar\\" dfadf"')).toEqual([
				'foo\\ bar" dfadf',
			]);
		});

		test("emoticons", () => {
			expect(shlexSplit(":-) ;-)")).toEqual([":-)", ";-)"]);
		});

		test("hash is not comment with comments=False", () => {
			expect(shlexSplit("foo#bar")).toEqual(["foo#bar"]);
			expect(shlexSplit("foo #bar")).toEqual(["foo", "#bar"]);
		});
	});

	describe("Known differences from Python shlex", () => {
		/**
		 * Document behavior differences between our implementation and Python's.
		 * These are intentional or acceptable differences for safety-net use case.
		 */

		test("trailing backslash: we are lenient, Python throws", () => {
			// Python: ValueError("No escaped character")
			// Us: treat as literal backslash
			expect(shlexSplit("foo\\")).toEqual(["foo\\"]);
			expect(shlexSplit("\\")).toEqual(["\\"]);
		});

		test("backslash-newline outside quotes: we remove both, Python keeps newline", () => {
			// Python: ['foo\nbar'] (keeps newline, removes backslash)
			// Us: ['foobar'] (removes both, like real bash)
			// For safety-net, either is fine - we're parsing not executing
			const input = "foo\\\nbar";
			expect(shlexSplit(input)).toEqual(["foobar"]);
		});
	});

	describe("Additional edge cases", () => {
		test("only whitespace between quotes", () => {
			expect(shlexSplit("''   ''")).toEqual(["", ""]);
			expect(shlexSplit('""   ""')).toEqual(["", ""]);
		});

		test("quote immediately after word", () => {
			expect(shlexSplit("foo'bar'")).toEqual(["foobar"]);
			expect(shlexSplit('foo"bar"')).toEqual(["foobar"]);
		});

		test("word immediately after quote", () => {
			expect(shlexSplit("'foo'bar")).toEqual(["foobar"]);
			expect(shlexSplit('"foo"bar')).toEqual(["foobar"]);
		});

		test("backslash at word boundary", () => {
			expect(shlexSplit("foo\\ ")).toEqual(["foo "]);
			expect(shlexSplit("\\ foo")).toEqual([" foo"]);
		});

		test("multiple consecutive backslashes", () => {
			expect(shlexSplit("foo\\\\\\\\bar")).toEqual(["foo\\\\bar"]);
			expect(shlexSplit('"foo\\\\\\\\bar"')).toEqual(["foo\\\\bar"]);
		});

		test("escaped quote inside word", () => {
			expect(shlexSplit('foo\\"bar')).toEqual(['foo"bar']);
			expect(shlexSplit("foo\\'bar")).toEqual(["foo'bar"]);
		});

		test("complex nested bash -c command", () => {
			// A common real-world pattern
			const cmd = `bash -c 'for f in *.txt; do echo "$f"; done'`;
			expect(shlexSplit(cmd)).toEqual([
				"bash",
				"-c",
				'for f in *.txt; do echo "$f"; done',
			]);
		});

		test("xargs with placeholder", () => {
			expect(shlexSplit("xargs -I{} cp {} /dest")).toEqual([
				"xargs",
				"-I{}",
				"cp",
				"{}",
				"/dest",
			]);
		});

		test("environment variable assignment syntax", () => {
			expect(shlexSplit("VAR=value cmd")).toEqual(["VAR=value", "cmd"]);
			expect(shlexSplit('VAR="value with spaces" cmd')).toEqual([
				"VAR=value with spaces",
				"cmd",
			]);
		});

		test("paths with spaces", () => {
			expect(shlexSplit('"/path/with spaces/file.txt"')).toEqual([
				"/path/with spaces/file.txt",
			]);
			expect(shlexSplit("'/path/with spaces/file.txt'")).toEqual([
				"/path/with spaces/file.txt",
			]);
			expect(shlexSplit("/path/with\\ spaces/file.txt")).toEqual([
				"/path/with spaces/file.txt",
			]);
		});

		test("heredoc marker (quotes stripped as expected)", () => {
			// Note: shlex processes the quotes, so <<'EOF' becomes <<EOF
			// This is correct - << is literal, 'EOF' is quoted string
			expect(shlexSplit("cat <<'EOF'")).toEqual(["cat", "<<EOF"]);
			expect(shlexSplit('cat <<"EOF"')).toEqual(["cat", "<<EOF"]);
		});

		test("process substitution syntax (as literal)", () => {
			expect(shlexSplit("diff <(cmd1) <(cmd2)")).toEqual([
				"diff",
				"<(cmd1)",
				"<(cmd2)",
			]);
		});
	});
});
