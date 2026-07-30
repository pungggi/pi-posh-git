/**
 * Open the note file in an external editor (fire-and-forget).
 *
 * All filesystem setup (parent dir + empty-file creation) runs inside the try
 * so an unwritable/invalid path returns { ok: false } instead of throwing —
 * /note edit does not wrap this call in its own try/catch.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { ensureParentDir } from "./paths.js";

export interface OpenEditorResult {
	ok: boolean;
	message: string;
	editor: string;
}

/** Ensure the file exists (create empty if missing), then open it. */
export function openInEditor(
	filePath: string,
	env: NodeJS.ProcessEnv = process.env,
): OpenEditorResult {
	const configured =
		env.PI_POSH_GIT_NOTE_EDITOR?.trim() || env.EDITOR?.trim() || env.VISUAL?.trim() || "";

	try {
		// Filesystem setup — may throw on an unwritable/invalid path.
		ensureParentDir(filePath);
		if (!fs.existsSync(filePath)) {
			fs.writeFileSync(filePath, "", "utf8");
		}

		if (configured) {
			const child = spawn(configured, [filePath], {
				detached: true,
				stdio: "ignore",
				shell: true,
				windowsHide: true,
			});
			child.unref();
			return { ok: true, message: `Opened in ${configured}`, editor: configured };
		}

		if (process.platform === "win32") {
			const child = spawn("cmd", ["/c", "start", "", "notepad", filePath], {
				detached: true,
				stdio: "ignore",
				windowsHide: true,
			});
			child.unref();
			return { ok: true, message: "Opened in notepad", editor: "notepad" };
		}

		if (process.platform === "darwin") {
			const child = spawn("open", ["-t", filePath], {
				detached: true,
				stdio: "ignore",
			});
			child.unref();
			return { ok: true, message: "Opened with open -t", editor: "open" };
		}

		const child = spawn("xdg-open", [filePath], {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
		return { ok: true, message: "Opened with xdg-open", editor: "xdg-open" };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, message: `Failed to open editor: ${msg}`, editor: configured || "(none)" };
	}
}
