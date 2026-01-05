#!/usr/bin/env bun
/**
 * Scan files for common prompt injection patterns
 * Usage: bun run scan-injections.ts [path]
 */

import { $ } from "bun";
import { readdir, stat } from "fs/promises";
import { join, relative } from "path";

interface Finding {
  file: string;
  line: number;
  pattern: string;
  severity: "high" | "medium" | "low";
  context: string;
}

// High severity - direct injection attempts
const HIGH_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /forget\s+(everything|all|your)\s+(you|instructions?|rules?)/i,
  /new\s+instructions?\s*:/i,
  /system\s*:\s*you\s+are/i,
  /\[SYSTEM\]/i,
  /\<\|im_start\|\>/i,
  /\<\|endoftext\|\>/i,
  /<\/?(?:system|assistant|user)>/i,
];

// Medium severity - role manipulation
const MEDIUM_PATTERNS = [
  /you\s+are\s+now\s+(a|an|the)/i,
  /act\s+as\s+(a|an|if|though)/i,
  /pretend\s+(you're|you\s+are|to\s+be)/i,
  /roleplay\s+as/i,
  /from\s+now\s+on,?\s+you/i,
  /switch\s+to\s+.{0,20}\s+mode/i,
  /enable\s+(developer|debug|admin|sudo)\s+mode/i,
  /bypass\s+(safety|filter|restriction)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];

// Low severity - suspicious but common
const LOW_PATTERNS = [
  /IMPORTANT\s*:/i,
  /CRITICAL\s*:/i,
  /URGENT\s*:/i,
  /DO\s+NOT\s+.{0,30}\s+UNDER\s+ANY/i,
  /override/i,
];

// Zero-width and invisible unicode
const UNICODE_PATTERNS = [
  /[\u200B-\u200F\u2028-\u202F\uFEFF]/,  // zero-width chars
  /[\u2060-\u206F]/,  // invisible formatters
  /[\uE000-\uF8FF]/,  // private use area
];

const EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".yaml", ".yml", ".toml",
  ".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".sh",
  ".html", ".htm", ".xml", ".svg", ".css",
]);

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.isDirectory()) {
      yield* walkDir(path);
    } else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf("."));
      if (EXTENSIONS.has(ext)) yield path;
    }
  }
}

function scanContent(content: string, file: string, basePath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");
  const relFile = relative(basePath, file);

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Check high severity
    for (const pat of HIGH_PATTERNS) {
      if (pat.test(line)) {
        findings.push({
          file: relFile,
          line: lineNum,
          pattern: pat.source.slice(0, 40),
          severity: "high",
          context: line.trim().slice(0, 80),
        });
      }
    }

    // Check medium severity
    for (const pat of MEDIUM_PATTERNS) {
      if (pat.test(line)) {
        findings.push({
          file: relFile,
          line: lineNum,
          pattern: pat.source.slice(0, 40),
          severity: "medium",
          context: line.trim().slice(0, 80),
        });
      }
    }

    // Check low severity
    for (const pat of LOW_PATTERNS) {
      if (pat.test(line)) {
        findings.push({
          file: relFile,
          line: lineNum,
          pattern: pat.source.slice(0, 40),
          severity: "low",
          context: line.trim().slice(0, 80),
        });
      }
    }

    // Check unicode
    for (const pat of UNICODE_PATTERNS) {
      if (pat.test(line)) {
        findings.push({
          file: relFile,
          line: lineNum,
          pattern: "hidden-unicode",
          severity: "high",
          context: `Hidden unicode chars detected: ${[...line].filter(c => pat.test(c)).map(c => `U+${c.charCodeAt(0).toString(16).toUpperCase()}`).join(", ")}`,
        });
      }
    }
  });

  // Check for base64 encoded potential injections
  const b64Matches = content.match(/[A-Za-z0-9+/]{40,}={0,2}/g) || [];
  for (const match of b64Matches) {
    try {
      const decoded = atob(match);
      for (const pat of [...HIGH_PATTERNS, ...MEDIUM_PATTERNS]) {
        if (pat.test(decoded)) {
          findings.push({
            file: relFile,
            line: 0,
            pattern: "base64-encoded-injection",
            severity: "high",
            context: `Decoded: ${decoded.slice(0, 60)}...`,
          });
        }
      }
    } catch {}
  }

  return findings;
}

async function main() {
  const targetPath = process.argv[2] || ".";
  const basePath = await Bun.file(targetPath).exists()
    ? targetPath
    : process.cwd();

  const allFindings: Finding[] = [];

  const pathStat = await stat(targetPath);
  if (pathStat.isFile()) {
    const content = await Bun.file(targetPath).text();
    allFindings.push(...scanContent(content, targetPath, basePath));
  } else {
    for await (const file of walkDir(targetPath)) {
      try {
        const content = await Bun.file(file).text();
        allFindings.push(...scanContent(content, file, basePath));
      } catch {}
    }
  }

  // Dedupe by file+line+pattern
  const seen = new Set<string>();
  const unique = allFindings.filter(f => {
    const key = `${f.file}:${f.line}:${f.pattern}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by severity
  const order = { high: 0, medium: 1, low: 2 };
  unique.sort((a, b) => order[a.severity] - order[b.severity]);

  // Output
  const high = unique.filter(f => f.severity === "high");
  const medium = unique.filter(f => f.severity === "medium");
  const low = unique.filter(f => f.severity === "low");

  console.log(`\n🔍 Prompt Injection Scan: ${targetPath}\n`);

  if (high.length) {
    console.log(`🔴 HIGH RISK (${high.length}):`);
    high.forEach(f => console.log(`  ${f.file}:${f.line} - ${f.context}`));
    console.log();
  }

  if (medium.length) {
    console.log(`🟡 MEDIUM RISK (${medium.length}):`);
    medium.forEach(f => console.log(`  ${f.file}:${f.line} - ${f.context}`));
    console.log();
  }

  if (low.length) {
    console.log(`🟢 LOW RISK (${low.length}):`);
    low.slice(0, 10).forEach(f => console.log(`  ${f.file}:${f.line} - ${f.context}`));
    if (low.length > 10) console.log(`  ... and ${low.length - 10} more`);
    console.log();
  }

  if (!unique.length) {
    console.log("✅ No prompt injection patterns detected.\n");
  }

  // Exit code based on findings
  process.exit(high.length > 0 ? 2 : medium.length > 0 ? 1 : 0);
}

main();
