/**
 * Question Tool - Single question with options
 * Full custom UI: options list + inline editor for "Type something..."
 * Escape in editor returns to options, Escape in options cancels
 *
 * If a session is resumed while a question tool call is still pending
 * (no tool result recorded), the question UI is shown again on resume
 * and the answer is sent back to the agent as a user message.
 */

import { connect } from "node:net";
import type { ToolCall } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import {
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	Text,
	truncateToWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

function sendSupacodeFlag(flag: "0" | "1" | "2"): void {
	const socketPath = process.env.SUPACODE_SOCKET_PATH;
	const worktreeId = process.env.SUPACODE_WORKTREE_ID;
	const tabId = process.env.SUPACODE_TAB_ID;
	const surfaceId = process.env.SUPACODE_SURFACE_ID;
	if (!socketPath || !worktreeId || !tabId || !surfaceId) return;

	const message = `${worktreeId} ${tabId} ${surfaceId} ${flag}\n`;
	try {
		const client = connect(socketPath, () => {
			client.end(message);
		});
		client.on("error", () => {});
	} catch {
		// Not in Supacode or socket unavailable — ignore
	}
}

interface OptionWithDesc {
	label: string;
	description?: string;
}

type DisplayOption = OptionWithDesc & { isOther?: boolean };

interface QuestionAnswer {
	answer: string;
	wasCustom: boolean;
	index?: number;
}

interface QuestionDetails {
	question: string;
	options: string[];
	answer: string | null;
	wasCustom?: boolean;
}

// Options with labels and optional descriptions
const OptionSchema = Type.Object({
	label: Type.String({ description: "Display label for the option" }),
	description: Type.Optional(Type.String({ description: "Optional description shown below label" })),
});

const QuestionParams = Type.Object({
	question: Type.String({ description: "The question to ask the user" }),
	options: Type.Array(OptionSchema, { description: "Options for the user to choose from" }),
});

/**
 * Find a question tool call that never received a tool result because the
 * session ended mid-call (e.g. terminal killed while the UI was open). Only the
 * final message on the branch counts: anything after it means the agent moved on.
 */
function findPendingQuestion(ctx: ExtensionContext): { question: string; options: OptionWithDesc[] } | undefined {
	const entries = ctx.sessionManager.getBranch();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "message") continue;
		const message = entry.message;
		if (message.role !== "assistant") return undefined;
		const call = message.content.find((c): c is ToolCall => c.type === "toolCall" && c.name === "question");
		if (!call) return undefined;
		const args = call.arguments as { question?: string; options?: OptionWithDesc[] } | undefined;
		if (typeof args?.question !== "string" || !Array.isArray(args.options) || args.options.length === 0) {
			return undefined;
		}
		if (args.options.some((o) => !o || typeof o.label !== "string")) return undefined;
		return { question: args.question, options: args.options };
	}
	return undefined;
}

async function runQuestionUI(
	ui: ExtensionUIContext,
	question: string,
	options: OptionWithDesc[],
): Promise<QuestionAnswer | null> {
	const allOptions: DisplayOption[] = [...options, { label: "Type something.", isOther: true }];

	sendSupacodeFlag("2");
	try {
		return await ui.custom<QuestionAnswer | null>((tui, theme, _kb, done) => {
			let optionIndex = 0;
			let editMode = false;
			let cachedLines: string[] | undefined;
			let cachedWidth: number | undefined;

			const editorTheme: EditorTheme = {
				borderColor: (s) => theme.fg("accent", s),
				selectList: {
					selectedPrefix: (t) => theme.fg("accent", t),
					selectedText: (t) => theme.fg("accent", t),
					description: (t) => theme.fg("muted", t),
					scrollInfo: (t) => theme.fg("dim", t),
					noMatch: (t) => theme.fg("warning", t),
				},
			};
			const editor = new Editor(tui, editorTheme);

			editor.onSubmit = (value) => {
				const trimmed = value.trim();
				if (trimmed) {
					done({ answer: trimmed, wasCustom: true });
				} else {
					editMode = false;
					editor.setText("");
					refresh();
				}
			};

			function refresh() {
				cachedLines = undefined;
				tui.requestRender();
			}

			function handleInput(data: string) {
				if (editMode) {
					if (matchesKey(data, Key.escape)) {
						editMode = false;
						editor.setText("");
						refresh();
						return;
					}
					editor.handleInput(data);
					refresh();
					return;
				}

				if (matchesKey(data, Key.up)) {
					optionIndex = Math.max(0, optionIndex - 1);
					refresh();
					return;
				}
				if (matchesKey(data, Key.down)) {
					optionIndex = Math.min(allOptions.length - 1, optionIndex + 1);
					refresh();
					return;
				}

				if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
					const selected = allOptions[optionIndex];
					if (selected.isOther) {
						editMode = true;
						refresh();
					} else {
						done({ answer: selected.label, wasCustom: false, index: optionIndex + 1 });
					}
					return;
				}

				if (matchesKey(data, Key.escape)) {
					done(null);
				}
			}

			function render(width: number): string[] {
				if (cachedLines && cachedWidth === width) return cachedLines;

				const lines: string[] = [];
				const add = (s: string) => lines.push(truncateToWidth(s, width));
				const wrap = (s: string, indent = "") => {
					const wrapped = wrapTextWithAnsi(s, width - indent.length);
					lines.push(wrapped[0]);
					for (let j = 1; j < wrapped.length; j++) lines.push(indent + wrapped[j]);
				};

				add(theme.fg("accent", "─".repeat(width)));
				wrap(theme.fg("text", ` ${question}`), " ");
				lines.push("");

				const indent = "     ";
				for (let i = 0; i < allOptions.length; i++) {
					const opt = allOptions[i];
					const selected = i === optionIndex;
					const isOther = opt.isOther === true;
					const prefix = selected ? theme.fg("accent", "> ") : "  ";

					if (isOther && editMode) {
						wrap(prefix + theme.fg("accent", `${i + 1}. ${opt.label} ✎`), indent);
					} else if (selected) {
						wrap(prefix + theme.fg("accent", `${i + 1}. ${opt.label}`), indent);
					} else {
						wrap(`  ${theme.fg("text", `${i + 1}. ${opt.label}`)}`, indent);
					}

					if (opt.description) {
						wrap(`${indent}${theme.fg("muted", opt.description)}`, indent);
					}
				}

				if (editMode) {
					lines.push("");
					add(theme.fg("muted", " Your answer:"));
					for (const line of editor.render(width - 2)) {
						add(` ${line}`);
					}
				}

				lines.push("");
				if (editMode) {
					add(theme.fg("dim", " Enter to submit • Esc to go back"));
				} else {
					add(theme.fg("dim", " ↑↓ navigate • Space/Enter to select • Esc to cancel"));
				}
				add(theme.fg("accent", "─".repeat(width)));

				cachedLines = lines;
				cachedWidth = width;
				return lines;
			}

			return {
				render,
				invalidate: () => {
					cachedLines = undefined;
				},
				handleInput,
			};
		});
	} finally {
		sendSupacodeFlag("1");
	}
}

export default function question(pi: ExtensionAPI) {
	pi.registerTool({
		name: "question",
		label: "Question",
		description: "Ask the user a question and let them pick from options. Use when you need user input to proceed.",
		parameters: QuestionParams,
		executionMode: "sequential",

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			// Guard on hasUI (true in TUI and RPC-with-host modes like Supacode), not mode==="tui".
			// An RPC host injects a working uiContext, so custom() renders fine there.
			if (!ctx.hasUI) {
				return {
					content: [{ type: "text", text: "Error: UI not available (running in non-interactive mode)" }],
					details: {
						question: params.question,
						options: params.options.map((o) => o.label),
						answer: null,
					} as QuestionDetails,
				};
			}

			if (params.options.length === 0) {
				return {
					content: [{ type: "text", text: "Error: No options provided" }],
					details: { question: params.question, options: [], answer: null } as QuestionDetails,
				};
			}

			const result = await runQuestionUI(ctx.ui, params.question, params.options);

			// Build simple options list for details
			const simpleOptions = params.options.map((o) => o.label);

			if (!result) {
				return {
					content: [{ type: "text", text: "User cancelled the selection" }],
					details: { question: params.question, options: simpleOptions, answer: null } as QuestionDetails,
				};
			}

			if (result.wasCustom) {
				return {
					content: [{ type: "text", text: `User wrote: ${result.answer}` }],
					details: {
						question: params.question,
						options: simpleOptions,
						answer: result.answer,
						wasCustom: true,
					} as QuestionDetails,
				};
			}
			return {
				content: [{ type: "text", text: `User selected: ${result.index}. ${result.answer}` }],
				details: {
					question: params.question,
					options: simpleOptions,
					answer: result.answer,
					wasCustom: false,
				} as QuestionDetails,
			};
		},

		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("question ")) + theme.fg("muted", args.question);
			const opts = Array.isArray(args.options) ? args.options : [];
			if (opts.length) {
				const labels = opts.map((o: OptionWithDesc) => o.label);
				const numbered = [...labels, "Type something."].map((o, i) => `${i + 1}. ${o}`);
				text += `\n${theme.fg("dim", `  Options: ${numbered.join(", ")}`)}`;
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as QuestionDetails | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (details.answer === null) {
				return new Text(theme.fg("warning", "Cancelled"), 0, 0);
			}

			if (details.wasCustom) {
				return new Text(
					theme.fg("success", "✓ ") + theme.fg("muted", "(wrote) ") + theme.fg("accent", details.answer),
					0,
					0,
				);
			}
			const idx = details.options.indexOf(details.answer) + 1;
			const display = idx > 0 ? `${idx}. ${details.answer}` : details.answer;
			return new Text(theme.fg("success", "✓ ") + theme.fg("accent", display), 0, 0);
		},
	});

	// Re-trigger the question UI when a session is resumed while a question
	// tool call was still pending (session ended mid-question).
	// Uses resources_discover instead of session_start: it fires after ALL
	// session_start handlers, so extensions that swap the editor component on
	// session_start (which clears the editor container) cannot clobber this UI.
	// The UI task is not awaited: blocking here would keep the conversation
	// history hidden until the question is answered.
	pi.on("resources_discover", (_event, ctx) => {
		if (!ctx.hasUI) return;
		const pending = findPendingQuestion(ctx);
		if (!pending) return;

		void (async () => {
			const result = await runQuestionUI(ctx.ui, pending.question, pending.options);
			if (!result) return;

			const answerText = result.wasCustom
				? `The user wrote: ${result.answer}`
				: `The user selected: ${result.index}. ${result.answer}`;
			pi.sendUserMessage(
				`The session was resumed with an unanswered question ("${pending.question}"). ${answerText}`,
			);
		})().catch(() => {});
	});
}
