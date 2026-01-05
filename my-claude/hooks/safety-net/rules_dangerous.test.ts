import { describe, test, expect } from "bun:test";
import {
  analyzePipeToShell,
  analyzeForkBomb,
  analyzeDecodeToShell,
  analyzeGitHistory,
  analyzeSecureDelete,
} from "./rules_dangerous.js";

describe("analyzePipeToShell", () => {
  describe("curl pipe patterns", () => {
    test("blocks curl | bash", () => {
      expect(analyzePipeToShell(["curl", "https://example.com"], "bash")).not.toBeNull();
    });

    test("blocks curl | sh", () => {
      expect(analyzePipeToShell(["curl", "https://example.com"], "sh")).not.toBeNull();
    });

    test("blocks curl -s | bash", () => {
      expect(analyzePipeToShell(["curl", "-s", "https://example.com"], "bash")).not.toBeNull();
    });

    test("blocks curl -fsSL | bash", () => {
      expect(analyzePipeToShell(["curl", "-fsSL", "https://example.com"], "bash")).not.toBeNull();
    });

    test("allows curl alone", () => {
      expect(analyzePipeToShell(["curl", "https://example.com"], null)).toBeNull();
    });

    test("allows curl piped to grep", () => {
      expect(analyzePipeToShell(["curl", "https://example.com"], "grep")).toBeNull();
    });
  });

  describe("wget pipe patterns", () => {
    test("blocks wget -O - | bash", () => {
      expect(analyzePipeToShell(["wget", "-O", "-", "https://example.com"], "bash")).not.toBeNull();
    });

    test("blocks wget -qO- | sh", () => {
      expect(analyzePipeToShell(["wget", "-qO-", "https://example.com"], "sh")).not.toBeNull();
    });

    test("allows wget alone", () => {
      expect(analyzePipeToShell(["wget", "https://example.com"], null)).toBeNull();
    });
  });

  describe("process substitution patterns", () => {
    test("blocks bash <(curl ...)", () => {
      expect(analyzePipeToShell(["bash"], null, "<(curl https://example.com)")).not.toBeNull();
    });

    test("blocks sh <(wget ...)", () => {
      expect(analyzePipeToShell(["sh"], null, "<(wget https://example.com)")).not.toBeNull();
    });

    test("blocks source <(curl ...)", () => {
      expect(analyzePipeToShell(["source"], null, "<(curl https://example.com)")).not.toBeNull();
    });

    test("blocks . <(curl ...)", () => {
      expect(analyzePipeToShell(["."], null, "<(curl https://example.com)")).not.toBeNull();
    });
  });
});

describe("analyzeForkBomb", () => {
  test("blocks classic fork bomb :(){:|:&};:", () => {
    expect(analyzeForkBomb(":(){:|:&};:")).not.toBeNull();
  });

  test("blocks fork bomb with spaces", () => {
    expect(analyzeForkBomb(": (){ : | : & }; :")).not.toBeNull();
  });

  test("blocks bomb variant", () => {
    expect(analyzeForkBomb("bomb(){ bomb | bomb & }; bomb")).not.toBeNull();
  });

  test("blocks function-based fork bomb", () => {
    expect(analyzeForkBomb("f(){ f|f& };f")).not.toBeNull();
  });

  test("blocks while true fork", () => {
    expect(analyzeForkBomb("while true; do $0 & done")).not.toBeNull();
  });

  test("allows normal function definitions", () => {
    expect(analyzeForkBomb("myfunc() { echo hello; }")).toBeNull();
  });

  test("allows normal pipes", () => {
    expect(analyzeForkBomb("cat file | grep pattern")).toBeNull();
  });
});

describe("analyzeDecodeToShell", () => {
  describe("base64 decode to shell", () => {
    test("blocks base64 -d | bash", () => {
      expect(analyzeDecodeToShell(["base64", "-d"], "bash")).not.toBeNull();
    });

    test("blocks base64 --decode | sh", () => {
      expect(analyzeDecodeToShell(["base64", "--decode"], "sh")).not.toBeNull();
    });

    test("blocks base64 -D | bash (macOS)", () => {
      expect(analyzeDecodeToShell(["base64", "-D"], "bash")).not.toBeNull();
    });

    test("allows base64 -d alone", () => {
      expect(analyzeDecodeToShell(["base64", "-d"], null)).toBeNull();
    });

    test("allows base64 encode", () => {
      expect(analyzeDecodeToShell(["base64"], "bash")).toBeNull();
    });
  });

  describe("xxd decode to shell", () => {
    test("blocks xxd -r -p | bash", () => {
      expect(analyzeDecodeToShell(["xxd", "-r", "-p"], "bash")).not.toBeNull();
    });

    test("blocks xxd -r | sh", () => {
      expect(analyzeDecodeToShell(["xxd", "-r"], "sh")).not.toBeNull();
    });

    test("blocks xxd -rp | bash", () => {
      expect(analyzeDecodeToShell(["xxd", "-rp"], "bash")).not.toBeNull();
    });

    test("allows xxd without -r", () => {
      expect(analyzeDecodeToShell(["xxd"], "bash")).toBeNull();
    });

    test("allows xxd -r alone", () => {
      expect(analyzeDecodeToShell(["xxd", "-r"], null)).toBeNull();
    });
  });
});

describe("analyzeGitHistory", () => {
  describe("reflog delete", () => {
    test("blocks git reflog delete", () => {
      expect(analyzeGitHistory(["git", "reflog", "delete"])).not.toBeNull();
    });

    test("blocks git reflog delete HEAD@{0}", () => {
      expect(analyzeGitHistory(["git", "reflog", "delete", "HEAD@{0}"])).not.toBeNull();
    });

    test("allows git reflog", () => {
      expect(analyzeGitHistory(["git", "reflog"])).toBeNull();
    });

    test("allows git reflog show", () => {
      expect(analyzeGitHistory(["git", "reflog", "show"])).toBeNull();
    });
  });

  describe("gc --prune=now", () => {
    test("blocks git gc --prune=now", () => {
      expect(analyzeGitHistory(["git", "gc", "--prune=now"])).not.toBeNull();
    });

    test("blocks git gc --prune=all", () => {
      expect(analyzeGitHistory(["git", "gc", "--prune=all"])).not.toBeNull();
    });

    test("allows git gc", () => {
      expect(analyzeGitHistory(["git", "gc"])).toBeNull();
    });

    test("allows git gc --auto", () => {
      expect(analyzeGitHistory(["git", "gc", "--auto"])).toBeNull();
    });

    test("allows git gc --prune=2.weeks.ago", () => {
      expect(analyzeGitHistory(["git", "gc", "--prune=2.weeks.ago"])).toBeNull();
    });
  });
});

describe("analyzeSecureDelete", () => {
  describe("shred", () => {
    test("blocks shred --remove", () => {
      expect(analyzeSecureDelete(["shred", "--remove", "file.txt"])).not.toBeNull();
    });

    test("blocks shred -u", () => {
      expect(analyzeSecureDelete(["shred", "-u", "file.txt"])).not.toBeNull();
    });

    test("blocks shred -zu", () => {
      expect(analyzeSecureDelete(["shred", "-zu", "file.txt"])).not.toBeNull();
    });

    test("allows shred without remove (just overwrites)", () => {
      expect(analyzeSecureDelete(["shred", "file.txt"])).toBeNull();
    });

    test("allows shred -n 3 (just overwrites)", () => {
      expect(analyzeSecureDelete(["shred", "-n", "3", "file.txt"])).toBeNull();
    });
  });

  describe("srm", () => {
    test("blocks srm", () => {
      expect(analyzeSecureDelete(["srm", "file.txt"])).not.toBeNull();
    });

    test("blocks srm -r", () => {
      expect(analyzeSecureDelete(["srm", "-r", "dir/"])).not.toBeNull();
    });

    test("blocks srm with path", () => {
      expect(analyzeSecureDelete(["/usr/bin/srm", "file.txt"])).not.toBeNull();
    });
  });
});
