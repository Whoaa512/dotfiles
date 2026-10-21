import { describe, expect, test } from "bun:test";
import { isBlockedReadPath } from "../extensions/read-guard";

const blocked = [
	"package-lock.json",
	"/repo/package-lock.json",
	"pnpm-lock.yaml",
	"yarn.lock",
	"bun.lockb",
	"bun.lock",
	"Cargo.lock",
	"go.sum",
	"poetry.lock",
	"uv.lock",
	"Gemfile.lock",
	"composer.lock",
	"public/app.min.js",
	"public/app.min.css",
	"/repo/dist/index.js",
	"/repo/build/out.ts",
	"/repo/node_modules/foo/index.js",
];

const allowed = [
	"package.json",
	"src/lock.ts",
	"go.mod",
	"Cargo.toml",
	"src/index.js",
	"styles/app.css",
	"src/builder.ts",
	"src/distance.ts",
	"distribution/notes.md",
	"README.md",
];

describe("isBlockedReadPath", () => {
	for (const p of blocked)
		test(`blocks: ${p}`, () => expect(isBlockedReadPath(p)).toBe(true));
	for (const p of allowed)
		test(`allows: ${p}`, () => expect(isBlockedReadPath(p)).toBe(false));
});
