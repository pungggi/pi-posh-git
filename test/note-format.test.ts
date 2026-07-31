import { describe, expect, it } from "vitest";
import {
	buildPayload,
	CUSTOM_TYPE,
	formatTimestamp,
	pruneNoteMessages,
} from "../src/note/format.js";

describe("formatTimestamp", () => {
	it("returns local offset ISO-like string", () => {
		const ts = formatTimestamp(new Date("2026-03-30T16:42:11.000Z"));
		expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
	});
});

describe("buildPayload", () => {
	it("includes header, git, and body", () => {
		const p = buildPayload({
			body: "Ship via tag only",
			source: "project",
			path: "/repo/.pi/note.md",
			updatedAt: "2026-03-30T18:42:11+02:00",
			mtime: "2026-03-30T18:40:00.000Z",
			gitLine: "git: main ≡ clean",
		});
		expect(p.content).toBe(
			[
				"[pi-posh-git note · 2026-03-30T18:42:11+02:00 · project]",
				"git: main ≡ clean",
				"",
				"Ship via tag only",
			].join("\n"),
		);
		expect(p.details.hasBody).toBe(true);
		expect(p.details.hasGit).toBe(true);
	});

	it("shows placeholder when empty and no git", () => {
		const p = buildPayload({
			body: "",
			source: "global",
			path: "/home/u/.pi-posh-git/note.md",
			updatedAt: "2026-03-30T18:42:11+02:00",
			mtime: null,
			gitLine: null,
		});
		expect(p.content).toContain("(no note — /note set");
		expect(p.details.hasBody).toBe(false);
		expect(p.details.hasGit).toBe(false);
	});

	it("git-only when body empty", () => {
		const p = buildPayload({
			body: "  ",
			source: "project",
			path: "x",
			updatedAt: "t",
			mtime: null,
			gitLine: "git: main ↑1 clean",
		});
		expect(p.content).toBe("[pi-posh-git note · t · project]\ngit: main ↑1 clean");
		expect(p.details.hasBody).toBe(false);
		expect(p.details.hasGit).toBe(true);
	});
});

describe("buildPayload signature", () => {
	const base = {
		source: "project" as const,
		path: "/repo/.pi/note.md",
		mtime: "2026-03-30T18:40:00.000Z",
		gitLine: "git: main ≡ clean",
	};

	it("is stable across timestamp changes", () => {
		const a = buildPayload({ ...base, body: "hi", updatedAt: "2026-03-30T18:42:11+02:00" });
		const b = buildPayload({ ...base, body: "hi", updatedAt: "2026-03-30T19:00:00+02:00" });
		expect(a.content).not.toBe(b.content); // header timestamp differs
		expect(a.signature).toBe(b.signature); // ...but signature is stable
	});

	it("changes when the body changes", () => {
		const a = buildPayload({ ...base, body: "hi", updatedAt: "t" });
		const b = buildPayload({ ...base, body: "hi!", updatedAt: "t" });
		expect(a.signature).not.toBe(b.signature);
	});

	it("changes when the git line changes", () => {
		const a = buildPayload({ ...base, body: "hi", updatedAt: "t", gitLine: "git: main ≡ clean" });
		const b = buildPayload({ ...base, body: "hi", updatedAt: "t", gitLine: "git: main ↑1 clean" });
		expect(a.signature).not.toBe(b.signature);
	});

	it("changes when the resolved path changes (switching targets)", () => {
		const a = buildPayload({ ...base, body: "hi", updatedAt: "t", path: "/repo-a/.pi/note.md" });
		const b = buildPayload({ ...base, body: "hi", updatedAt: "t", path: "/repo-b/.pi/note.md" });
		expect(a.signature).not.toBe(b.signature);
	});
});

describe("pruneNoteMessages", () => {
	it("keeps only the last pi-posh-git-note custom message", () => {
		const messages = [
			{ role: "user", content: "hi" },
			{ role: "custom", customType: CUSTOM_TYPE, content: "old" },
			{ role: "assistant", content: "ok" },
			{ role: "custom", customType: CUSTOM_TYPE, content: "new" },
			{ role: "custom", customType: "other", content: "keep" },
		];
		const pruned = pruneNoteMessages(messages);
		expect(pruned).toEqual([
			{ role: "user", content: "hi" },
			{ role: "assistant", content: "ok" },
			{ role: "custom", customType: CUSTOM_TYPE, content: "new" },
			{ role: "custom", customType: "other", content: "keep" },
		]);
	});

	it("is a no-op when no note messages", () => {
		const messages = [{ role: "user" as const }];
		expect(pruneNoteMessages(messages)).toBe(messages);
	});

	it("prunes even when role is missing (role-agnostic match)", () => {
		type Msg = { role?: string; customType?: string; content: string };
		const messages: Msg[] = [
			{ customType: CUSTOM_TYPE, content: "old" },
			{ customType: CUSTOM_TYPE, content: "new" },
		];
		const pruned = pruneNoteMessages(messages);
		expect(pruned).toHaveLength(1);
		expect(pruned[0]?.content).toBe("new");
	});
});
