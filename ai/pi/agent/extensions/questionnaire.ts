/**
 * Questionnaire Tool - Unified tool for asking single or multiple questions
 *
 * Single question: simple options list
 * Multiple questions: tab bar navigation between questions
 *
 * If a session is resumed while a questionnaire tool call is still pending
 * (no tool result recorded), the questionnaire UI is shown again on resume
 * and the answers are sent back to the agent as a user message.
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

// Types
interface QuestionOption {
	value: string;
	label: string;
	description?: string;
}

type RenderOption = QuestionOption & { isOther?: boolean };

interface Question {
	id: string;
	label: string;
	prompt: string;
	options: QuestionOption[];
	allowOther: boolean;
	multiSelect: boolean;
}

type QuestionInput = Omit<Question, "label" | "allowOther" | "multiSelect"> &
	Partial<Pick<Question, "label" | "allowOther" | "multiSelect">>;

interface Answer {
	id: string;
	value: string;
	label: string;
	wasCustom: boolean;
	index?: number;
	values?: string[];
	labels?: string[];
	indices?: number[];
}

interface QuestionnaireResult {
	questions: Question[];
	answers: Answer[];
	cancelled: boolean;
}

// Schema
const QuestionOptionSchema = Type.Object({
	value: Type.String({ description: "The value returned when selected" }),
	label: Type.String({ description: "Display label for the option" }),
	description: Type.Optional(Type.String({ description: "Optional description shown below label" })),
});

const QuestionSchema = Type.Object({
	id: Type.String({ description: "Unique identifier for this question" }),
	label: Type.Optional(
		Type.String({
			description: "Short contextual label for tab bar, e.g. 'Scope', 'Priority' (defaults to Q1, Q2)",
		}),
	),
	prompt: Type.String({ description: "The full question text to display" }),
	options: Type.Array(QuestionOptionSchema, { description: "Available options to choose from" }),
	allowOther: Type.Optional(Type.Boolean({ description: "Allow 'Type something' option (default: true)" })),
	multiSelect: Type.Optional(
		Type.Boolean({
			description: "Allow selecting multiple options (default: false). Space toggles, Enter confirms.",
		}),
	),
});

const QuestionnaireParams = Type.Object({
	questions: Type.Array(QuestionSchema, { description: "Questions to ask the user" }),
});

function errorResult(
	message: string,
	questions: Question[] = [],
): { content: { type: "text"; text: string }[]; details: QuestionnaireResult } {
	return {
		content: [{ type: "text", text: message }],
		details: { questions, answers: [], cancelled: true },
	};
}

function normalizeQuestions(raw: QuestionInput[]): Question[] {
	return raw.map((q, i) => ({
		...q,
		label: q.label || `Q${i + 1}`,
		allowOther: true,
		multiSelect: q.multiSelect ?? false,
	}));
}

function formatAnswerLines(questions: Question[], answers: Answer[]): string[] {
	return answers.map((a) => {
		const qLabel = questions.find((q) => q.id === a.id)?.label || a.id;
		if (a.wasCustom) {
			return `${qLabel}: user wrote: ${a.label}`;
		}
		if (a.values && a.values.length > 1) {
			const items = a.labels!.map((l, i) => `${a.indices![i]}. ${l}`).join(", ");
			return `${qLabel}: user selected: ${items}`;
		}
		return `${qLabel}: user selected: ${a.index}. ${a.label}`;
	});
}

/**
 * Find a questionnaire tool call that never received a tool result because the
 * session ended mid-call (e.g. terminal killed while the UI was open). Only the
 * final message on the branch counts: anything after it means the agent moved on.
 */
function findPendingQuestionnaire(ctx: ExtensionContext): QuestionInput[] | undefined {
	const entries = ctx.sessionManager.getBranch();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "message") continue;
		const message = entry.message;
		if (message.role !== "assistant") return undefined;
		const call = message.content.find((c): c is ToolCall => c.type === "toolCall" && c.name === "questionnaire");
		if (!call) return undefined;
		const args = call.arguments as { questions?: QuestionInput[] } | undefined;
		const questions = args?.questions;
		if (!Array.isArray(questions) || questions.length === 0) return undefined;
		if (questions.some((q) => !q || !q.id || !q.prompt || !Array.isArray(q.options))) return undefined;
		return questions;
	}
	return undefined;
}

async function runQuestionnaireUI(ui: ExtensionUIContext, questions: Question[]): Promise<QuestionnaireResult> {
	const isMulti = questions.length > 1;
	const totalTabs = questions.length + 1; // questions + Submit

	sendSupacodeFlag("2");
	try {
		return await ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
			// State
			let currentTab = 0;
			let optionIndex = 0;
			let inputMode = false;
			let inputQuestionId: string | null = null;
			let cachedLines: string[] | undefined;
			let cachedWidth: number | undefined;
			const answers = new Map<string, Answer>();
			const selectedSets = new Map<string, Set<number>>();
			const customEntries = new Map<string, string[]>();

			// Editor for "Type something" option
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

			// Helpers
			function refresh() {
				cachedLines = undefined;
				tui.requestRender();
			}

			function submit(cancelled: boolean) {
				done({ questions, answers: Array.from(answers.values()), cancelled });
			}

			function currentQuestion(): Question | undefined {
				return questions[currentTab];
			}

			function currentOptions(): RenderOption[] {
				const q = currentQuestion();
				if (!q) return [];
				const opts: RenderOption[] = [...q.options];
				if (q.allowOther) {
					opts.push({ value: "__other__", label: "Type something.", isOther: true });
				}
				return opts;
			}

			function allAnswered(): boolean {
				return questions.every((q) => answers.has(q.id));
			}

			function advanceAfterAnswer() {
				if (!isMulti) {
					submit(false);
					return;
				}
				if (currentTab < questions.length - 1) {
					currentTab++;
				} else {
					currentTab = questions.length; // Submit tab
				}
				optionIndex = 0;
				refresh();
			}

			function saveAnswer(
				questionId: string,
				value: string,
				label: string,
				wasCustom: boolean,
				index?: number,
				values?: string[],
				labels?: string[],
				indices?: number[],
			) {
				answers.set(questionId, { id: questionId, value, label, wasCustom, index, values, labels, indices });
			}

			// Editor submit callback
			editor.onSubmit = (value) => {
				if (!inputQuestionId) return;
				const trimmed = value.trim() || "(no response)";
				const q = questions.find((q) => q.id === inputQuestionId);
				inputMode = false;
				editor.setText("");

				if (q?.multiSelect) {
					let entries = customEntries.get(inputQuestionId);
					if (!entries) {
						entries = [];
						customEntries.set(inputQuestionId, entries);
					}
					entries.push(trimmed);
					inputQuestionId = null;
					refresh();
					return;
				}

				saveAnswer(inputQuestionId, trimmed, trimmed, true);
				inputQuestionId = null;
				advanceAfterAnswer();
			};

			function handleInput(data: string) {
				// Input mode: route to editor
				if (inputMode) {
					if (matchesKey(data, Key.escape)) {
						inputMode = false;
						inputQuestionId = null;
						editor.setText("");
						refresh();
						return;
					}
					editor.handleInput(data);
					refresh();
					return;
				}

				const q = currentQuestion();
				const opts = currentOptions();

				// Tab navigation (multi-question only)
				if (isMulti) {
					if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
						currentTab = (currentTab + 1) % totalTabs;
						optionIndex = 0;
						refresh();
						return;
					}
					if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
						currentTab = (currentTab - 1 + totalTabs) % totalTabs;
						optionIndex = 0;
						refresh();
						return;
					}
				}

				// Submit tab
				if (currentTab === questions.length) {
					if ((matchesKey(data, Key.enter) || matchesKey(data, Key.space)) && allAnswered()) {
						submit(false);
					} else if (matchesKey(data, Key.escape)) {
						submit(true);
					}
					return;
				}

				// Option navigation
				if (matchesKey(data, Key.up)) {
					optionIndex = Math.max(0, optionIndex - 1);
					refresh();
					return;
				}
				if (matchesKey(data, Key.down)) {
					optionIndex = Math.min(opts.length - 1, optionIndex + 1);
					refresh();
					return;
				}

				// Select option
				if ((matchesKey(data, Key.enter) || matchesKey(data, Key.space)) && q) {
					const opt = opts[optionIndex];

					if (q.multiSelect) {
						if (matchesKey(data, Key.space)) {
							if (opt.isOther) {
								inputMode = true;
								inputQuestionId = q.id;
								editor.setText("");
								refresh();
								return;
							}
							let set = selectedSets.get(q.id);
							if (!set) {
								set = new Set();
								selectedSets.set(q.id, set);
							}
							if (set.has(optionIndex)) {
								set.delete(optionIndex);
							} else {
								set.add(optionIndex);
							}
							refresh();
							return;
						}
						if (matchesKey(data, Key.enter)) {
							const set = selectedSets.get(q.id);
							const customs = customEntries.get(q.id) || [];
							const hasSelections = (set && set.size > 0) || customs.length > 0;
							if (opt.isOther && !hasSelections) {
								inputMode = true;
								inputQuestionId = q.id;
								editor.setText("");
								refresh();
								return;
							}
							if (!hasSelections) return;
							const sorted = set ? Array.from(set).sort((a, b) => a - b) : [];
							const values = sorted.map((i) => opts[i].value).concat(customs);
							const labels = sorted.map((i) => opts[i].label).concat(customs.map((c) => `(wrote) ${c}`));
							const indices = sorted.map((i) => i + 1);
							const hasCustom = customs.length > 0;
							saveAnswer(
								q.id,
								values.join(", "),
								labels.join(", "),
								hasCustom,
								undefined,
								values,
								labels,
								indices,
							);
							advanceAfterAnswer();
							return;
						}
					}

					if (opt.isOther) {
						inputMode = true;
						inputQuestionId = q.id;
						editor.setText("");
						refresh();
						return;
					}
					saveAnswer(q.id, opt.value, opt.label, false, optionIndex + 1);
					advanceAfterAnswer();
					return;
				}

				// Cancel
				if (matchesKey(data, Key.escape)) {
					submit(true);
				}
			}

			function render(width: number): string[] {
				if (cachedLines && cachedWidth === width) return cachedLines;

				const lines: string[] = [];
				const q = currentQuestion();
				const opts = currentOptions();

				const add = (s: string) => lines.push(truncateToWidth(s, width));
				const wrap = (s: string, indent = "") => {
					const wrapped = wrapTextWithAnsi(s, width - indent.length);
					lines.push(wrapped[0]);
					for (let j = 1; j < wrapped.length; j++) lines.push(indent + wrapped[j]);
				};

				add(theme.fg("accent", "─".repeat(width)));

				// Tab bar (multi-question only)
				if (isMulti) {
					const tabs: string[] = ["← "];
					for (let i = 0; i < questions.length; i++) {
						const isActive = i === currentTab;
						const isAnswered = answers.has(questions[i].id);
						const lbl = questions[i].label;
						const box = isAnswered ? "■" : "□";
						const color = isAnswered ? "success" : "muted";
						const text = ` ${box} ${lbl} `;
						const styled = isActive ? theme.bg("selectedBg", theme.fg("text", text)) : theme.fg(color, text);
						tabs.push(`${styled} `);
					}
					const canSubmit = allAnswered();
					const isSubmitTab = currentTab === questions.length;
					const submitText = " ✓ Submit ";
					const submitStyled = isSubmitTab
						? theme.bg("selectedBg", theme.fg("text", submitText))
						: theme.fg(canSubmit ? "success" : "dim", submitText);
					tabs.push(`${submitStyled} →`);
					add(` ${tabs.join("")}`);
					lines.push("");
				}

				// Helper to render options list
				function renderOptions() {
					const indent = "     ";
					const isMultiSel = q?.multiSelect ?? false;
					const checkedSet = q ? selectedSets.get(q.id) : undefined;
					const customs = q ? customEntries.get(q.id) || [] : [];
					for (let i = 0; i < opts.length; i++) {
						const opt = opts[i];
						const selected = i === optionIndex;
						const isOther = opt.isOther === true;
						const prefix = selected ? theme.fg("accent", "> ") : "  ";
						const color = selected ? "accent" : "text";
						const checked = checkedSet?.has(i);
						const checkbox = isMultiSel ? (checked ? "[✓] " : "[ ] ") : "";
						if (isOther && inputMode) {
							wrap(prefix + theme.fg("accent", `${checkbox}${i + 1}. ${opt.label} ✎`), indent);
						} else {
							wrap(prefix + theme.fg(color, `${checkbox}${i + 1}. ${opt.label}`), indent);
						}
						if (opt.description) {
							wrap(`${indent}${theme.fg("muted", opt.description)}`, indent);
						}
					}
					if (isMultiSel && customs.length > 0) {
						lines.push("");
						add(theme.fg("muted", "  Custom entries:"));
						for (const c of customs) {
							add(`    ${theme.fg("success", "✓")} ${theme.fg("text", c)}`);
						}
					}
				}

				// Content
				if (inputMode && q) {
					wrap(theme.fg("text", ` ${q.prompt}`), " ");
					lines.push("");
					// Show options for reference
					renderOptions();
					lines.push("");
					add(theme.fg("muted", " Your answer:"));
					for (const line of editor.render(width - 2)) {
						add(` ${line}`);
					}
					lines.push("");
					add(theme.fg("dim", " Enter to submit • Esc to cancel"));
				} else if (currentTab === questions.length) {
					add(theme.fg("accent", theme.bold(" Ready to submit")));
					lines.push("");
					for (const question of questions) {
						const answer = answers.get(question.id);
						if (answer) {
							const prefix = answer.wasCustom ? "(wrote) " : "";
							wrap(
								`${theme.fg("muted", ` ${question.label}: `)}${theme.fg("text", prefix + answer.label)}`,
								"   ",
							);
						}
					}
					lines.push("");
					if (allAnswered()) {
						add(theme.fg("success", " Press Enter to submit"));
					} else {
						const missing = questions
							.filter((q) => !answers.has(q.id))
							.map((q) => q.label)
							.join(", ");
						add(theme.fg("warning", ` Unanswered: ${missing}`));
					}
				} else if (q) {
					wrap(theme.fg("text", ` ${q.prompt}`), " ");
					lines.push("");
					renderOptions();
				}

				lines.push("");
				if (!inputMode) {
					const currentQ = currentQuestion();
					const isMultiSel = currentQ?.multiSelect ?? false;
					let help: string;
					if (isMultiSel) {
						help = isMulti
							? " Tab/←→ navigate • ↑↓ move • Space toggle • Enter confirm • Esc cancel"
							: " ↑↓ navigate • Space toggle • Enter confirm • Esc cancel";
					} else {
						help = isMulti
							? " Tab/←→ navigate • ↑↓ select • Space/Enter confirm • Esc cancel"
							: " ↑↓ navigate • Space/Enter select • Esc cancel";
					}
					add(theme.fg("dim", help));
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

export default function questionnaire(pi: ExtensionAPI) {
	pi.registerTool({
		name: "questionnaire",
		label: "Questionnaire",
		description:
			"Ask the user one or more questions. Use for clarifying requirements, getting preferences, or confirming decisions. For single questions, shows a simple option list. For multiple questions, shows a tab-based interface. Questions can be single-select (default) or multi-select.",
		parameters: QuestionnaireParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			// Guard on hasUI (true in TUI and RPC-with-host modes like Supacode), not mode==="tui".
			// An RPC host injects a working uiContext, so custom() renders fine there.
			if (!ctx.hasUI) {
				return errorResult("Error: UI not available (running in non-interactive mode)");
			}
			if (params.questions.length === 0) {
				return errorResult("Error: No questions provided");
			}

			// Normalize questions with defaults
			const questions = normalizeQuestions(params.questions);

			const result = await runQuestionnaireUI(ctx.ui, questions);

			if (result.cancelled) {
				return {
					content: [{ type: "text", text: "User cancelled the questionnaire" }],
					details: result,
				};
			}

			const answerLines = formatAnswerLines(questions, result.answers);

			return {
				content: [{ type: "text", text: answerLines.join("\n") }],
				details: result,
			};
		},

		renderCall(args, theme, _context) {
			const qs = (args.questions as Question[]) || [];
			const count = qs.length;
			const labels = qs.map((q) => q.label || q.id).join(", ");
			let text = theme.fg("toolTitle", theme.bold("questionnaire "));
			text += theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
			if (labels) {
				text += theme.fg("dim", ` (${labels})`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as QuestionnaireResult | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}
			if (details.cancelled) {
				return new Text(theme.fg("warning", "Cancelled"), 0, 0);
			}
			const lines = details.answers.map((a) => {
				if (a.wasCustom) {
					return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${theme.fg("muted", "(wrote) ")}${a.label}`;
				}
				const display = a.index ? `${a.index}. ${a.label}` : a.label;
				return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${display}`;
			});
			return new Text(lines.join("\n"), 0, 0);
		},
	});

	// Re-trigger the questionnaire UI when a session is resumed while a
	// questionnaire tool call was still pending (session ended mid-question).
	// Uses resources_discover instead of session_start: it fires after ALL
	// session_start handlers, so extensions that swap the editor component on
	// session_start (which clears the editor container) cannot clobber this UI.
	// The UI task is not awaited: blocking here would keep the conversation
	// history hidden until the questionnaire is answered.
	pi.on("resources_discover", (_event, ctx) => {
		if (!ctx.hasUI) return;
		const pending = findPendingQuestionnaire(ctx);
		if (!pending) return;

		void (async () => {
			const questions = normalizeQuestions(pending);
			const result = await runQuestionnaireUI(ctx.ui, questions);
			if (result.cancelled) return;

			const answerLines = formatAnswerLines(questions, result.answers);
			pi.sendUserMessage(
				`The session was resumed with an unanswered questionnaire. The user has now answered:\n${answerLines.join("\n")}`,
			);
		})().catch(() => {});
	});
}
