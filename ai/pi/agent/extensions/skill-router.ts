/**
 * Skill Router
 *
 * Skills and prompt templates don't self-fire. 60-day evidence: `respond` 0
 * invocations vs ~70 Slack-URL asks; `recall` 0 vs ~45 "where was I";
 * deploy-watch 0 vs 9 spinnaker URLs. This extension deterministically matches
 * the user prompt and injects a system-prompt section naming the skill/template
 * to load first.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type Route = { name: string; kind: "skill" | "prompt"; hint: string };

type Rule = { match: RegExp; routes: (prompt: string) => Route[] };

const skill = (name: string, hint = `load the ${name} skill`): Route => ({
	name,
	kind: "skill",
	hint,
});
const prompt = (
	name: string,
	hint = `run ~/.pi/agent/prompts/${name}.md procedure`,
): Route => ({
	name,
	kind: "prompt",
	hint,
});

const SLACK_ASK =
	/\?|\b(wtf|what('s| is)|how (should|do|best)|help|read|respond|reply|take|ask)\b/i;
const SLACK_VOICE = /voice|draft|reply|respond/i;
const PR_URL = /(git\.musta\.ch|github\.com)\/[\w.-]+\/[\w.-]+\/pull\/\d+/i;
const PR_REVIEW_VERB =
	/review|stamp|approve|critical|optimal|targeted|read on|overengineer|feedback/i;

export const RULES: Rule[] = [
	{
		match: /grafana\.a\.musta\.ch\/a\/watchpoint|telescope\.a\.musta\.ch/i,
		routes: () => [skill("oncall-alert-triage")],
	},
	{ match: /spinnaker\.a\.musta\.ch/i, routes: () => [skill("deploy-watch")] },
	{
		match: /airbnb\.slack\.com\/archives/i,
		routes: (p) => {
			if (!SLACK_ASK.test(p)) return [];
			const out = [skill("slack"), prompt("respond")];
			if (SLACK_VOICE.test(p)) out.push(skill("cj-voice"));
			return out;
		},
	},
	{
		match: PR_URL,
		routes: (p) => (PR_REVIEW_VERB.test(p) ? [skill("pr-review")] : []),
	},
	{
		match:
			/\b(what (was|am) i (doing|working on)|where (did i|was i|are we|am i)|catch me up|left off|no idea what|pick(ing)? up (this|where)|recap|scatter(ed|brained)|back to this|status of (things|the worktrees))\b/i,
		routes: () => [prompt("recall")],
	},
	{
		match:
			/\b(fact ?check|u sure|are you sure|is that (true|really)|did you actually (check|verify)|verify (this|that) claim)\b/i,
		routes: () => [skill("factcheck")],
	},
	{
		match: /\bstatus update\b|draft my update|status thread/i,
		routes: () => [skill("status-update")],
	},
	{
		match:
			/\bin my voice\b|draft (a |the )?(reply|response|comment)|how should i respond|tcb a reply/i,
		routes: () => [skill("cj-voice")],
	},
	{
		match: /buildkite\.com\/[\w-]+\/[\w-]+\/builds\/\d+/i,
		routes: () => [skill("buildkite")],
	},
];

const SKIP_OPENERS = [
	"<skill name=",
	"Use the pr-review skill",
	"Reconstruct my recent work state",
	"Investigate and draft a response for",
	"Run a mining pass",
	"Review the last",
	"Read and brief me on",
];

export function routePrompt(text: string): Route[] {
	const trimmed = text.trimStart();
	if (SKIP_OPENERS.some((o) => trimmed.startsWith(o))) return [];

	const seen = new Set<string>();
	const routes: Route[] = [];
	for (const rule of RULES) {
		if (!rule.match.test(text)) continue;
		for (const r of rule.routes(text)) {
			if (seen.has(r.name)) continue;
			seen.add(r.name);
			routes.push(r);
		}
	}
	return routes;
}

export function buildSection(routes: Route[]): string {
	const list = routes.map((r) => `${r.name} (${r.kind})`).join(", ");
	return (
		`<skill_router>\nThe user's message matches: ${list}. Load and follow it before improvising. ` +
		`Skills live in the <available_skills> list; prompt templates in ~/.pi/agent/prompts/<name>.md.\n</skill_router>`
	);
}

export default function (pi: ExtensionAPI) {
	const notified = new Set<string>();

	pi.on("before_agent_start", (event, ctx) => {
		const routes = routePrompt(event.prompt);
		if (routes.length === 0) {
			delete event.systemPromptOptions.sections.skill_router;
			return;
		}
		event.systemPromptOptions.sections.skill_router = buildSection(routes);

		const names = routes.map((r) => r.name).join(", ");
		if (!ctx.hasUI || notified.has(names)) return;
		notified.add(names);
		ctx.ui.notify(`router → ${names}`, "info");
	});
}
