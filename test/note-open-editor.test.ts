import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openInEditor } from "../src/note/open-editor.js";

const tmpDirs: string[] = [];

function tmpFile(name = "note.md"): string {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), "pi-posh-git-edit-"));
	tmpDirs.push(d);
	return path.join(d, "sub", name);
}

afterEach(() => {
	for (const d of tmpDirs.splice(0)) {
		fs.rmSync(d, { recursive: true, force: true });
	}
});

describe("openInEditor", () => {
	it("returns ok:false (instead of throwing) when setup fails on an unwritable path", () => {
		// Create a real file, then target a path nested beneath it so
		// ensureParentDir / writeFileSync throws. Setup runs inside the try, so
		// the failure is reported as { ok: false } rather than escaping to the
		// caller (/note edit does not wrap this call in its own try/catch).
		const blocker = tmpFile("blocker");
		fs.mkdirSync(path.dirname(blocker), { recursive: true });
		fs.writeFileSync(blocker, "x");
		const under = path.join(blocker, "note.md");

		const result = openInEditor(under, {});
		expect(result.ok).toBe(false);
		expect(result.message).toContain("Failed to open editor");
	});
});
