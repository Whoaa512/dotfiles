/**
 * Config loading, parsing, and validation for custom rules.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface CustomRule {
  name: string;
  command: string;
  subcommand: string | null;
  blockArgs: string[];
  reason: string;
}

export interface Config {
  version: number;
  rules: CustomRule[];
}

export interface ValidationResult {
  errors: string[];
  ruleNames: string[];
}

const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const COMMAND_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const MAX_REASON_LENGTH = 256;

function validateRule(
  ruleData: Record<string, unknown>,
  index: number,
  seenNames: Set<string>
): CustomRule {
  const errors: string[] = [];

  for (const field of ["name", "command", "block_args", "reason"]) {
    if (!(field in ruleData)) {
      errors.push(`rules[${index}]: missing required field '${field}'`);
    }
  }
  if (errors.length) throw new Error(errors.join("; "));

  const name = ruleData.name;
  const command = ruleData.command;
  const subcommand = ruleData.subcommand ?? null;
  const blockArgs = ruleData.block_args;
  const reason = ruleData.reason;

  if (typeof name !== "string") {
    errors.push(`rules[${index}].name: must be a string`);
  } else if (!NAME_PATTERN.test(name)) {
    errors.push(`rules[${index}].name: must match pattern ^[a-zA-Z][a-zA-Z0-9_-]{0,63}$`);
  } else {
    const nameLower = name.toLowerCase();
    if (seenNames.has(nameLower)) {
      errors.push(`rules[${index}].name: duplicate rule name '${name}'`);
    }
    seenNames.add(nameLower);
  }

  if (typeof command !== "string") {
    errors.push(`rules[${index}].command: must be a string`);
  } else if (!COMMAND_PATTERN.test(command)) {
    errors.push(`rules[${index}].command: must match pattern ^[a-zA-Z][a-zA-Z0-9_-]*$`);
  }

  if (subcommand !== null) {
    if (typeof subcommand !== "string") {
      errors.push(`rules[${index}].subcommand: must be a string`);
    } else if (!COMMAND_PATTERN.test(subcommand)) {
      errors.push(`rules[${index}].subcommand: must match pattern ^[a-zA-Z][a-zA-Z0-9_-]*$`);
    }
  }

  if (!Array.isArray(blockArgs)) {
    errors.push(`rules[${index}].block_args: must be an array`);
  } else if (blockArgs.length === 0) {
    errors.push(`rules[${index}].block_args: must not be empty`);
  } else {
    for (let i = 0; i < blockArgs.length; i++) {
      const arg = blockArgs[i];
      if (typeof arg !== "string") {
        errors.push(`rules[${index}].block_args[${i}]: must be a string`);
      } else if (!arg) {
        errors.push(`rules[${index}].block_args[${i}]: must not be empty`);
      }
    }
  }

  if (typeof reason !== "string") {
    errors.push(`rules[${index}].reason: must be a string`);
  } else if (!reason) {
    errors.push(`rules[${index}].reason: must not be empty`);
  } else if (reason.length > MAX_REASON_LENGTH) {
    errors.push(`rules[${index}].reason: exceeds max length of ${MAX_REASON_LENGTH}`);
  }

  if (errors.length) throw new Error(errors.join("; "));

  return {
    name: name as string,
    command: command as string,
    subcommand: subcommand as string | null,
    blockArgs: blockArgs as string[],
    reason: reason as string,
  };
}

function validateConfig(data: Record<string, unknown>): Config {
  if (!("version" in data)) {
    throw new Error("missing required field 'version'");
  }

  const version = data.version;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error("'version' must be an integer");
  }
  if (version !== 1) {
    throw new Error(`unsupported version ${version}, expected 1`);
  }

  const rulesData = data.rules ?? [];
  if (!Array.isArray(rulesData)) {
    throw new Error("'rules' must be an array");
  }

  const seenNames = new Set<string>();
  const rules: CustomRule[] = [];
  for (let i = 0; i < rulesData.length; i++) {
    const ruleData = rulesData[i];
    if (typeof ruleData !== "object" || ruleData === null) {
      throw new Error(`rules[${i}]: must be an object`);
    }
    rules.push(validateRule(ruleData as Record<string, unknown>, i, seenNames));
  }

  return { version, rules };
}

function loadSingleConfig(path: string): Config | null {
  if (!existsSync(path)) return null;

  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    return null;
  }

  if (!content.trim()) return null;

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }

  if (typeof data !== "object" || data === null) return null;

  try {
    return validateConfig(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

function mergeConfigs(userConfig: Config | null, projectConfig: Config | null): Config {
  if (!userConfig && !projectConfig) {
    return { version: 1, rules: [] };
  }

  if (!userConfig) return projectConfig!;
  if (!projectConfig) return userConfig;

  const projectRuleNames = new Set(projectConfig.rules.map((r) => r.name.toLowerCase()));
  const userRulesNotOverridden = userConfig.rules.filter(
    (r) => !projectRuleNames.has(r.name.toLowerCase())
  );
  const mergedRules = [...userRulesNotOverridden, ...projectConfig.rules];

  return { version: 1, rules: mergedRules };
}

export function loadConfig(cwd: string | null = null): Config | null {
  const userPath = join(homedir(), ".cc-safety-net", "config.json");
  const userConfig = loadSingleConfig(userPath);

  let projectConfig: Config | null = null;
  if (cwd) {
    const projectPath = join(cwd, ".safety-net.json");
    projectConfig = loadSingleConfig(projectPath);
  }

  const merged = mergeConfigs(userConfig, projectConfig);

  if (!merged.rules.length && !userConfig && !projectConfig) {
    return null;
  }

  return merged;
}

export function validateConfigFile(path: string): ValidationResult {
  const resolvedPath = path.startsWith("~") ? path.replace("~", homedir()) : path;

  if (!existsSync(resolvedPath)) {
    return { errors: [`file not found: ${path}`], ruleNames: [] };
  }

  let content: string;
  try {
    content = readFileSync(resolvedPath, "utf-8");
  } catch (e) {
    return { errors: [`cannot read file: ${e}`], ruleNames: [] };
  }

  if (!content.trim()) {
    return { errors: ["config file is empty"], ruleNames: [] };
  }

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (e) {
    return { errors: [`invalid JSON: ${e}`], ruleNames: [] };
  }

  if (typeof data !== "object" || data === null) {
    return { errors: ["config must be a JSON object"], ruleNames: [] };
  }

  try {
    const config = validateConfig(data as Record<string, unknown>);
    return { errors: [], ruleNames: config.rules.map((r) => r.name) };
  } catch (e) {
    return { errors: [String(e)], ruleNames: [] };
  }
}
