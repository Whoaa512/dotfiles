import { describe, expect, test } from "bun:test";
import { buildSection, routePrompt } from "../extensions/skill-router";

const names = (p: string) => routePrompt(p).map((r) => r.name);

const positive: [string, string[]][] = [
	[
		"plz root cause https://grafana.a.musta.ch/a/watchpoint/alert/123",
		["oncall-alert-triage"],
	],
	["https://telescope.a.musta.ch/d/abc is this real?", ["oncall-alert-triage"]],
	[
		"watch https://spinnaker.a.musta.ch/#/applications/x/executions/y",
		["deploy-watch"],
	],
	[
		"https://airbnb.slack.com/archives/C123/p456 wtf is this",
		["slack", "respond"],
	],
	[
		"https://airbnb.slack.com/archives/C123/p456 how should i respond",
		["slack", "respond", "cj-voice"],
	],
	[
		"https://airbnb.slack.com/archives/C123/p456 draft a reply in my voice",
		["slack", "respond", "cj-voice"],
	],
	["review this https://git.musta.ch/airbnb/ergo/pull/123", ["pr-review"]],
	["good to stamp? https://github.com/foo/bar/pull/9", ["pr-review"]],
	["where are we at", ["recall"]],
	["what was i working on yesterday", ["recall"]],
	["catch me up", ["recall"]],
	["u sure?", ["factcheck"]],
	["fact check this for me", ["factcheck"]],
	["status update me", ["status-update"]],
	["draft my update", ["status-update"]],
	["write this in my voice", ["cj-voice"]],
	["tcb a reply", ["cj-voice"]],
	["https://buildkite.com/airbnb/ergo/builds/42 why red", ["buildkite"]],
];

const negative: string[] = [
	"https://git.musta.ch/airbnb/ergo/pull/123",
	"https://airbnb.slack.com/archives/C123/p456",
	'<skill name="slack">do stuff</skill>',
	"Use the pr-review skill on https://git.musta.ch/a/b/pull/1 and review it",
	"Reconstruct my recent work state and tell me where was i",
	"Reply with exactly: ok",
	"fix the lint error in foo.ts",
	"https://grafana.a.musta.ch/d/dashboard-only",
];

describe("routePrompt", () => {
	for (const [p, expected] of positive)
		test(`routes: ${p}`, () => expect(names(p)).toEqual(expected));
	for (const p of negative)
		test(`no route: ${p}`, () => expect(names(p)).toEqual([]));

	test("kinds", () => {
		const r = routePrompt("https://airbnb.slack.com/archives/C1/p2 read this");
		expect(r.map((x) => x.kind)).toEqual(["skill", "prompt"]);
	});
});

describe("buildSection", () => {
	test("lists routes", () => {
		const s = buildSection(routePrompt("where was i"));
		expect(s).toContain("<skill_router>");
		expect(s).toContain("recall (prompt)");
	});
});
