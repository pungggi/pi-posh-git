/**
 * pi-posh-git — posh-git style git status, always visible as a widget
 *
 * Displays a persistent posh-git prompt line below the editor, e.g.:
 *   ~/projects/app [main ↓2 ↑3 +1 ~0 -0 | +0 ~2 -0 !]>
 *
 * Auto-refreshes on session start and after every tool execution.
 */

import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { execFile } from "node:child_process";

// ── git helpers ──────────────────────────────────────────────────────

interface GitStatus {
	branch: string;
	upstream: string | null;
	aheadBy: number;
	behindBy: number;
	upstreamGone: boolean;
	indexAdded: number;
	indexModified: number;
	indexDeleted: number;
	workingAdded: number;
	workingModified: number;
	workingDeleted: number;
	hasUnmerged: boolean;
	stashCount: number;
}

function runGit(cwd: string, args: string[]): Promise<string | null> {
	return new Promise((resolve) => {
		execFile(
			"git",
			["--no-optional-locks", ...args],
			{ cwd, timeout: 5000, maxBuffer: 1024 * 1024 },
			(err, stdout) => {
				if (err) resolve(null);
				else resolve(stdout);
			},
		);
	});
}

async function getGitStatus(cwd: string): Promise<GitStatus | null> {
	const statusResult = await runGit(cwd, [
		"status", "--porcelain=2", "--branch", "--no-renames", "-unormal",
	]);
	if (!statusResult) return null;

	const lines = statusResult.split("\n");

	let branch = "";
	let upstream: string | null = null;
	let aheadBy = 0;
	let behindBy = 0;
	let upstreamGone = false;
	let indexAdded = 0;
	let indexModified = 0;
	let indexDeleted = 0;
	let workingAdded = 0;
	let workingModified = 0;
	let workingDeleted = 0;
	let hasUnmerged = false;

	for (const line of lines) {
		if (line.startsWith("# branch.head ")) {
			branch = line.slice("# branch.head ".length);
			if (branch === "(detached)") {
				const sha = await runGit(cwd, ["rev-parse", "--short", "HEAD"]);
				branch = sha ? `(${sha.trim()})` : "(detached)";
			}
		} else if (line.startsWith("# branch.upstream ")) {
			upstream = line.slice("# branch.upstream ".length);
		} else if (line.startsWith("# branch.ab ")) {
			const parts = line.slice("# branch.ab ".length).split(" ");
			aheadBy = parseInt(parts[0]!, 10) || 0;
			behindBy = Math.abs(parseInt(parts[1]!, 10)) || 0;
		} else if (line.startsWith("1 ") || line.startsWith("2 ")) {
			const x = line.charAt(2);
			const y = line.charAt(3);
			if (x === "A") indexAdded++;
			else if (x === "M") indexModified++;
			else if (x === "D") indexDeleted++;
			else if (x === "R" || x === "C") indexModified++;
			else if (x === "U") hasUnmerged = true;
			if (y === "A" || y === "?") workingAdded++;
			else if (y === "M") workingModified++;
			else if (y === "D") workingDeleted++;
			else if (y === "U") hasUnmerged = true;
		} else if (line.startsWith("? ")) {
			workingAdded++;
		} else if (line.startsWith("u ")) {
			hasUnmerged = true;
		}
	}

	// Detect upstream gone: upstream is recorded but the ref no longer resolves
	if (upstream) {
		const rev = await runGit(cwd, ["rev-parse", "--verify", upstream]);
		if (!rev) upstreamGone = true;
	}

	// Stash count (only bother querying if we already have a repo)
	let stashCount = 0;
	const stashResult = await runGit(cwd, ["stash", "list"]);
	if (stashResult?.trim()) stashCount = stashResult.trim().split("\n").length;

	return {
		branch, upstream, aheadBy, behindBy, upstreamGone,
		indexAdded, indexModified, indexDeleted,
		workingAdded, workingModified, workingDeleted,
		hasUnmerged, stashCount,
	};
}

// ── posh-git prompt builder (theme-colored) ──────────────────────────

function buildPrompt(status: GitStatus, cwd: string, th: Theme): string {
	const hasIndex =
		status.indexAdded > 0 || status.indexModified > 0 || status.indexDeleted > 0;
	const hasWorking =
		status.workingAdded > 0 || status.workingModified > 0 ||
		status.workingDeleted > 0 || status.hasUnmerged;

	// Abbreviate path
	const home = process.env.HOME || process.env.USERPROFILE || "";
	const displayPath = home && cwd.startsWith(home) ? "~" + cwd.slice(home.length) : cwd;

	const p: string[] = [];

	// Path
	p.push(th.fg("text", displayPath) + " ");

	// [
	p.push(th.fg("warning", "["));

	// Branch (cyan)
	p.push(th.fg("accent", status.branch));

	// Branch tracking status
	if (status.upstream && status.upstreamGone) {
		p.push(" " + th.fg("muted", "×"));
	} else if (status.upstream && status.behindBy === 0 && status.aheadBy === 0) {
		p.push(" " + th.fg("accent", "≡"));
	} else if (status.upstream && status.behindBy > 0 && status.aheadBy > 0) {
		// posh-git "Full" format: ↓N ↑N
		p.push(" " + th.fg("warning", `↓${status.behindBy} ↑${status.aheadBy}`));
	} else if (status.upstream && status.behindBy > 0) {
		p.push(" " + th.fg("error", `↓${status.behindBy}`));
	} else if (status.upstream && status.aheadBy > 0) {
		p.push(" " + th.fg("success", `↑${status.aheadBy}`));
	}

	// Index (staged, green) — only when there are actually staged files
	if (hasIndex) {
		p.push(" " + th.fg("success",
			`+${status.indexAdded} ~${status.indexModified} -${status.indexDeleted}`));
	}

	// | delimiter — only when both sides have content
	if (hasIndex && hasWorking) {
		p.push(" " + th.fg("warning", "|"));
	}

	// Working (red) — only when there are actually unstaged files
	if (hasWorking) {
		p.push(" " + th.fg("error",
			`+${status.workingAdded} ~${status.workingModified} -${status.workingDeleted}`));
	}

	// Local status
	if (hasWorking) {
		p.push(" " + th.fg("error", "!"));
	} else if (hasIndex) {
		p.push(" " + th.fg("accent", "~"));
	} else {
		p.push(" " + th.fg("success", "≡"));
	}

	// Stash
	if (status.stashCount > 0) {
		p.push(" " + th.fg("warning", `(${status.stashCount})`));
	}

	// ] >
	p.push(th.fg("warning", "]"));
	p.push(th.fg("accent", ">"));

	return p.join("");
}

// ── extension ────────────────────────────────────────────────────────

const WIDGET_ID = "posh-git";

export default function (pi: ExtensionAPI) {
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleRefresh(ctx: { cwd: string; hasUI: boolean; ui: any }) {
		if (!ctx.hasUI) return;

		if (refreshTimer) clearTimeout(refreshTimer);

		refreshTimer = setTimeout(async () => {
			refreshTimer = null;
			try {
				const status = await getGitStatus(ctx.cwd);
				if (!status) {
					ctx.ui.setWidget(WIDGET_ID, undefined);
					return;
				}
				const line = buildPrompt(status, ctx.cwd, ctx.ui.theme);
				ctx.ui.setWidget(WIDGET_ID, [line], { placement: "belowEditor" });
			} catch {
				ctx.ui.setWidget(WIDGET_ID, undefined);
			}
		}, 150);
	}

	// Initial display on session start
	pi.on("session_start", async (_event, ctx) => {
		scheduleRefresh(ctx);
	});

	// Refresh after any tool finishes (files may have changed)
	pi.on("tool_result", async (_event, ctx) => {
		scheduleRefresh(ctx);
	});

	// Refresh when agent turn ends (catches multi-tool turns in one shot)
	pi.on("turn_end", async (_event, ctx) => {
		scheduleRefresh(ctx);
	});

	// Clean up on shutdown
	pi.on("session_shutdown", async (_event, ctx) => {
		if (refreshTimer) {
			clearTimeout(refreshTimer);
			refreshTimer = null;
		}
		ctx.ui.setWidget(WIDGET_ID, undefined);
	});
}
