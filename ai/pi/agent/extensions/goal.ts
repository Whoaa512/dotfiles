import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const REMINDER_START = "<goal-reminder>";

export default function (pi: ExtensionAPI) {
	let goal: string | undefined;

	pi.on("session_start", async (_event, ctx) => {
		goal = undefined;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === "goal") {
				goal = (entry.data as { text?: string })?.text || undefined;
			}
		}
		updateWidget(ctx);
	});

	pi.on("context", async (event) => {
		if (!goal) return;
		const messages = [...event.messages];
		messages.push({
			role: "user",
			content: [
				{
					type: "text",
					text: `${REMINDER_START}\nCurrent goal: ${goal}\nStay focused on this goal. If you have drifted, course-correct now. Do not respond to this reminder directly.\n</goal-reminder>`,
				},
			],
			timestamp: Date.now(),
		});
		return { messages };
	});

	pi.registerCommand("goal", {
		description: "Set/show/clear a persistent goal injected every turn (usage: /goal <text> | /goal | /goal clear)",
		handler: async (args, ctx) => {
			const text = (args ?? "").trim();

			if (!text) {
				ctx.ui.notify(goal ? `Goal: ${goal}` : "No goal set. Usage: /goal <text>", "info");
				return;
			}

			if (text === "clear") {
				goal = undefined;
				pi.appendEntry("goal", { text: null });
				updateWidget(ctx);
				ctx.ui.notify("Goal cleared", "info");
				return;
			}

			goal = text;
			pi.appendEntry("goal", { text });
			updateWidget(ctx);
			ctx.ui.notify(`Goal set: ${text}`, "info");
		},
	});

	function updateWidget(ctx: { ui: { setStatus: (key: string, text?: string) => void } }) {
		ctx.ui.setStatus("goal", goal ? `goal: ${goal}` : undefined);
	}
}
