#!/usr/bin/env bun

import { readdirSync, readFileSync, unlinkSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

const QUEUE_DIR = join(process.env.HOME!, ".pi", "tts-queue");
const POLL_INTERVAL = 5_000;
const RENOTIFY_MS = 30 * 60 * 1000;
const IDLE_THRESHOLD_NS = 30_000_000_000; // 30s idle = user probably away or not looking

mkdirSync(QUEUE_DIR, { recursive: true });

interface QueueItem {
	message: string;
	timestamp: number;
	lastSpoken?: number;
}

function getSystemIdleTimeNs(): number {
	try {
		const out = execSync("ioreg -c IOHIDSystem", { encoding: "utf-8" });
		const match = out.match(/"HIDIdleTime"\s*=\s*(\d+)/);
		return match ? parseInt(match[1], 10) : 0;
	} catch {
		return 0;
	}
}

function isAudioPlaying(): boolean {
	try {
		const out = execSync("pmset -g assertions", { encoding: "utf-8" });
		if (/PreventUserIdleDisplaySleep\s+[1-9]/.test(out)) return true;
		if (/coreaudiod|Audio|WebKit/.test(out)) return true;
		return false;
	} catch {
		return false;
	}
}

function isUserActive(): boolean {
	const idleNs = getSystemIdleTimeNs();
	return idleNs < IDLE_THRESHOLD_NS;
}

function speak(text: string) {
	const tmpFile = join(QUEUE_DIR, `_speaking_${Date.now()}.txt`);
	try {
		writeFileSync(tmpFile, text, "utf-8");
		spawnSync("naturalreader", ["speak", "--file", tmpFile, "--voice", "Echo", "--source", "openai", "--type", "pro"], {
			stdio: "inherit",
			timeout: 120_000,
		});
	} finally {
		try { unlinkSync(tmpFile); } catch {}
	}
}

function getQueueItems(): { file: string; item: QueueItem }[] {
	if (!existsSync(QUEUE_DIR)) return [];
	return readdirSync(QUEUE_DIR)
		.filter((f) => f.endsWith(".json"))
		.sort()
		.map((f) => {
			try {
				const item = JSON.parse(readFileSync(join(QUEUE_DIR, f), "utf-8")) as QueueItem;
				return { file: f, item };
			} catch {
				return null;
			}
		})
		.filter((x): x is { file: string; item: QueueItem } => x !== null);
}

function tick() {
	const items = getQueueItems();
	if (items.length === 0) return;

	if (isUserActive() || isAudioPlaying()) return;

	const now = Date.now();

	for (const { file, item } of items) {
		const shouldSpeak = !item.lastSpoken || (now - item.lastSpoken > RENOTIFY_MS);
		if (!shouldSpeak) continue;

		console.log(`[tts] Speaking: ${item.message.slice(0, 80)}...`);
		speak(item.message);

		item.lastSpoken = now;
		writeFileSync(join(QUEUE_DIR, file), JSON.stringify(item), "utf-8");
		break; // one at a time
	}
}

console.log(`[tts-daemon] Watching ${QUEUE_DIR} (poll: ${POLL_INTERVAL}ms)`);
setInterval(tick, POLL_INTERVAL);
tick();
