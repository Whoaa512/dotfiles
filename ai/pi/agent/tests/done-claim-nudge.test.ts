import { describe, expect, test } from "bun:test";
import { looksLikeDoneClaim } from "../extensions/done-claim-nudge";

const positives = [
	"Fixed the null deref in parser.ts.",
	"The bug is fixed, moving on.",
	"Tests are passing now.",
	"All green on CI.",
	"Deployed to staging.",
	"Merged and pushed to main.",
	"I triggered the pipeline.",
	"Launched the job.",
	"Step 3 of 5 is done.",
	"It now works end to end.",
	"Verified the endpoint returns 200.",
];

const negatives = [
	"Should I run the tests now?",
	"Is it fixed?",
	"Did the deploy go through, is it merged?",
	"Fixed the typo, but not verified yet.",
	"I pushed, though I haven't verified CI.",
	"Can't verify from here whether it deployed.",
	"Let me look at the failing test.",
	"Here's the plan: refactor, then test.",
	"",
];

describe("looksLikeDoneClaim", () => {
	for (const t of positives)
		test(`claims: ${t}`, () => expect(looksLikeDoneClaim(t)).not.toBeNull());
	for (const t of negatives)
		test(`no claim: ${JSON.stringify(t)}`, () =>
			expect(looksLikeDoneClaim(t)).toBeNull());

	test("returns the matching sentence, not the whole text", () =>
		expect(
			looksLikeDoneClaim(
				"Looked at the logs. Deployed to staging. Next: smoke test.",
			),
		).toBe("Deployed to staging."));
	test("question sentence skipped but later claim caught", () =>
		expect(looksLikeDoneClaim("Is it fixed? Yes, it is fixed.")).toBe(
			"Yes, it is fixed.",
		));
	test("newline-separated sentences", () =>
		expect(looksLikeDoneClaim("- ran lint\n- pushed to origin")).toBe(
			"- pushed to origin",
		));
});
