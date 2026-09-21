import { describe, expect, test } from "bun:test";
import { isDestructive, resolveEffectiveCwd } from "../extensions/no-discard-dirty-tree";

const blocked = [
	"git reset --hard",
	"git reset --hard HEAD~1",
	"git reset --hard origin/main",
	"git reset --merge",
	"git checkout -- .",
	"git checkout -- src/foo.ts",
	"git checkout .",
	"git restore .",
	"git restore src/foo.ts",
	"git clean -fd",
	"git clean -xdf",
	"git stash drop",
	"git stash clear",
	"git branch -D feature",
	"git branch -d feature",
	"git worktree remove --force .worktrees/x",
	"cd ~/repo && git reset --hard",
	"git -C ~/repo reset --hard",
	"git stash drop && git reset --hard",
	"git stash list && git reset --hard",
];

const allowed = [
	"git reset --soft HEAD~1",
	"git reset --mixed HEAD~1",
	"git reset HEAD~1",
	"git checkout main",
	"git checkout -b feature",
	"git restore --staged src/foo.ts",
	"git stash push -u -m 'wip'",
	"git stash list",
	"git stash pop",
	"git branch feature",
	"git branch --show-current",
	"git clean -n",
	"git status --porcelain",
	"git worktree remove .worktrees/x",
	"git stash push -u -m 'wip' && git reset --hard origin/main",
	"git stash && git checkout -- .",
	"git add -A && git commit -m wip && git reset --hard HEAD~1",
];

describe("isDestructive", () => {
	for (const c of blocked) test(`blocks: ${c}`, () => expect(isDestructive(c)).toBe(true));
	for (const c of allowed) test(`allows: ${c}`, () => expect(isDestructive(c)).toBe(false));
});

describe("resolveEffectiveCwd", () => {
	test("cd prefix", () => expect(resolveEffectiveCwd("cd /tmp/x && git reset --hard", "/home")).toBe("/tmp/x"));
	test("-C flag", () => expect(resolveEffectiveCwd("git -C /tmp/y reset --hard", "/home")).toBe("/tmp/y"));
	test("plain", () => expect(resolveEffectiveCwd("git reset --hard", "/home")).toBe("/home"));
});
