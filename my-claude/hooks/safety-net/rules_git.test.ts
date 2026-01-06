import { describe, test, expect } from "bun:test";
import { analyzeGit } from "./rules_git.js";

describe("analyzeGit", () => {
  describe("non-git commands", () => {
    test("returns null for non-git command", () => {
      expect(analyzeGit(["ls", "-la"])).toBeNull();
    });

    test("returns null for empty tokens", () => {
      expect(analyzeGit([])).toBeNull();
    });
  });

  describe("git checkout", () => {
    test("blocks checkout with double dash (discard changes)", () => {
      const result = analyzeGit(["git", "checkout", "--", "file.txt"]);
      expect(result).toContain("git checkout --");
    });

    test("blocks checkout ref with double dash", () => {
      const result = analyzeGit(["git", "checkout", "HEAD", "--", "file.txt"]);
      expect(result).toContain("git checkout <ref> --");
    });

    test("blocks checkout with pathspec-from-file", () => {
      const result = analyzeGit(["git", "checkout", "--pathspec-from-file", "paths.txt"]);
      expect(result).toContain("pathspec-from-file");
    });

    test("blocks checkout ref with pathspec", () => {
      const result = analyzeGit(["git", "checkout", "HEAD~1", "src/"]);
      expect(result).toContain("git checkout <ref> <path>");
    });

    test("allows checkout -b (new branch)", () => {
      expect(analyzeGit(["git", "checkout", "-b", "feature"])).toBeNull();
    });

    test("allows checkout -B (force new branch)", () => {
      expect(analyzeGit(["git", "checkout", "-B", "feature"])).toBeNull();
    });

    test("allows checkout branch (switch only)", () => {
      expect(analyzeGit(["git", "checkout", "main"])).toBeNull();
    });

    test("allows checkout --orphan", () => {
      expect(analyzeGit(["git", "checkout", "--orphan", "new-root"])).toBeNull();
    });
  });

  describe("git restore", () => {
    test("blocks restore (discards changes)", () => {
      const result = analyzeGit(["git", "restore", "file.txt"]);
      expect(result).toContain("git restore");
    });

    test("blocks restore --worktree", () => {
      const result = analyzeGit(["git", "restore", "--worktree", "file.txt"]);
      expect(result).toContain("--worktree");
    });

    test("allows restore --staged", () => {
      expect(analyzeGit(["git", "restore", "--staged", "file.txt"])).toBeNull();
    });

    test("allows restore --help", () => {
      expect(analyzeGit(["git", "restore", "--help"])).toBeNull();
    });

    test("allows restore --version", () => {
      expect(analyzeGit(["git", "restore", "--version"])).toBeNull();
    });
  });

  describe("git reset", () => {
    test("blocks reset --hard", () => {
      const result = analyzeGit(["git", "reset", "--hard"]);
      expect(result).toContain("git reset --hard");
    });

    test("blocks reset --hard HEAD~1", () => {
      const result = analyzeGit(["git", "reset", "--hard", "HEAD~1"]);
      expect(result).toContain("git reset --hard");
    });

    test("blocks reset --merge", () => {
      const result = analyzeGit(["git", "reset", "--merge"]);
      expect(result).toContain("git reset --merge");
    });

    test("allows reset --soft", () => {
      expect(analyzeGit(["git", "reset", "--soft", "HEAD~1"])).toBeNull();
    });

    test("allows reset HEAD (unstage)", () => {
      expect(analyzeGit(["git", "reset", "HEAD", "file.txt"])).toBeNull();
    });
  });

  describe("git clean", () => {
    test("blocks clean -f", () => {
      const result = analyzeGit(["git", "clean", "-f"]);
      expect(result).toContain("git clean -f");
    });

    test("blocks clean --force", () => {
      const result = analyzeGit(["git", "clean", "--force"]);
      expect(result).toContain("git clean -f");
    });

    test("blocks clean -fd", () => {
      const result = analyzeGit(["git", "clean", "-fd"]);
      expect(result).toContain("git clean -f");
    });

    test("allows clean -n (dry run)", () => {
      expect(analyzeGit(["git", "clean", "-n"])).toBeNull();
    });

    test("allows clean --dry-run", () => {
      expect(analyzeGit(["git", "clean", "--dry-run"])).toBeNull();
    });
  });

  describe("git push", () => {
    test("blocks push --force", () => {
      const result = analyzeGit(["git", "push", "--force"]);
      expect(result).toContain("Force push");
    });

    test("blocks push -f", () => {
      const result = analyzeGit(["git", "push", "-f"]);
      expect(result).toContain("Force push");
    });

    test("allows push --force with --force-with-lease together", () => {
      expect(analyzeGit(["git", "push", "--force", "--force-with-lease"])).toBeNull();
    });

    test("allows push --force-with-lease alone", () => {
      expect(analyzeGit(["git", "push", "--force-with-lease"])).toBeNull();
    });

    test("allows push --force-if-includes alone", () => {
      expect(analyzeGit(["git", "push", "--force-if-includes"])).toBeNull();
    });

    test("allows push --force with --force-if-includes together", () => {
      expect(analyzeGit(["git", "push", "--force", "--force-if-includes"])).toBeNull();
    });

    test("allows push -f with --force-if-includes together", () => {
      expect(analyzeGit(["git", "push", "-f", "--force-if-includes"])).toBeNull();
    });

    test("allows normal push", () => {
      expect(analyzeGit(["git", "push", "origin", "main"])).toBeNull();
    });
  });

  describe("git worktree", () => {
    test("blocks worktree remove --force", () => {
      const result = analyzeGit(["git", "worktree", "remove", "--force", "path"]);
      expect(result).toContain("worktree remove --force");
    });

    test("blocks worktree remove -f", () => {
      const result = analyzeGit(["git", "worktree", "remove", "-f", "path"]);
      expect(result).toContain("worktree remove --force");
    });

    test("allows worktree remove without force", () => {
      expect(analyzeGit(["git", "worktree", "remove", "path"])).toBeNull();
    });

    test("allows worktree add", () => {
      expect(analyzeGit(["git", "worktree", "add", "path", "branch"])).toBeNull();
    });

    test("allows worktree list", () => {
      expect(analyzeGit(["git", "worktree", "list"])).toBeNull();
    });
  });

  describe("git branch", () => {
    test("blocks branch -D (force delete)", () => {
      const result = analyzeGit(["git", "branch", "-D", "feature"]);
      expect(result).toContain("git branch -D");
    });

    test("allows branch -d (safe delete)", () => {
      expect(analyzeGit(["git", "branch", "-d", "feature"])).toBeNull();
    });

    test("allows branch creation", () => {
      expect(analyzeGit(["git", "branch", "new-feature"])).toBeNull();
    });
  });

  describe("git stash", () => {
    test("blocks stash drop", () => {
      const result = analyzeGit(["git", "stash", "drop"]);
      expect(result).toContain("stash drop");
    });

    test("blocks stash drop with ref", () => {
      const result = analyzeGit(["git", "stash", "drop", "stash@{0}"]);
      expect(result).toContain("stash drop");
    });

    test("blocks stash clear", () => {
      const result = analyzeGit(["git", "stash", "clear"]);
      expect(result).toContain("stash clear");
    });

    test("allows stash push", () => {
      expect(analyzeGit(["git", "stash", "push"])).toBeNull();
    });

    test("allows stash pop", () => {
      expect(analyzeGit(["git", "stash", "pop"])).toBeNull();
    });

    test("allows stash list", () => {
      expect(analyzeGit(["git", "stash", "list"])).toBeNull();
    });

    test("allows bare stash", () => {
      expect(analyzeGit(["git", "stash"])).toBeNull();
    });
  });

  describe("git global options", () => {
    test("handles -C option correctly", () => {
      const result = analyzeGit(["git", "-C", "/some/path", "reset", "--hard"]);
      expect(result).toContain("git reset --hard");
    });

    test("handles --git-dir option correctly", () => {
      const result = analyzeGit(["git", "--git-dir", ".git", "reset", "--hard"]);
      expect(result).toContain("git reset --hard");
    });

    test("handles -c config option correctly", () => {
      const result = analyzeGit(["git", "-c", "user.name=Test", "reset", "--hard"]);
      expect(result).toContain("git reset --hard");
    });

    test("allows safe commands through global options", () => {
      expect(analyzeGit(["git", "-C", "/path", "status"])).toBeNull();
    });
  });

  describe("safe git commands", () => {
    test("allows git status", () => {
      expect(analyzeGit(["git", "status"])).toBeNull();
    });

    test("allows git log", () => {
      expect(analyzeGit(["git", "log"])).toBeNull();
    });

    test("allows git diff", () => {
      expect(analyzeGit(["git", "diff"])).toBeNull();
    });

    test("allows git add", () => {
      expect(analyzeGit(["git", "add", "."])).toBeNull();
    });

    test("allows git commit", () => {
      expect(analyzeGit(["git", "commit", "-m", "message"])).toBeNull();
    });

    test("allows git fetch", () => {
      expect(analyzeGit(["git", "fetch", "origin"])).toBeNull();
    });

    test("allows git pull", () => {
      expect(analyzeGit(["git", "pull"])).toBeNull();
    });
  });
});
