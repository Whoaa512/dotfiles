/**
 * find command parsing and dangerous action detection.
 */

import { stripTokenWrappers, normalizeCmdToken } from "../normalize.js";
import { stripWrappers, shortOpts } from "../shell.js";

/**
 * Check for dangerous actions in find command args.
 * Detects: -delete, -exec rm -rf, -exec shell -c with dangerous content.
 */
export function findDangerousAction(
  args: string[],
  dangerousInText: (text: string) => string | null,
  dangerousFindDeleteInText: (text: string) => string | null
): string | null {
  const consumesOne = new Set([
    "-name", "-iname", "-path", "-ipath", "-wholename", "-iwholename",
    "-regex", "-iregex", "-lname", "-ilname", "-samefile", "-newer",
    "-newerxy", "-perm", "-user", "-group", "-printf", "-fprintf",
    "-fprint", "-fprint0", "-fls",
  ]);

  const execLike = new Set(["-exec", "-execdir", "-ok", "-okdir"]);

  let i = 0;
  while (i < args.length) {
    const tok = stripTokenWrappers(args[i]).toLowerCase();

    if (execLike.has(tok)) {
      const execStart = i + 1;
      i++;
      while (i < args.length) {
        const end = stripTokenWrappers(args[i]);
        if (end === ";" || end === "+") break;
        i++;
      }

      let execTokens = args.slice(execStart, i);
      if (execTokens.length) {
        execTokens = stripWrappers(execTokens);
        if (!execTokens.length) {
          i++;
          continue;
        }

        let cmd = normalizeCmdToken(execTokens[0]);

        if (cmd === "busybox" && execTokens.length >= 2) {
          const applet = normalizeCmdToken(execTokens[1]);
          if (applet === "rm") {
            execTokens = ["rm", ...execTokens.slice(2)];
            cmd = "rm";
          }
        }

        if (cmd === "rm") {
          const opts: string[] = [];
          for (const t of execTokens.slice(1)) {
            if (t === "--") break;
            opts.push(t);
          }
          const optsLower = opts.map((t) => t.toLowerCase());
          const short = shortOpts(opts);
          const recursive = optsLower.includes("--recursive") || short.has("r") || short.has("R");
          const force = optsLower.includes("--force") || short.has("f");
          if (recursive && force) {
            return (
              "find -exec rm -rf runs destructive deletion on matched " +
              "files. Use find -print first to verify targets."
            );
          }
        }

        // Handle shell wrappers in -exec: find -exec sh -c 'rm -rf {}' \;
        if (["bash", "sh", "zsh", "dash", "ksh"].includes(cmd)) {
          const dashCArg = extractDashCArg(execTokens);
          if (dashCArg !== null) {
            const innerDanger = dangerousInText(dashCArg) || dangerousFindDeleteInText(dashCArg);
            if (innerDanger) {
              return (
                "find -exec shell -c contains dangerous command. " +
                "Use find -print first to verify targets."
              );
            }
          }
        }
      }

      i++;
      continue;
    }

    if (consumesOne.has(tok)) {
      i += 2;
      continue;
    }

    if (tok === "-delete") {
      return (
        "find -delete permanently removes files matching the criteria. " +
        "Use find -print first to verify targets."
      );
    }

    i++;
  }

  return null;
}

/**
 * Extract the argument to -c flag from shell tokens.
 */
function extractDashCArg(tokens: string[]): string | null {
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "--") return null;
    if (tok === "-c") {
      return i + 1 < tokens.length ? tokens[i + 1] : null;
    }
    if (tok.startsWith("-") && tok.length > 1 && /^[a-z]+$/i.test(tok.slice(1))) {
      const letters = new Set(tok.slice(1));
      if (letters.has("c") && [...letters].every((c) => ["c", "l", "i", "s"].includes(c))) {
        return i + 1 < tokens.length ? tokens[i + 1] : null;
      }
    }
  }
  return null;
}
