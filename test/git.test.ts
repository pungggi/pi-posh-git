import { describe, expect, it } from "vitest";
import { formatGitLine, parsePorcelainV2, type GitStatus } from "../src/git.js";

const cleanBase: GitStatus = {
	branch: "main",
	upstream: "origin/main",
	aheadBy: 0,
	behindBy: 0,
	upstreamGone: false,
	indexAdded: 0,
	indexModified: 0,
	indexDeleted: 0,
	indexUnmerged: 0,
	workingAdded: 0,
	workingModified: 0,
	workingDeleted: 0,
	workingUnmerged: 0,
	stashCount: 0,
};

describe("parsePorcelainV2", () => {
	it("parses branch and clean tree", () => {
		const raw = [
			"# branch.oid abc",
			"# branch.head main",
			"# branch.upstream origin/main",
			"# branch.ab +1 -2",
			"",
		].join("\n");
		const p = parsePorcelainV2(raw);
		expect(p.branch).toBe("main");
		expect(p.upstream).toBe("origin/main");
		expect(p.aheadBy).toBe(1);
		expect(p.behindBy).toBe(2);
		expect(p.workingModified).toBe(0);
	});

	it("counts staged and unstaged changes", () => {
		const raw = [
			"# branch.head main",
			"1 AM N... 000 000 000 A file-a",
			"1 MM N... 000 000 000 M file-b",
			"1 D. N... 000 000 000 D file-c",
			"? untracked.txt",
			"",
		].join("\n");
		const p = parsePorcelainV2(raw);
		expect(p.indexAdded).toBe(1);
		expect(p.indexModified).toBe(1);
		expect(p.indexDeleted).toBe(1);
		expect(p.workingModified).toBe(2);
		expect(p.workingAdded).toBe(1);
	});

	it("treats rename/copy entries as index-modified", () => {
		const raw = ["# branch.head main", "2 R. N... 000 000 000 R100 a b", ""].join("\n");
		const p = parsePorcelainV2(raw);
		expect(p.indexModified).toBe(1);
	});

	it("counts unmerged (u ) entries on both sides", () => {
		const raw = ["# branch.head main", "u UU 00000000 00000000 00000000 100644 1 1 1 a", ""].join("\n");
		const p = parsePorcelainV2(raw);
		expect(p.indexUnmerged).toBe(1);
		expect(p.workingUnmerged).toBe(1);
	});
});

describe("formatGitLine", () => {
	it("formats a clean branch with upstream", () => {
		expect(formatGitLine(cleanBase)).toBe("git: main ≡ clean");
	});

	it("formats ahead/behind", () => {
		const s = { ...cleanBase, aheadBy: 3, behindBy: 1 };
		expect(formatGitLine(s)).toBe("git: main ↓1 ↑3 clean");
	});

	it("formats dirty index and working tree", () => {
		const s: GitStatus = {
			...cleanBase,
			indexAdded: 1,
			workingModified: 2,
			workingDeleted: 1,
		};
		expect(formatGitLine(s)).toBe("git: main ≡ +1 ~0 -0 | +0 ~2 -1 !");
	});

	it("formats index-only as staged (~)", () => {
		const s: GitStatus = { ...cleanBase, indexModified: 2 };
		expect(formatGitLine(s)).toBe("git: main ≡ +0 ~2 -0 ~");
	});

	it("includes stash count", () => {
		const s = { ...cleanBase, stashCount: 2 };
		expect(formatGitLine(s)).toBe("git: main ≡ clean stash:2");
	});

	it("marks gone upstream", () => {
		const s = { ...cleanBase, upstreamGone: true };
		expect(formatGitLine(s)).toBe("git: main × clean");
	});

	it("omits upstream markers when no upstream", () => {
		const s: GitStatus = { ...cleanBase, upstream: null };
		expect(formatGitLine(s)).toBe("git: main clean");
	});
});
