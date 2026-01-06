import { describe, test, expect } from "bun:test";
import {
  analyzePipeToShell,
  analyzeForkBomb,
  analyzeDecodeToShell,
  analyzeGitHistory,
  analyzeSecureDelete,
  analyzeChmod,
  analyzeChown,
  analyzeFilesystemDestruction,
  analyzeKill,
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

describe("analyzeChmod", () => {
  describe("world-writable recursive", () => {
    test("blocks chmod -R 777", () => {
      expect(analyzeChmod(["chmod", "-R", "777", "/some/dir"])).not.toBeNull();
    });

    test("blocks chmod 777 -R", () => {
      expect(analyzeChmod(["chmod", "777", "-R", "/some/dir"])).not.toBeNull();
    });

    test("blocks chmod -R 666", () => {
      expect(analyzeChmod(["chmod", "-R", "666", "/some/dir"])).not.toBeNull();
    });

    test("blocks chmod --recursive 777", () => {
      expect(analyzeChmod(["chmod", "--recursive", "777", "/some/dir"])).not.toBeNull();
    });

    test("allows chmod 777 without -R", () => {
      expect(analyzeChmod(["chmod", "777", "file.txt"])).toBeNull();
    });

    test("allows chmod -R 755", () => {
      expect(analyzeChmod(["chmod", "-R", "755", "/some/dir"])).toBeNull();
    });

    test("allows chmod -R 644", () => {
      expect(analyzeChmod(["chmod", "-R", "644", "/some/dir"])).toBeNull();
    });
  });
});

describe("analyzeChown", () => {
  describe("recursive on sensitive paths", () => {
    test("blocks chown -R on /", () => {
      expect(analyzeChown(["chown", "-R", "root:root", "/"])).not.toBeNull();
    });

    test("blocks chown -R on /etc", () => {
      expect(analyzeChown(["chown", "-R", "root:root", "/etc"])).not.toBeNull();
    });

    test("blocks chown -R on /usr", () => {
      expect(analyzeChown(["chown", "-R", "user:user", "/usr"])).not.toBeNull();
    });

    test("blocks chown -R on /var", () => {
      expect(analyzeChown(["chown", "-R", "www-data:www-data", "/var"])).not.toBeNull();
    });

    test("blocks chown -R on /home", () => {
      expect(analyzeChown(["chown", "-R", "user:user", "/home"])).not.toBeNull();
    });

    test("blocks chown -R on ~", () => {
      expect(analyzeChown(["chown", "-R", "user:user", "~"])).not.toBeNull();
    });

    test("blocks chown --recursive on /", () => {
      expect(analyzeChown(["chown", "--recursive", "root:root", "/"])).not.toBeNull();
    });

    test("blocks chown -R on /etc/passwd (subdirectory)", () => {
      expect(analyzeChown(["chown", "-R", "user:user", "/etc/passwd"])).not.toBeNull();
    });

    test("blocks chown -R on /etc/foo (subdirectory)", () => {
      expect(analyzeChown(["chown", "-R", "user:user", "/etc/foo"])).not.toBeNull();
    });

    test("blocks chown -R on /usr/bin (subdirectory)", () => {
      expect(analyzeChown(["chown", "-R", "user:user", "/usr/bin"])).not.toBeNull();
    });

    test("blocks chown -R on /var/log (subdirectory)", () => {
      expect(analyzeChown(["chown", "-R", "user:user", "/var/log"])).not.toBeNull();
    });

    test("blocks chown -R on /home/user (subdirectory)", () => {
      expect(analyzeChown(["chown", "-R", "user:user", "/home/user"])).not.toBeNull();
    });

    test("allows chown -R on safe paths", () => {
      expect(analyzeChown(["chown", "-R", "user:user", "/tmp/mydir"])).toBeNull();
    });

    test("allows chown without -R on /", () => {
      expect(analyzeChown(["chown", "root:root", "/some/file"])).toBeNull();
    });

    test("allows chown on project dirs", () => {
      expect(analyzeChown(["chown", "-R", "user:user", "./myproject"])).toBeNull();
    });
  });
});

describe("analyzeFilesystemDestruction", () => {
  describe("mkfs variants", () => {
    test("blocks mkfs", () => {
      expect(analyzeFilesystemDestruction(["mkfs", "/dev/sda1"])).not.toBeNull();
    });

    test("blocks mkfs.ext4", () => {
      expect(analyzeFilesystemDestruction(["mkfs.ext4", "/dev/sda1"])).not.toBeNull();
    });

    test("blocks mkfs.xfs", () => {
      expect(analyzeFilesystemDestruction(["mkfs.xfs", "/dev/nvme0n1p1"])).not.toBeNull();
    });

    test("blocks mkfs.btrfs", () => {
      expect(analyzeFilesystemDestruction(["mkfs.btrfs", "/dev/sdb"])).not.toBeNull();
    });

    test("blocks mkfs.vfat", () => {
      expect(analyzeFilesystemDestruction(["mkfs.vfat", "-F", "32", "/dev/sdc1"])).not.toBeNull();
    });

    test("blocks /sbin/mkfs.ext4", () => {
      expect(analyzeFilesystemDestruction(["/sbin/mkfs.ext4", "/dev/sda1"])).not.toBeNull();
    });
  });

  describe("wipefs", () => {
    test("blocks wipefs", () => {
      expect(analyzeFilesystemDestruction(["wipefs", "/dev/sda"])).not.toBeNull();
    });

    test("blocks wipefs -a", () => {
      expect(analyzeFilesystemDestruction(["wipefs", "-a", "/dev/sda"])).not.toBeNull();
    });

    test("blocks /usr/sbin/wipefs", () => {
      expect(analyzeFilesystemDestruction(["/usr/sbin/wipefs", "-a", "/dev/sda"])).not.toBeNull();
    });
  });

  describe("mkswap", () => {
    test("blocks mkswap", () => {
      expect(analyzeFilesystemDestruction(["mkswap", "/dev/sda2"])).not.toBeNull();
    });

    test("blocks mkswap with label", () => {
      expect(analyzeFilesystemDestruction(["mkswap", "-L", "swap", "/dev/sda2"])).not.toBeNull();
    });

    test("blocks /sbin/mkswap", () => {
      expect(analyzeFilesystemDestruction(["/sbin/mkswap", "/dev/sda2"])).not.toBeNull();
    });
  });

  describe("safe commands", () => {
    test("allows empty tokens", () => {
      expect(analyzeFilesystemDestruction([])).toBeNull();
    });

    test("allows unrelated commands", () => {
      expect(analyzeFilesystemDestruction(["ls", "-la"])).toBeNull();
    });

    test("allows mkdir", () => {
      expect(analyzeFilesystemDestruction(["mkdir", "-p", "/tmp/test"])).toBeNull();
    });
  });
});

describe("analyzeKill", () => {
  describe("kill command", () => {
    test("blocks kill -9 -1", () => {
      expect(analyzeKill(["kill", "-9", "-1"])).not.toBeNull();
    });

    test("blocks kill -KILL -1", () => {
      expect(analyzeKill(["kill", "-KILL", "-1"])).not.toBeNull();
    });

    test("blocks kill -SIGKILL -1", () => {
      expect(analyzeKill(["kill", "-SIGKILL", "-1"])).not.toBeNull();
    });

    test("blocks kill -s 9 -1", () => {
      expect(analyzeKill(["kill", "-s", "9", "-1"])).not.toBeNull();
    });

    test("blocks kill -s KILL -1", () => {
      expect(analyzeKill(["kill", "-s", "KILL", "-1"])).not.toBeNull();
    });

    test("allows kill -9 1234 (specific PID)", () => {
      expect(analyzeKill(["kill", "-9", "1234"])).toBeNull();
    });

    test("allows kill -9 1234 5678 (multiple PIDs)", () => {
      expect(analyzeKill(["kill", "-9", "1234", "5678"])).toBeNull();
    });

    test("allows kill 1234", () => {
      expect(analyzeKill(["kill", "1234"])).toBeNull();
    });

    test("allows kill -15 -1 (SIGTERM, not SIGKILL)", () => {
      expect(analyzeKill(["kill", "-15", "-1"])).toBeNull();
    });
  });

  describe("killall command", () => {
    test("blocks killall -9 (no process name)", () => {
      expect(analyzeKill(["killall", "-9"])).not.toBeNull();
    });

    test("blocks killall -KILL (no process name)", () => {
      expect(analyzeKill(["killall", "-KILL"])).not.toBeNull();
    });

    test("blocks killall --signal=9 (no process name)", () => {
      expect(analyzeKill(["killall", "--signal=9"])).not.toBeNull();
    });

    test("allows killall -9 firefox (specific process)", () => {
      expect(analyzeKill(["killall", "-9", "firefox"])).toBeNull();
    });

    test("allows killall firefox", () => {
      expect(analyzeKill(["killall", "firefox"])).toBeNull();
    });

    test("allows killall -15 (SIGTERM without process is less dangerous)", () => {
      expect(analyzeKill(["killall", "-15"])).toBeNull();
    });
  });

  describe("pkill command", () => {
    test("blocks pkill -9 (no pattern)", () => {
      expect(analyzeKill(["pkill", "-9"])).not.toBeNull();
    });

    test("blocks pkill -KILL (no pattern)", () => {
      expect(analyzeKill(["pkill", "-KILL"])).not.toBeNull();
    });

    test("blocks pkill --signal=9 (no pattern)", () => {
      expect(analyzeKill(["pkill", "--signal=9"])).not.toBeNull();
    });

    test("allows pkill -9 firefox (specific pattern)", () => {
      expect(analyzeKill(["pkill", "-9", "firefox"])).toBeNull();
    });

    test("allows pkill firefox", () => {
      expect(analyzeKill(["pkill", "firefox"])).toBeNull();
    });

    test("allows pkill -15 (SIGTERM without pattern is less dangerous)", () => {
      expect(analyzeKill(["pkill", "-15"])).toBeNull();
    });

    test("allows pkill -9 -- pattern (pattern after --)", () => {
      expect(analyzeKill(["pkill", "-9", "--", "myprocess"])).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("allows empty tokens", () => {
      expect(analyzeKill([])).toBeNull();
    });

    test("allows unrelated commands", () => {
      expect(analyzeKill(["ls", "-la"])).toBeNull();
    });

    test("handles /usr/bin/kill path", () => {
      expect(analyzeKill(["/usr/bin/kill", "-9", "-1"])).not.toBeNull();
    });
  });
});
