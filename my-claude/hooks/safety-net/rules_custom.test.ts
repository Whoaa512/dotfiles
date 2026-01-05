import { describe, test, expect } from "bun:test";
import { checkCustomRules } from "./rules_custom.js";
import type { CustomRule } from "./config.js";

const makeRule = (overrides: Partial<CustomRule> = {}): CustomRule => ({
  name: "test-rule",
  command: "kubectl",
  subcommand: null,
  blockArgs: ["--force"],
  reason: "Force is dangerous",
  ...overrides,
});

describe("checkCustomRules", () => {
  describe("basic matching", () => {
    test("matches command with blocked arg", () => {
      const rules = [makeRule()];
      const result = checkCustomRules(["kubectl", "delete", "--force"], rules);
      expect(result).toContain("test-rule");
      expect(result).toContain("Force is dangerous");
    });

    test("returns null when no rules match", () => {
      const rules = [makeRule()];
      expect(checkCustomRules(["kubectl", "get", "pods"], rules)).toBeNull();
    });

    test("returns null for different command", () => {
      const rules = [makeRule()];
      expect(checkCustomRules(["docker", "rm", "--force"], rules)).toBeNull();
    });

    test("returns null for empty tokens", () => {
      const rules = [makeRule()];
      expect(checkCustomRules([], rules)).toBeNull();
    });

    test("returns null for empty rules", () => {
      expect(checkCustomRules(["kubectl", "--force"], [])).toBeNull();
    });
  });

  describe("subcommand matching", () => {
    test("matches with subcommand specified", () => {
      const rules = [makeRule({ subcommand: "delete" })];
      const result = checkCustomRules(["kubectl", "delete", "--force"], rules);
      expect(result).toContain("test-rule");
    });

    test("returns null for wrong subcommand", () => {
      const rules = [makeRule({ subcommand: "delete" })];
      expect(checkCustomRules(["kubectl", "get", "--force"], rules)).toBeNull();
    });

    test("matches when subcommand is null (any subcommand)", () => {
      const rules = [makeRule({ subcommand: null })];
      expect(checkCustomRules(["kubectl", "get", "--force"], rules)).not.toBeNull();
      expect(checkCustomRules(["kubectl", "delete", "--force"], rules)).not.toBeNull();
    });
  });

  describe("short option matching", () => {
    test("matches short form of blocked arg", () => {
      const rules = [makeRule({ blockArgs: ["-f"] })];
      const result = checkCustomRules(["kubectl", "delete", "-f"], rules);
      expect(result).not.toBeNull();
    });

    test("matches combined short options", () => {
      const rules = [makeRule({ blockArgs: ["-f"] })];
      const result = checkCustomRules(["kubectl", "delete", "-rf"], rules);
      expect(result).not.toBeNull();
    });

    test("matches specific letter in combined flags", () => {
      const rules = [makeRule({ blockArgs: ["-x"] })];
      const result = checkCustomRules(["kubectl", "-axb"], rules);
      expect(result).not.toBeNull();
    });

    test("does not match long option for short rule", () => {
      const rules = [makeRule({ blockArgs: ["-f"] })];
      expect(checkCustomRules(["kubectl", "--force"], rules)).toBeNull();
    });
  });

  describe("multiple blocked args", () => {
    test("matches any blocked arg", () => {
      const rules = [makeRule({ blockArgs: ["--force", "--dry-run=false"] })];
      expect(checkCustomRules(["kubectl", "--force"], rules)).not.toBeNull();
      expect(checkCustomRules(["kubectl", "--dry-run=false"], rules)).not.toBeNull();
    });

    test("returns null if none match", () => {
      const rules = [makeRule({ blockArgs: ["--force", "--dry-run=false"] })];
      expect(checkCustomRules(["kubectl", "--grace-period=0"], rules)).toBeNull();
    });
  });

  describe("multiple rules", () => {
    test("matches first applicable rule", () => {
      const rules = [
        makeRule({ name: "rule-1", command: "kubectl", blockArgs: ["--force"] }),
        makeRule({ name: "rule-2", command: "docker", blockArgs: ["--force"] }),
      ];
      const result = checkCustomRules(["docker", "--force"], rules);
      expect(result).toContain("rule-2");
    });

    test("tries all rules until match", () => {
      const rules = [
        makeRule({ name: "rule-1", command: "kubectl", blockArgs: ["--xxx"] }),
        makeRule({ name: "rule-2", command: "kubectl", blockArgs: ["--force"] }),
      ];
      const result = checkCustomRules(["kubectl", "--force"], rules);
      expect(result).toContain("rule-2");
    });
  });

  describe("command normalization", () => {
    test("matches command with full path", () => {
      const rules = [makeRule({ command: "kubectl" })];
      const result = checkCustomRules(["/usr/local/bin/kubectl", "--force"], rules);
      expect(result).not.toBeNull();
    });

    test("extracts basename for matching", () => {
      const rules = [makeRule({ command: "rm" })];
      const result = checkCustomRules(["/bin/rm", "--force"], rules);
      expect(result).not.toBeNull();
    });
  });

  describe("subcommand extraction", () => {
    test("first positional arg is subcommand", () => {
      const rules = [makeRule({ subcommand: "delete", blockArgs: ["--force"] })];
      const result = checkCustomRules(["kubectl", "delete", "--force", "pod"], rules);
      expect(result).not.toBeNull();
    });

    test("long flags are skipped to find subcommand", () => {
      const rules = [makeRule({ subcommand: "delete", blockArgs: ["--force"] })];
      const result = checkCustomRules(["kubectl", "--namespace", "delete", "--force"], rules);
      expect(result).not.toBeNull();
    });

    test("returns null when no positional arg after flags", () => {
      const rules = [makeRule({ subcommand: "delete" })];
      expect(checkCustomRules(["kubectl", "--help"], rules)).toBeNull();
    });
  });

  describe("real-world examples", () => {
    test("kubectl delete --force --grace-period=0", () => {
      const rules = [
        makeRule({
          name: "kubectl-force-delete",
          command: "kubectl",
          subcommand: "delete",
          blockArgs: ["--force", "--grace-period=0"],
          reason: "Force delete bypasses graceful shutdown",
        }),
      ];
      const result = checkCustomRules(
        ["kubectl", "delete", "pod", "foo", "--force", "--grace-period=0"],
        rules
      );
      expect(result).toContain("kubectl-force-delete");
    });

    test("docker system prune -a", () => {
      const rules = [
        makeRule({
          name: "docker-prune-all",
          command: "docker",
          subcommand: "prune",
          blockArgs: ["-a", "--all"],
          reason: "Prune all removes everything including used resources",
        }),
      ];
      expect(checkCustomRules(["docker", "system", "prune", "-a"], rules)).toBeNull();

      const rulesWithSubcmd = [
        makeRule({
          name: "docker-system-prune",
          command: "docker",
          subcommand: "system",
          blockArgs: ["-a"],
          reason: "Prune all is dangerous",
        }),
      ];
      const result = checkCustomRules(["docker", "system", "prune", "-a"], rulesWithSubcmd);
      expect(result).not.toBeNull();
    });

    test("npm publish --force", () => {
      const rules = [
        makeRule({
          name: "npm-force-publish",
          command: "npm",
          subcommand: "publish",
          blockArgs: ["--force"],
          reason: "Force publish can overwrite existing versions",
        }),
      ];
      const result = checkCustomRules(["npm", "publish", "--force"], rules);
      expect(result).toContain("npm-force-publish");
    });
  });
});
