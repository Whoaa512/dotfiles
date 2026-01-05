/**
 * Shell parsing helpers for the safety net.
 */

export function splitShellCommands(command: string): string[] {
  const parts: string[] = [];
  const buf: string[] = [];
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  let i = 0;
  while (i < command.length) {
    const ch = command[i];

    if (escape) {
      buf.push(ch);
      escape = false;
      i++;
      continue;
    }

    if (ch === "\\" && !inSingle) {
      buf.push(ch);
      escape = true;
      i++;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      buf.push(ch);
      i++;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      buf.push(ch);
      i++;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (command.startsWith("&&", i) || command.startsWith("||", i)) {
        const part = buf.join("").trim();
        if (part) parts.push(part);
        buf.length = 0;
        i += 2;
        continue;
      }
      if (command.startsWith("|&", i)) {
        const part = buf.join("").trim();
        if (part) parts.push(part);
        buf.length = 0;
        i += 2;
        continue;
      }
      if (ch === "|") {
        const part = buf.join("").trim();
        if (part) parts.push(part);
        buf.length = 0;
        i++;
        continue;
      }
      if (ch === "&") {
        const prev = i > 0 ? command[i - 1] : "";
        const nxt = i + 1 < command.length ? command[i + 1] : "";
        if (prev === ">" || prev === "<" || nxt === ">") {
          buf.push(ch);
          i++;
          continue;
        }
        const part = buf.join("").trim();
        if (part) parts.push(part);
        buf.length = 0;
        i++;
        continue;
      }
      if (ch === ";" || ch === "\n") {
        const part = buf.join("").trim();
        if (part) parts.push(part);
        buf.length = 0;
        i++;
        continue;
      }
    }

    buf.push(ch);
    i++;
  }

  const part = buf.join("").trim();
  if (part) parts.push(part);
  return parts;
}

export function shlexSplit(segment: string): string[] | null {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];

    if (escape) {
      current += ch;
      escape = false;
      continue;
    }

    if (ch === "\\" && !inSingle) {
      escape = true;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && /\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (inSingle || inDouble) {
    return null;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function stripEnvAssignments(tokens: string[]): string[] {
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (!tok.includes("=")) break;
    const [key] = tok.split("=", 1);
    if (!key || !/^[a-zA-Z_]/.test(key)) break;
    if (!/^[a-zA-Z0-9_]+$/.test(key)) break;
    i++;
  }
  return tokens.slice(i);
}

export function stripWrappers(tokens: string[]): string[] {
  let previous: string[] | null = null;
  let depth = 0;

  while (tokens.length && !arraysEqual(tokens, previous) && depth < 20) {
    previous = [...tokens];
    depth++;

    tokens = stripEnvAssignments(tokens);
    if (!tokens.length) return tokens;

    const head = tokens[0].toLowerCase();

    if (head === "sudo") {
      let i = 1;
      while (i < tokens.length && tokens[i].startsWith("-") && tokens[i] !== "--") {
        i++;
      }
      if (i < tokens.length && tokens[i] === "--") i++;
      tokens = tokens.slice(i);
      continue;
    }

    if (head === "env") {
      let i = 1;
      while (i < tokens.length) {
        const tok = tokens[i];
        if (tok === "--") {
          i++;
          break;
        }
        if (["-u", "--unset", "-C", "-P", "-S"].includes(tok)) {
          i += 2;
          continue;
        }
        if (tok.startsWith("--unset=") || tok.startsWith("-u") || tok.startsWith("-C") || tok.startsWith("-P") || tok.startsWith("-S")) {
          if (tok.length > 2) {
            i++;
            continue;
          }
        }
        if (tok.startsWith("-") && tok !== "-") {
          i++;
          continue;
        }
        break;
      }
      tokens = tokens.slice(i);
      continue;
    }

    if (head === "command") {
      let i = 1;
      while (i < tokens.length) {
        const tok = tokens[i];
        if (tok === "--") {
          i++;
          break;
        }
        if (["-p", "-v", "-V"].includes(tok)) {
          i++;
          continue;
        }
        if (tok.startsWith("-") && tok !== "-" && !tok.startsWith("--")) {
          const chars = tok.slice(1);
          if (chars && [...chars].every((c) => ["p", "v", "V"].includes(c))) {
            i++;
            continue;
          }
        }
        break;
      }
      tokens = tokens.slice(i);
      continue;
    }

    break;
  }

  return stripEnvAssignments(tokens);
}

export function shortOpts(tokens: string[]): Set<string> {
  const opts = new Set<string>();
  for (const tok of tokens) {
    if (tok === "--") break;
    if (tok.startsWith("--") || !tok.startsWith("-") || tok === "-") continue;
    for (const ch of tok.slice(1)) {
      if (!/[a-zA-Z]/.test(ch)) break;
      opts.add(ch);
    }
  }
  return opts;
}

function arraysEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
