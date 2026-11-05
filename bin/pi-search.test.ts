import { expect, test } from "bun:test";
import { dedupe, editDistance, recencyBoost, scoreText, searchSession, tokenize } from "./pi-search.ts";

const relevance = (query: string, text: string) => scoreText(tokenize(query), text)?.relevance ?? 0;
const line = (role: string, text: string, timestamp = "2026-01-01T00:00:00Z") =>
	JSON.stringify({ type: "message", timestamp, message: { role, content: [{ type: "text", text }] } });
const session = (...lines: string[]) => [JSON.stringify({ type: "session", cwd: "/repo" }), ...lines].join("\n");
const NOW = Date.parse("2026-01-02T00:00:00Z");

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
		searchSession("f", session(line("user", "flaky migration", ts)), ["flaky"], ["user"], NOW, 30);
	expect(search("2026-01-01T00:00:00Z")!.score).toBeGreaterThan(search("2024-01-01T00:00:00Z")!.score);
});

test("assistant messages only searched when requested", () => {
	const raw = session(line("assistant", "flaky migration"));
	expect(searchSession("f", raw, ["flaky"], ["user"], NOW, 30)).toBeNull();
	expect(searchSession("f", raw, ["flaky"], ["user", "assistant"], NOW, 30)?.cwd).toBe("/repo");
});

test("role marker inside another message's text is not a false match", () => {
	const raw = session(line("toolResult", 'output "role":"user" flaky'));
	expect(searchSession("f", raw, ["flaky"], ["user"], NOW, 30)).toBeNull();
});

test("tolerates a partially written last line", () => {
	const raw = `${session(line("user", "flaky migration"))}\n{"type":"message","message":{"role":"user","cont`;
	expect(searchSession("f", raw, ["flaky"], ["user"], NOW, 30)?.text).toBe("flaky migration");
});

test("dedupes forked copies of a message", () => {
	const hit = { messageTimestamp: 1, text: "same" } as any;
	expect(dedupe([hit, { ...hit }, { ...hit, text: "other" }])).toHaveLength(2);
});
