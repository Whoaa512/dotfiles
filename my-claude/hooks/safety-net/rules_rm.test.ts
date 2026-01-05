import { describe, test, expect } from "bun:test";
import { analyzeRm } from "./rules_rm.js";

describe("analyzeRm", () => {
  describe("basic blocking", () => {
    test("blocks rm -rf /", () => {
      const result = analyzeRm(["rm", "-rf", "/"]);
      expect(result).toContain("root or home");
    });

    test("blocks rm -rf ~", () => {
      const result = analyzeRm(["rm", "-rf", "~"]);
      expect(result).toContain("root or home");
    });

    test("blocks rm -rf $HOME", () => {
      const result = analyzeRm(["rm", "-rf", "$HOME"]);
      expect(result).toContain("root or home");
    });

    test("blocks rm -rf ${HOME}", () => {
      const result = analyzeRm(["rm", "-rf", "${HOME}"]);
      expect(result).toContain("root or home");
    });

    test("blocks rm -rf ~/", () => {
      const result = analyzeRm(["rm", "-rf", "~/"]);
      expect(result).toContain("root or home");
    });

    test("blocks rm -rf with separate flags", () => {
      const result = analyzeRm(["rm", "-r", "-f", "/some/path"]);
      expect(result).not.toBeNull();
    });

    test("blocks rm --recursive --force", () => {
      const result = analyzeRm(["rm", "--recursive", "--force", "/some/path"]);
      expect(result).not.toBeNull();
    });
  });

  describe("allows safe operations", () => {
    test("allows rm without -rf", () => {
      expect(analyzeRm(["rm", "file.txt"])).toBeNull();
    });

    test("allows rm -r without -f", () => {
      expect(analyzeRm(["rm", "-r", "dir/"])).toBeNull();
    });

    test("allows rm -f without -r", () => {
      expect(analyzeRm(["rm", "-f", "file.txt"])).toBeNull();
    });
  });

  describe("temp path allowlisting", () => {
    test("allows rm -rf /tmp/foo", () => {
      expect(analyzeRm(["rm", "-rf", "/tmp/foo"])).toBeNull();
    });

    test("allows rm -rf /tmp", () => {
      expect(analyzeRm(["rm", "-rf", "/tmp"])).toBeNull();
    });

    test("allows rm -rf /var/tmp/foo", () => {
      expect(analyzeRm(["rm", "-rf", "/var/tmp/foo"])).toBeNull();
    });

    test("allows rm -rf $TMPDIR/foo", () => {
      expect(analyzeRm(["rm", "-rf", "$TMPDIR/foo"])).toBeNull();
    });

    test("allows rm -rf ${TMPDIR}/foo", () => {
      expect(analyzeRm(["rm", "-rf", "${TMPDIR}/foo"])).toBeNull();
    });

    test("blocks $TMPDIR/../ traversal", () => {
      const result = analyzeRm(["rm", "-rf", "$TMPDIR/../secrets"]);
      expect(result).not.toBeNull();
    });

    test("disallows TMPDIR var when explicitly disabled", () => {
      const result = analyzeRm(["rm", "-rf", "$TMPDIR/foo"], { allowTmpdirVar: false });
      expect(result).not.toBeNull();
    });
  });

  describe("cwd containment", () => {
    test("allows rm -rf ./subdir when cwd provided", () => {
      expect(analyzeRm(["rm", "-rf", "./subdir"], { cwd: "/project" })).toBeNull();
    });

    test("allows rm -rf subdir when cwd provided", () => {
      expect(analyzeRm(["rm", "-rf", "subdir"], { cwd: "/project" })).toBeNull();
    });

    test("allows rm -rf nested/deep/path when cwd provided", () => {
      expect(analyzeRm(["rm", "-rf", "nested/deep/path"], { cwd: "/project" })).toBeNull();
    });

    test("allows absolute path within cwd", () => {
      expect(analyzeRm(["rm", "-rf", "/project/subdir"], { cwd: "/project" })).toBeNull();
    });

    test("blocks rm -rf . (cwd itself)", () => {
      const result = analyzeRm(["rm", "-rf", "."], { cwd: "/project" });
      expect(result).not.toBeNull();
    });

    test("blocks rm -rf of cwd absolute path", () => {
      const result = analyzeRm(["rm", "-rf", "/project"], { cwd: "/project" });
      expect(result).not.toBeNull();
    });

    test("blocks rm -rf outside cwd", () => {
      const result = analyzeRm(["rm", "-rf", "/other/path"], { cwd: "/project" });
      expect(result).not.toBeNull();
    });

    test("blocks rm -rf with path escaping cwd", () => {
      const result = analyzeRm(["rm", "-rf", "../sibling"], { cwd: "/project/sub" });
      expect(result).not.toBeNull();
    });

    test("blocks ~ paths even with cwd", () => {
      const result = analyzeRm(["rm", "-rf", "~/something"], { cwd: "/project" });
      expect(result).toContain("root or home");
    });

    test("blocks $HOME paths even with cwd", () => {
      const result = analyzeRm(["rm", "-rf", "$HOME/something"], { cwd: "/project" });
      expect(result).toContain("root or home");
    });

    test("blocks cwd that is home dir", () => {
      const originalHome = process.env.HOME;
      process.env.HOME = "/Users/test";
      try {
        const result = analyzeRm(["rm", "-rf", "subdir"], { cwd: "/Users/test" });
        expect(result).toContain("root or home");
      } finally {
        process.env.HOME = originalHome;
      }
    });
  });

  describe("paranoid mode", () => {
    test("blocks all rm -rf in paranoid mode", () => {
      const result = analyzeRm(["rm", "-rf", "subdir"], { cwd: "/project", paranoid: true });
      expect(result).toContain("paranoid mode");
    });

    test("still allows temp paths in paranoid mode", () => {
      expect(analyzeRm(["rm", "-rf", "/tmp/foo"], { paranoid: true })).toBeNull();
    });

    test("still blocks root/home in paranoid mode", () => {
      const result = analyzeRm(["rm", "-rf", "/"], { paranoid: true });
      expect(result).toContain("root or home");
    });
  });

  describe("edge cases", () => {
    test("handles double dash separator", () => {
      const result = analyzeRm(["rm", "-rf", "--", "/some/path"]);
      expect(result).not.toBeNull();
    });

    test("handles combined flags -rf", () => {
      const result = analyzeRm(["rm", "-rf", "/some/path"]);
      expect(result).not.toBeNull();
    });

    test("handles combined flags -fr", () => {
      const result = analyzeRm(["rm", "-fr", "/some/path"]);
      expect(result).not.toBeNull();
    });

    test("handles mixed flags -rfv", () => {
      const result = analyzeRm(["rm", "-rfv", "/some/path"]);
      expect(result).not.toBeNull();
    });

    test("handles upper case -R", () => {
      const result = analyzeRm(["rm", "-Rf", "/some/path"]);
      expect(result).not.toBeNull();
    });

    test("handles multiple targets", () => {
      const result = analyzeRm(["rm", "-rf", "/tmp/a", "/some/path"]);
      expect(result).not.toBeNull();
    });

    test("allows when all targets are temp paths", () => {
      expect(analyzeRm(["rm", "-rf", "/tmp/a", "/tmp/b"])).toBeNull();
    });

    test("handles trailing slashes in paths", () => {
      expect(analyzeRm(["rm", "-rf", "/tmp/foo/"])).toBeNull();
    });
  });

  describe("path variations", () => {
    test("blocks paths with shell expansion chars", () => {
      const result = analyzeRm(["rm", "-rf", "$(pwd)/file"], { cwd: "/project" });
      expect(result).not.toBeNull();
    });

    test("blocks paths with backticks", () => {
      const result = analyzeRm(["rm", "-rf", "`pwd`/file"], { cwd: "/project" });
      expect(result).not.toBeNull();
    });

    test("blocks empty path as cwd itself", () => {
      const result = analyzeRm(["rm", "-rf", ""], { cwd: "/project" });
      expect(result).not.toBeNull();
    });
  });
});
