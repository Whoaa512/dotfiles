import { describe, expect, test } from "bun:test";
import {
	addedLines,
	classifyRepo,
	isCommitCommand,
	offendingLines,
	offendingPaths,
} from "../extensions/commit-routing-guard";

describe("isCommitCommand", () => {
	const yes = [
		"git commit -m wip",
		"git commit --amend --no-edit",
		"git add -A && git commit -am wip",
		"git -C ~/repo commit -m x",
		"gt create -m x",
		"gt modify --commit -m x",
		"gt absorb -d",
	];
	const no = [
		"git status",
		"git log --oneline",
		"gt log short",
		"echo commit",
		"git add .",
	];
	for (const c of yes)
		test(`detects: ${c}`, () => expect(isCommitCommand(c)).toBe(true));
	for (const c of no)
		test(`ignores: ${c}`, () => expect(isCommitCommand(c)).toBe(false));
});

describe("classifyRepo", () => {
	test("ergo", () =>
		expect(classifyRepo("/Users/cj/work/ergo")).toBe("shared"));
	test("ergo2 basename", () =>
		expect(classifyRepo("/tmp/ergo2")).toBe("shared"));
	test("twig", () =>
		expect(classifyRepo("/Users/cj/work/twig")).toBe("shared"));
	test("twig worktree under work/twig", () =>
		expect(classifyRepo("/Users/cj/work/twig/.worktrees/feat")).toBe("shared"));
	test("cj", () => expect(classifyRepo("/Users/cj/work/cj")).toBe("cj"));
	test("cj trailing slash", () =>
		expect(classifyRepo("/Users/cj/work/cj/")).toBe("cj"));
	test("cj-private is not cj", () =>
		expect(classifyRepo("/Users/cj/work/cj-private")).toBe(null));
	test("dotfiles", () =>
		expect(classifyRepo("/Users/cj/code/dotfiles")).toBe("dotfiles"));
	test("unrelated", () =>
		expect(classifyRepo("/Users/cj/code/foo")).toBe(null));
});

describe("offendingPaths", () => {
	test("notes dir blocked in shared", () =>
		expect(offendingPaths("shared", ["notes/handoff.md", "src/a.go"])).toEqual([
			"notes/handoff.md",
		]));
	test("nested notes dir", () =>
		expect(offendingPaths("shared", ["projects/x/notes/plan.md"])).toEqual([
			"projects/x/notes/plan.md",
		]));
	test("handoff anywhere", () =>
		expect(offendingPaths("shared", ["projects/x/HANDOFF.md"])).toEqual([
			"projects/x/HANDOFF.md",
		]));
	test("design-doc", () =>
		expect(offendingPaths("shared", ["projects/x/design-doc.md"])).toEqual([
			"projects/x/design-doc.md",
		]));
	test(".worktrees", () =>
		expect(offendingPaths("shared", [".worktrees/feat/a.go"])).toEqual([
			".worktrees/feat/a.go",
		]));
	test("docs/ allowed", () =>
		expect(offendingPaths("shared", ["docs/notes/x.md"])).toEqual([]));
	test("_infra/docs allowed", () =>
		expect(offendingPaths("shared", ["_infra/docs/handoff.md"])).toEqual([]));
	test("README allowed", () =>
		expect(offendingPaths("shared", ["notes/README.md"])).toEqual([]));
	test("plain source", () =>
		expect(offendingPaths("shared", ["src/main.go", "go.mod"])).toEqual([]));
	test("not enforced for cj", () =>
		expect(offendingPaths("cj", ["notes/handoff.md"])).toEqual([]));
	test("not enforced for null", () =>
		expect(offendingPaths(null, ["notes/handoff.md"])).toEqual([]));
});

const diff = (...added: string[]) =>
	[
		"--- a/x.md",
		"+++ b/x.md",
		"-removed EAP line",
		...added.map((l) => `+${l}`),
		" context transcript",
	].join("\n");

describe("addedLines", () => {
	test("only + lines, not +++ header", () =>
		expect(addedLines(diff("hello", "world"))).toEqual(["hello", "world"]));
});

describe("offendingLines cj", () => {
	test("EAP", () =>
		expect(offendingLines("cj", diff("talked about EAP options"))).toHaveLength(
			1,
		));
	test("transcript", () =>
		expect(offendingLines("cj", diff("Meeting transcript:"))).toHaveLength(1));
	test("1:1", () =>
		expect(offendingLines("cj", diff("1:1 with bob"))).toHaveLength(1));
	test("one-on-one", () =>
		expect(offendingLines("cj", diff("one on one notes"))).toHaveLength(1));
	test("skip level", () =>
		expect(offendingLines("cj", diff("skip-level takeaways"))).toHaveLength(1));
	test("perf review", () =>
		expect(offendingLines("cj", diff("performance review draft"))).toHaveLength(
			1,
		));
	test("comp", () =>
		expect(offendingLines("cj", diff("comp discussion"))).toHaveLength(1));
	test("confidential", () =>
		expect(
			offendingLines("cj", diff("CONFIDENTIAL do not share")),
		).toHaveLength(1));
	test("PIP", () =>
		expect(offendingLines("cj", diff("put on a PIP"))).toHaveLength(1));
	test("removed/context lines ignored", () =>
		expect(offendingLines("cj", diff("just code"))).toEqual([]));
	test("compile is not comp", () =>
		expect(offendingLines("cj", diff("compile the binary"))).toEqual([]));
	test("component is not comp", () =>
		expect(offendingLines("cj", diff("react component"))).toEqual([]));
	test("pipeline is not PIP", () =>
		expect(offendingLines("cj", diff("ci pipeline"))).toEqual([]));
	test("returns matching lines", () =>
		expect(offendingLines("cj", diff("a", "EAP b", "c"))).toEqual(["EAP b"]));
});

describe("offendingLines dotfiles", () => {
	test("musta.ch", () =>
		expect(
			offendingLines("dotfiles", diff("https://git.musta.ch/x")),
		).toHaveLength(1));
	test("airbnb", () =>
		expect(offendingLines("dotfiles", diff("Airbnb internal"))).toHaveLength(
			1,
		));
	test("iap-auth", () =>
		expect(offendingLines("dotfiles", diff("$(iap-auth)"))).toHaveLength(1));
	test("clean", () =>
		expect(offendingLines("dotfiles", diff("export EDITOR=nvim"))).toEqual([]));
	test("EAP fine in dotfiles", () =>
		expect(offendingLines("dotfiles", diff("EAP"))).toEqual([]));
});

describe("offendingLines other", () => {
	test("shared repo has no line rules", () =>
		expect(offendingLines("shared", diff("EAP airbnb"))).toEqual([]));
	test("null kind", () =>
		expect(offendingLines(null, diff("EAP airbnb"))).toEqual([]));
});
