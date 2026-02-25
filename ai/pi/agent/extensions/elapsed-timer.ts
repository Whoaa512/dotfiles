/**
 * Elapsed Timer Extension
 *
 * Shows elapsed time since the user sent a message while the model is working.
 * Displays a live ticking timer in the status bar during agent execution,
 * then shows the final elapsed time when done.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function formatElapsed(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

const STATUS_KEY = "elapsed-timer";

const PAUSE_TOOLS = new Set(["question", "questionnaire"]);

export default function (pi: ExtensionAPI) {
	let startTime = 0;
	let timer: ReturnType<typeof setInterval> | null = null;
	let pausedAt = 0;
	let totalPaused = 0;
	function stopTimer() {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}

	function getElapsed() {
		const paused = pausedAt ? Date.now() - pausedAt : 0;
		return Date.now() - startTime - totalPaused - paused;
	}

	function startTicking(ctx: ExtensionContext) {
		stopTimer();
		startTime = Date.now();
		totalPaused = 0;
		pausedAt = 0;
		const theme = ctx.ui.theme;

		const update = () => {
			const elapsed = getElapsed();
			const spinner = theme.fg("accent", pausedAt ? "◷" : "●");
			const time = theme.fg("dim", ` ${formatElapsed(elapsed)}`);
			ctx.ui.setStatus(STATUS_KEY, spinner + time);
		};

		update();
		timer = setInterval(update, 1000);
	}

	pi.on("agent_start", async (_event, ctx) => {
		startTicking(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		stopTimer();
		if (pausedAt) {
			totalPaused += Date.now() - pausedAt;
			pausedAt = 0;
		}
		const elapsed = getElapsed();
		const theme = ctx.ui.theme;
		const check = theme.fg("success", "✓");
		const time = theme.fg("dim", ` ${formatElapsed(elapsed)}`);
		ctx.ui.setStatus(STATUS_KEY, check + time);
	});

	pi.on("tool_execution_start", async (event) => {
		if (PAUSE_TOOLS.has(event.toolName)) {
			pausedAt = Date.now();
		}
	});

	pi.on("tool_execution_end", async (event) => {
		if (PAUSE_TOOLS.has(event.toolName) && pausedAt) {
			totalPaused += Date.now() - pausedAt;
			pausedAt = 0;
		}
	});

	pi.on("session_switch", async (_event, ctx) => {
		stopTimer();
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});

	pi.on("session_shutdown", async () => {
		stopTimer();
	});
}
