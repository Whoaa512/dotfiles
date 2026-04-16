/**
 * Session Topic & Status Reporter
 *
 * After the first agent turn, calls gpt-4.1-nano via devai gateway
 * to produce a short topic summary. Writes per-cwd topic to
 * ~/.pi/agent/session-topics.json for the branch dashboard.
 *
 * After every agent turn, classifies whether the agent completed its
 * task or is waiting for user input, with a short summary of what
 * it's waiting for. This powers the attention bar in the dashboard.
 *
 * Only summarizes topic once per session (after first agent_end).
 * Status is updated on every agent_end.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";

const TOPICS_FILE = join(homedir(), ".pi", "agent", "session-topics.json");
const DEVAI_URL = "https://devaigateway.a.musta.ch/v1/chat/completions";
const MODEL = "gpt-4.1-nano";

type AgentStatus = {
	state: "completed" | "waiting_for_input";
	summary: string;
	updatedAt: string;
};

type TopicEntry = {
	topic: string;
	updatedAt: string;
	sessionFile?: string;
	agentStatus?: AgentStatus;
};
type TopicsMap = Record<string, TopicEntry>;

function loadTopics(): TopicsMap {
	try {
		return JSON.parse(readFileSync(TOPICS_FILE, "utf-8"));
	} catch {
		return {};
	}
}

function saveTopics(topics: TopicsMap) {
	mkdirSync(join(homedir(), ".pi", "agent"), { recursive: true });
	writeFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2) + "\n");
}

function extractFirstUserMessage(entries: any[]): string | null {
	for (const entry of entries) {
		if (entry.type !== "message" || entry.message?.role !== "user") continue;
		const content = entry.message.content;
		if (typeof content === "string" && content.trim()) return content.trim();
		if (Array.isArray(content)) {
			for (const part of content) {
				if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) {
					return part.text.trim();
				}
			}
		}
	}
	return null;
}

function extractLastAssistantText(entries: any[]): string | null {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry?.type !== "message" || entry.message?.role !== "assistant") continue;
		const content = entry.message.content;
		if (typeof content === "string" && content.trim()) return content.trim();
		if (Array.isArray(content)) {
			const texts: string[] = [];
			for (const part of content) {
				if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) {
					texts.push(part.text.trim());
				}
			}
			if (texts.length) return texts.join("\n");
		}
	}
	return null;
}

function extractLastUserText(entries: any[]): string | null {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry?.type !== "message" || entry.message?.role !== "user") continue;
		const content = entry.message.content;
		if (typeof content === "string" && content.trim()) return content.trim();
		if (Array.isArray(content)) {
			for (const part of content) {
				if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) {
					return part.text.trim();
				}
			}
		}
	}
	return null;
}

function getIapToken(): string | null {
	try {
		return execSync("iap-auth", { encoding: "utf-8", timeout: 5000 }).trim();
	} catch {
		return null;
	}
}

async function callNano(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string | null> {
	const token = getIapToken();
	if (!token) return null;

	try {
		const resp = await fetch(DEVAI_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: MODEL,
				max_tokens: maxTokens,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt },
				],
			}),
			signal: AbortSignal.timeout(8000),
		});

		if (!resp.ok) return null;
		const data = (await resp.json()) as any;
		return data?.choices?.[0]?.message?.content?.trim() || null;
	} catch {
		return null;
	}
}

async function summarizeTopic(text: string): Promise<string | null> {
	return callNano(
		"You produce ultra-short topic summaries. Output ONLY the summary, nothing else.",
		`Summarize this conversation topic in 5-8 words:\n\n${text.slice(0, 500)}`,
		30,
	);
}

async function classifyAgentStatus(
	lastUserMsg: string | null,
	lastAssistantMsg: string | null,
): Promise<AgentStatus | null> {
	if (!lastAssistantMsg) return null;

	const context = [
		lastUserMsg ? `USER: ${lastUserMsg.slice(0, 300)}` : "",
		`ASSISTANT: ${lastAssistantMsg.slice(0, 800)}`,
	]
		.filter(Boolean)
		.join("\n\n");

	const result = await callNano(
		`You classify AI coding agent responses. Output EXACTLY one line in this format:
STATE|summary

STATE is one of:
- completed: agent finished the task, reporting results, no question asked
- waiting_for_input: agent is asking a question, presenting options, needs a decision, or asked the user to review something

summary is 5-12 words describing what happened or what's needed.

Examples:
completed|Refactored auth module and added tests
waiting_for_input|Which database migration strategy to use?
waiting_for_input|Review the proposed API changes
completed|Fixed the failing CI build
waiting_for_input|Choose between approach A or B`,
		context,
		60,
	);

	if (!result) return null;

	const pipe = result.indexOf("|");
	if (pipe === -1) return null;

	const state = result.slice(0, pipe).trim().toLowerCase();
	const summary = result.slice(pipe + 1).trim();

	if (state !== "completed" && state !== "waiting_for_input") return null;
	if (!summary) return null;

	return {
		state: state as "completed" | "waiting_for_input",
		summary,
		updatedAt: new Date().toISOString(),
	};
}

function writeTopic(cwd: string, topic: string, sessionFile?: string, agentStatus?: AgentStatus) {
	const topics = loadTopics();
	const existing = topics[cwd];
	topics[cwd] = {
		topic,
		updatedAt: new Date().toISOString(),
		sessionFile,
		agentStatus: agentStatus ?? existing?.agentStatus,
	};
	saveTopics(topics);
}

function writeAgentStatus(cwd: string, agentStatus: AgentStatus) {
	const topics = loadTopics();
	if (topics[cwd]) {
		topics[cwd].agentStatus = agentStatus;
		topics[cwd].updatedAt = new Date().toISOString();
	} else {
		topics[cwd] = {
			topic: "",
			updatedAt: new Date().toISOString(),
			agentStatus,
		};
	}
	saveTopics(topics);
}

export default function (pi: ExtensionAPI) {
	let hasSummarizedTopic = false;

	pi.on("session_start", async (_event, ctx) => {
		hasSummarizedTopic = false;

		const cwd = ctx.cwd;
		const existing = loadTopics()[cwd];
		const sessionFile = ctx.sessionManager.getSessionFile() ?? undefined;
		if (existing?.sessionFile === sessionFile) {
			hasSummarizedTopic = true;
		}
	});

	pi.on("agent_end", async (_event, ctx) => {
		const cwd = ctx.cwd;
		const sessionFile = ctx.sessionManager.getSessionFile() ?? undefined;
		const entries = ctx.sessionManager.getBranch();

		const classifyPromise = (async () => {
			const lastUser = extractLastUserText(entries);
			const lastAssistant = extractLastAssistantText(entries);
			const status = await classifyAgentStatus(lastUser, lastAssistant);
			if (status) {
				writeAgentStatus(cwd, status);
			}
		})();

		if (hasSummarizedTopic) {
			classifyPromise.catch(() => {});
			return;
		}
		hasSummarizedTopic = true;

		const name = pi.getSessionName();
		if (name) {
			writeTopic(cwd, name, sessionFile);
			classifyPromise.catch(() => {});
			return;
		}

		const firstMsg = extractFirstUserMessage(entries);
		if (!firstMsg) {
			classifyPromise.catch(() => {});
			return;
		}

		summarizeTopic(firstMsg)
			.then((summary) => {
				if (summary) {
					writeTopic(cwd, summary, sessionFile);
				} else {
					const line = firstMsg.split("\n")[0]!;
					writeTopic(cwd, line.length > 60 ? line.slice(0, 59) + "…" : line, sessionFile);
				}
			})
			.catch(() => {});

		classifyPromise.catch(() => {});
	});
}
