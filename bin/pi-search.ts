#!/usr/bin/env bun
// Fuzzy search local pi sessions, biased to recent ones. User messages only unless -a.
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

const SESSIONS_DIR = join(homedir(), ".pi/agent/sessions");
const TEMP_DIR_PREFIX = /^--(private-tmp|tmp|var-folders)/;
const MIN_COVERAGE = 0.6;
const RECENCY_FLOOR = 0.5;
const LINE_HEAD_CHARS = 200;
const STOPWORDS = new Set(
	"a an and are as at be but by can could did do for from had has have how i if in is it its me my of on or our so that the then this to u was we were what when where which with would you".split(
		" ",
	),
);
const USAGE = `usage: pi-search [options] <query...>

Fuzzy search pi sessions. Tolerates typos, partial words, and missing words.

  -a, --assistant     also search assistant messages
  -n, --limit N       sessions to show (default 10)
  -c, --cwd TEXT      only sessions whose cwd contains TEXT
      --half-life D   days until recency boost halves (default 30)
      --all           include sessions from temp dirs (smoke tests etc)
      --json          machine-readable output
  -h, --help          show this`;

export type Match = { relevance: number; start: number; end: number };
type Hit = {
	file: string;
	cwd: string;
	name?: string;
	role: string;
	text: string;
	timestamp: number;
	messageTimestamp?: number;
	score: number;
	match: Match;
};

export function editDistance(a: string, b: string, max: number): number {
	if (Math.abs(a.length - b.length) > max) return max + 1;
	let beforePrev: number[] = [];
	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let best = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
			const transposed = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
			if (transposed) best = Math.min(best, beforePrev[j - 2] + 1);
			row.push(best);
		}
		beforePrev = prev;
		prev = row;
	}
	return prev[b.length];
}

function scoreWord(term: string, word: string): number {
	if (word === term) return 1;
	if (term.length < 3) return 0;
	if (word.startsWith(term)) return 0.85;
	if (word.includes(term)) return 0.7;
	if (term.length < 4) return 0;
	const allowed = term.length >= 7 ? 2 : 1;
	return editDistance(term, word, allowed) <= allowed ? 0.6 : 0;
}

let cachedTerms: string[] = [];
const wordScoresCache = new Map<string, number[]>();

function scoresForWord(terms: string[], word: string): number[] {
	if (terms !== cachedTerms) {
		cachedTerms = terms;
		wordScoresCache.clear();
	}
	let scores = wordScoresCache.get(word);
	if (!scores) {
		scores = terms.map((term) => scoreWord(term, word));
		wordScoresCache.set(word, scores);
	}
	return scores;
}

export function tokenize(query: string): string[] {
	return query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Scores 0..~1.5: how many terms hit, how well, how close together, plus a verbatim-phrase bonus. */
export function scoreText(terms: string[], text: string): Match | null {
	const lower = text.toLowerCase();
	const weights = terms.map((t) => (STOPWORDS.has(t) ? 0.2 : 1));
	const totalWeight = weights.reduce((a, b) => a + b, 0);
	const bestByTerm = terms.map(() => 0);
	const occurrences: { term: number; start: number; end: number; quality: number }[] = [];

	for (const m of lower.matchAll(/[a-z0-9]+/g)) {
		const scores = scoresForWord(terms, m[0]);
		for (let t = 0; t < terms.length; t++) {
			const quality = scores[t];
			if (quality === 0) continue;
			bestByTerm[t] = Math.max(bestByTerm[t], quality);
			occurrences.push({ term: t, start: m.index, end: m.index + m[0].length, quality });
		}
	}

	const coverage = terms.reduce((sum, _, t) => sum + (bestByTerm[t] > 0 ? weights[t] : 0), 0) / totalWeight;
	if (coverage < MIN_COVERAGE) return null;
	const quality = terms.reduce((sum, _, t) => sum + bestByTerm[t] * weights[t], 0) / totalWeight;

	const window = tightestWindow(occurrences, bestByTerm);
	const matchedChars = terms.reduce((sum, t, i) => sum + (bestByTerm[i] > 0 ? t.length + 1 : 0), 0);
	const tightness = Math.min(1, matchedChars / Math.max(1, window.end - window.start));

	const phrase = lower.replace(/[^a-z0-9]+/g, " ").includes(terms.join(" "));
	const relevance = quality * coverage * (0.3 + 0.7 * tightness) + (phrase && terms.length > 1 ? 0.5 : 0);
	return { relevance, start: window.start, end: window.end };
}

/** Smallest span of text containing an occurrence of every matched term. */
function tightestWindow(
	occurrences: { term: number; start: number; end: number }[],
	bestByTerm: number[],
): { start: number; end: number } {
	const needed = bestByTerm.filter((q) => q > 0).length;
	const counts = new Map<number, number>();
	let best = { start: 0, end: Number.POSITIVE_INFINITY };
	let left = 0;
	for (const occurrence of occurrences) {
		counts.set(occurrence.term, (counts.get(occurrence.term) ?? 0) + 1);
		while (counts.size === needed) {
			const first = occurrences[left];
			if (occurrence.end - first.start < best.end - best.start) best = { start: first.start, end: occurrence.end };
			const remaining = (counts.get(first.term) ?? 0) - 1;
			if (remaining === 0) counts.delete(first.term);
			else counts.set(first.term, remaining);
			left++;
		}
	}
	return best;
}

export function recencyBoost(ageMs: number, halfLifeDays: number): number {
	const ageDays = Math.max(0, ageMs) / 86_400_000;
	return RECENCY_FLOOR + (1 - RECENCY_FLOOR) * 0.5 ** (ageDays / halfLifeDays);
}

function messageText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((part) => part?.type === "text")
		.map((part) => part.text)
		.join("\n");
}

function lineAround(raw: string, index: number): string {
	const start = raw.lastIndexOf("\n", index) + 1;
	const end = raw.indexOf("\n", index);
	return raw.slice(start, end === -1 ? raw.length : end);
}

function parseLine(line: string): any {
	try {
		return JSON.parse(line);
	} catch {
		return null; // sessions being written can end in a partial line
	}
}

/** Most session bytes are tool output, so peek at each line's head and parse only wanted roles. */
export function searchSession(
	file: string,
	raw: string,
	terms: string[],
	roles: string[],
	now: number,
	halfLifeDays: number,
): Hit | null {
	let best: Hit | null = null;
	const markers = roles.map((role) => `"role":"${role}"`);
	for (let start = 0, end = 0; start < raw.length; start = end + 1) {
		end = raw.indexOf("\n", start);
		if (end === -1) end = raw.length;
		const head = raw.slice(start, start + LINE_HEAD_CHARS);
		if (!markers.some((marker) => head.includes(marker))) continue;

		const entry = parseLine(raw.slice(start, end));
		if (entry?.type !== "message" || !roles.includes(entry.message?.role)) continue;
		const text = messageText(entry.message.content);
		const match = scoreText(terms, text);
		if (!match) continue;
		const timestamp = Date.parse(entry.timestamp);
		const score = match.relevance * recencyBoost(now - timestamp, halfLifeDays);
		if (best && score <= best.score) continue;
		const role = entry.message.role;
		best = { file, cwd: "", role, text, timestamp, messageTimestamp: entry.message.timestamp, score, match };
	}
	if (!best) return null;

	best.cwd = parseLine(raw.slice(0, raw.indexOf("\n")))?.cwd ?? "";
	const nameIndex = raw.lastIndexOf('"type":"session_info"');
	if (nameIndex !== -1) best.name = parseLine(lineAround(raw, nameIndex))?.name;
	return best;
}

/** Forked sessions copy their parent's messages; show each message once. */
export function dedupe(hits: Hit[]): Hit[] {
	const seen = new Set<string>();
	return hits.filter((hit) => {
		const key = `${hit.messageTimestamp}\0${hit.text}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

async function listSessionFiles(includeTemp: boolean): Promise<string[]> {
	const glob = new Bun.Glob("*/*.jsonl");
	const files: string[] = [];
	for await (const path of glob.scan({ cwd: SESSIONS_DIR, onlyFiles: true })) {
		if (!includeTemp && TEMP_DIR_PREFIX.test(basename(dirname(path)))) continue;
		files.push(join(SESSIONS_DIR, path));
	}
	return files;
}

function formatAge(ms: number): string {
	const days = Math.floor(ms / 86_400_000);
	if (days >= 1) return `${days}d ago`;
	const hours = Math.floor(ms / 3_600_000);
	return hours >= 1 ? `${hours}h ago` : "just now";
}

function snippet(hit: Hit, width = 160): string {
	const { start, end } = hit.match;
	const from = Math.max(0, start - 40);
	const to = Math.min(hit.text.length, from + width);
	const highlightEnd = Math.min(end, to);
	const clean = (s: string) => s.replace(/\s+/g, " ");
	const matched = clean(hit.text.slice(start, highlightEnd));
	const highlighted = process.stdout.isTTY ? `\x1b[1;33m${matched}\x1b[0m` : matched;
	const body = clean(hit.text.slice(from, start)) + highlighted + clean(hit.text.slice(highlightEnd, to));
	return `${from > 0 ? "…" : ""}${body}${to < hit.text.length ? "…" : ""}`;
}

function printHit(hit: Hit, rank: number, now: number) {
	const cwd = hit.cwd.replace(homedir(), "~");
	const name = hit.name ? `  ${hit.name}` : "";
	console.log(`${rank}. ${formatAge(now - hit.timestamp)}  ${cwd}${name}`);
	console.log(`   ${hit.role === "assistant" ? "[assistant] " : ""}${snippet(hit)}`);
	console.log(`   cd ${cwd} && pi --session ${hit.file}\n`);
}

function parseArgs(argv: string[]) {
	const opts = { assistant: false, limit: 10, cwd: "", halfLife: 30, all: false, json: false, help: false };
	const query: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "-a" || arg === "--assistant") opts.assistant = true;
		else if (arg === "-n" || arg === "--limit") opts.limit = Number(argv[++i]);
		else if (arg === "-c" || arg === "--cwd") opts.cwd = argv[++i] ?? "";
		else if (arg === "--half-life") opts.halfLife = Number(argv[++i]);
		else if (arg === "--all") opts.all = true;
		else if (arg === "--json") opts.json = true;
		else if (arg === "-h" || arg === "--help") opts.help = true;
		else if (arg.startsWith("-")) throw new Error(`unknown flag: ${arg}`);
		else query.push(arg);
	}
	if (!(opts.limit > 0)) throw new Error("--limit must be a positive number");
	if (!(opts.halfLife > 0)) throw new Error("--half-life must be a positive number");
	return { opts, query: query.join(" ") };
}

async function main() {
	const { opts, query } = parseArgs(process.argv.slice(2));
	const terms = tokenize(query);
	if (opts.help || terms.length === 0) {
		console.log(USAGE);
		process.exit(opts.help ? 0 : 1);
	}

	const roles = opts.assistant ? ["user", "assistant"] : ["user"];
	const now = Date.now();
	const queue = await listSessionFiles(opts.all);
	const hits: Hit[] = [];

	const worker = async () => {
		for (let file = queue.pop(); file; file = queue.pop()) {
			const hit = searchSession(file, await Bun.file(file).text(), terms, roles, now, opts.halfLife);
			if (hit && hit.cwd.includes(opts.cwd)) hits.push(hit);
		}
	};
	await Promise.all(Array.from({ length: 16 }, worker));

	const top = dedupe(hits.sort((a, b) => b.score - a.score)).slice(0, opts.limit);
	if (opts.json) {
		const rows = top.map(({ file, cwd, name, role, timestamp, score, text, match }) => ({
			file,
			cwd,
			name,
			role,
			timestamp: new Date(timestamp).toISOString(),
			score,
			excerpt: text.slice(Math.max(0, match.start - 80), match.end + 80),
		}));
		console.log(JSON.stringify(rows, null, 2));
		return;
	}
	if (top.length === 0) {
		console.error(`no matches${opts.assistant ? "" : " in user messages (try -a)"}`);
		process.exit(1);
	}
	top.forEach((hit, i) => printHit(hit, i + 1, now));
}

if (import.meta.main) {
	main().catch((err) => {
		console.error(`pi-search: ${err.message}`);
		process.exit(2);
	});
}
