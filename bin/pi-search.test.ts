import { expect, test } from "bun:test";
import {
	dedupe,
	editDistance,
	exactMatch,
	parseAge,
	recencyBoost,
	renderSession,
	scoreText,
	searchSession,
	shortSessionId,
	tokenize,
} from "./pi-search.ts";

const relevance = (query: string, text: string) => scoreText(tokenize(query), text)?.relevance ?? 0;
const line = (role: string, text: string, timestamp = "2026-01-01T00:00:00Z") =>
	JSON.stringify({ type: "message", timestamp, message: { role, content: [{ type: "text", text }] } });
const session = (...lines: string[]) => [JSON.stringify({ type: "session", cwd: "/repo" }), ...lines].join("\n");
const NOW = Date.parse("2026-01-02T00:00:00Z");
const flaky = (roles = ["user"], since?: number) => ({ terms: ["flaky"], roles, now: NOW, halfLifeDays: 30, since });
const FILE = "/s/2026-01-01T00-00-00-000Z_01a1ad07-e2cb-77d9-9e64-84681cb5ba30.jsonl";
const entry = (id: string, role: string, text: string) =>
	JSON.stringify({ type: "message", id, timestamp: "2026-01-01T00:00:00Z", message: { role, content: [{ type: "text", text }] } });

test("edit distance counts transposition as one edit", () => {
	expect(editDistance("recieve", "receive", 2)).toBe(1);
});

test("matches through typos and partial words", () => {
	expect(relevance("kuberntes", "restart kubernetes pods")).toBeGreaterThan(0);
	expect(relevance("deploy", "the deployment failed")).toBeGreaterThan(0);
});

test("rejects text missing most terms", () => {
	expect(relevance("rotate superwhisper token", "rotate the logs")).toBe(0);
});

test("ranks verbatim phrase over scattered words", () => {
	const scattered = `token ${"filler ".repeat(100)} rotate`;
	expect(relevance("rotate token", "please rotate token now")).toBeGreaterThan(relevance("rotate token", scattered));
});

test("stopwords in the query cannot block a match", () => {
	expect(relevance("what was the flaky migration", "flaky migration")).toBeGreaterThan(0);
});

test("recency boost decays by half-life to a floor", () => {
	expect(recencyBoost(0, 30)).toBe(1);
	expect(recencyBoost(30 * 86_400_000, 30)).toBeCloseTo(0.75);
	expect(recencyBoost(1e13, 30)).toBeCloseTo(0.5);
});

test("recency breaks ties between equal matches", () => {
	const search = (ts: string) =>
		searchSession("f", session(line("user", "flaky migration", ts)), flaky());
	expect(search("2026-01-01T00:00:00Z")!.score).toBeGreaterThan(search("2024-01-01T00:00:00Z")!.score);
});

test("assistant messages only searched when requested", () => {
	const raw = session(line("assistant", "flaky migration"));
	expect(searchSession("f", raw, flaky())).toBeNull();
	expect(searchSession("f", raw, flaky(["user", "assistant"]))?.cwd).toBe("/repo");
});

test("role marker inside another message's text is not a false match", () => {
	const raw = session(line("toolResult", 'output "role":"user" flaky'));
	expect(searchSession("f", raw, flaky())).toBeNull();
});

test("tolerates a partially written last line", () => {
	const raw = `${session(line("user", "flaky migration"))}\n{"type":"message","message":{"role":"user","cont`;
	expect(searchSession("f", raw, flaky())?.text).toBe("flaky migration");
});

test("dedupes forked copies of a message", () => {
	const hit = { messageTimestamp: 1, text: "same" } as any;
	expect(dedupe([hit, { ...hit }, { ...hit, text: "other" }])).toHaveLength(2);
});

test("since drops older messages but keeps newer ones in the same session", () => {
	const raw = session(line("user", "flaky old", "2025-01-01T00:00:00Z"), line("user", "flaky new", "2026-01-01T00:00:00Z"));
	expect(searchSession("f", raw, flaky(["user"], parseAge("14d", NOW)))?.text).toBe("flaky new");
	expect(searchSession("f", raw, flaky(["user"], NOW))).toBeNull();
});

test("parseAge rejects garbage", () => {
	expect(parseAge("2w", NOW)).toBe(parseAge("14d", NOW));
	expect(() => parseAge("soon", NOW)).toThrow("bad age");
});

test("hit carries the message id", () => {
	expect(searchSession("f", session(entry("m1", "user", "flaky")), flaky())?.messageId).toBe("m1");
});

test("short id keeps the full uuidv7 timestamp", () => {
	expect(shortSessionId(FILE)).toBe("01a1ad07-e2cb");
});

const convo = session(
	entry("m1", "user", "one"),
	entry("t1", "toolResult", "HUGE TOOL OUTPUT"),
	entry("m2", "assistant", "two"),
	entry("m3", "user", "three"),
	entry("m4", "assistant", "four"),
);
const show = (opts: { at?: string; context?: number; maxChars?: number }) =>
	renderSession(FILE, convo, { context: 1, maxChars: 600, now: NOW, ...opts });

test("show centers on --at, marks it, and omits tool output", () => {
	const out = show({ at: "m3" });
	expect(out).toContain("messages 2-4 of 4");
	expect(out).toContain(">> [m3 user");
	expect(out).not.toContain("one");
	expect(out).not.toContain("HUGE");
});

test("show without --at starts at the session start", () => {
	expect(show({})).toContain("messages 1-3 of 4");
});

test("show errors on unknown message", () => {
	expect(() => show({ at: "nope" })).toThrow("nope");
});

test("show truncates but gives the target more room, 0 disables", () => {
	const long = session(entry("a", "user", "x".repeat(50)), entry("b", "user", "y".repeat(50)));
	const out = renderSession(FILE, long, { at: "b", context: 1, maxChars: 20, now: NOW });
	expect(out).toContain(`${"x".repeat(20)}…[+30 chars`);
	expect(out).toContain("y".repeat(50));
	expect(renderSession(FILE, long, { context: 1, maxChars: 0, now: NOW })).not.toContain("…[+");
});

test("exact matches a literal substring, ignoring case", () => {
	expect(exactMatch("EDITOR=vim", "try editor=VIM crontab")).toMatchObject({ start: 4, end: 14 });
	expect(exactMatch("rotate token", "rotate the token")).toBeNull();
});

test("exact search has no typo tolerance and ranks purely by recency", () => {
	const opts = { terms: [], roles: ["user"], now: NOW, halfLifeDays: 30, exact: "flaky" };
	expect(searchSession("f", session(line("user", "flakey")), opts)).toBeNull();
	const raw = (ts: string) => session(line("user", "flaky", ts));
	expect(searchSession("f", raw("2026-01-01T00:00:00Z"), opts)!.score).toBeGreaterThan(
		searchSession("f", raw("2024-01-01T00:00:00Z"), opts)!.score,
	);
});
