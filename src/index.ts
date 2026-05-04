/**
 * pi-posh-git — posh-git style git status, always visible as a widget
 *
 * Displays a persistent posh-git prompt line below the editor, e.g.:
 *   ~/projects/app [main ↓2 ↑3 +1 ~0 -0 | +0 ~2 -0 !]>
 *
 * Auto-refreshes on session start and after every tool execution.
 */

import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import type { ReadonlyFooterDataProvider } from "@mariozechner/pi-coding-agent";
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

function buildPrompt(status: GitStatus, th: Theme): string {
	const hasIndex =
		status.indexAdded > 0 || status.indexModified > 0 || status.indexDeleted > 0;
	const hasWorking =
		status.workingAdded > 0 || status.workingModified > 0 ||
		status.workingDeleted > 0 || status.hasUnmerged;

	const p: string[] = [];

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

// ── minimal string-width helpers (ANSI-aware) ──────────────────────

const SGR_RE = /\x1b\[[0-9;]*m/g;

/** Visible width of a string that may contain SGR escape sequences. */
function visibleWidth(s: string): number {
	return s.replace(SGR_RE, "").length;
}

/**
 * Truncate a possibly-colored string to `maxWidth` visible columns.
 * Appends `ellipsis` ("..." default) if truncated, preserving any trailing SGR.
 */
function truncateToWidth(s: string, maxWidth: number, ellipsis: string = "..."): string {
	const bare = s.replace(SGR_RE, "");
	if (bare.length <= maxWidth) return s;
	const ellipsisVis = ellipsis.replace(SGR_RE, "").length;
	const target = Math.max(0, maxWidth - ellipsisVis);
	// Walk the original string, counting only non-SGR chars
	let vis = 0;
	let i = 0;
	let lastContentIdx = 0;
	for (; i < s.length; i++) {
		if (s[i] === "\x1b") {
			// skip SGR sequence
			const semi = s.indexOf("m", i);
			if (semi !== -1) { i = semi; continue; }
		}
		if (vis >= target) break;
		vis++;
		lastContentIdx = i + 1;
	}
	return s.slice(0, lastContentIdx) + ellipsis;
}

// ── footer (default minus git branch) ────────────────────────────────

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
	if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	return `${Math.round(count / 1_000_000)}M`;
}

function sanitizeStatusText(text: string): string {
	return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

/**
 * Build a footer that mirrors pi's built-in footer but omits the git branch
 * from the pwd line (since pi-posh-git shows it in the widget below).
 */
function createNoBranchFooter(
	ctx: {
		sessionManager: any; model: any; cwd: string;
		getContextUsage: () => { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
	},
	th: Theme,
	footerData: ReadonlyFooterDataProvider,
	tui: { requestRender: () => void },
	getThinkingLevel: () => string,
) {
	const unsub = footerData.onBranchChange(() => tui.requestRender());

	return {
		dispose: unsub,
		invalidate() {},
		render(width: number): string[] {
			// ── pwd line (no branch) ──
			let pwd = ctx.sessionManager.getCwd();
			const home = process.env.HOME || process.env.USERPROFILE;
			if (home && pwd.startsWith(home)) {
				pwd = `~${pwd.slice(home.length)}`;
			}
			// Append session name if set
			const sessionName = ctx.sessionManager.getSessionName?.();
			if (sessionName) {
				pwd = `${pwd} • ${sessionName}`;
			}

			// ── token stats ──
			let totalInput = 0, totalOutput = 0;
			let totalCacheRead = 0, totalCacheWrite = 0, totalCost = 0;
			for (const entry of ctx.sessionManager.getEntries()) {
				if (entry.type === "message" && entry.message.role === "assistant") {
					const u = (entry.message as any).usage;
					totalInput += u.input;
					totalOutput += u.output;
					totalCacheRead += u.cacheRead;
					totalCacheWrite += u.cacheWrite;
					totalCost += u.cost.total;
				}
			}

			// ── context usage ──
			const contextUsage = ctx.getContextUsage();
			const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
			const contextPercentValue = contextUsage?.percent ?? 0;
			const contextPercent = contextUsage?.percent !== null ? contextPercentValue.toFixed(1) : "?";

			// ── build stats line ──
			const statsParts: string[] = [];
			if (totalInput) statsParts.push(`↑${formatTokens(totalInput)}`);
			if (totalOutput) statsParts.push(`↓${formatTokens(totalOutput)}`);
			if (totalCacheRead) statsParts.push(`R${formatTokens(totalCacheRead)}`);
			if (totalCacheWrite) statsParts.push(`W${formatTokens(totalCacheWrite)}`);
			if (totalCost) statsParts.push(`$${totalCost.toFixed(3)}`);

			// colorize context %
			const contextPercentDisplay = contextPercent === "?"
				? `?/${formatTokens(contextWindow)}`
				: `${contextPercent}%/${formatTokens(contextWindow)}`;
			let contextPercentStr: string;
			if (contextPercentValue > 90) {
				contextPercentStr = th.fg("error", contextPercentDisplay);
			} else if (contextPercentValue > 70) {
				contextPercentStr = th.fg("warning", contextPercentDisplay);
			} else {
				contextPercentStr = contextPercentDisplay;
			}
			statsParts.push(contextPercentStr);

			let statsLeft = statsParts.join(" ");

			// ── model + thinking on the right ──
			const modelName = ctx.model?.id || "no-model";
			let rightSide = modelName;
			if (ctx.model?.reasoning) {
				const thinkingLevel = getThinkingLevel() || "off";
				rightSide = thinkingLevel === "off" ? `${modelName} • thinking off` : `${modelName} • ${thinkingLevel}`;
			}

			// provider prefix when multiple providers
			if (footerData.getAvailableProviderCount() > 1 && ctx.model) {
				const withProvider = `(${ctx.model.provider}) ${rightSide}`;
				if (visibleWidth(statsLeft) + 2 + visibleWidth(withProvider) <= width) {
					rightSide = withProvider;
				}
			}

			let statsLeftWidth = visibleWidth(statsLeft);
			if (statsLeftWidth > width) {
				statsLeft = truncateToWidth(statsLeft, width, "...");
				statsLeftWidth = visibleWidth(statsLeft);
			}

			const rightSideWidth = visibleWidth(rightSide);
			const totalNeeded = statsLeftWidth + 2 + rightSideWidth;
			let statsLine: string;
			if (totalNeeded <= width) {
				const padding = " ".repeat(width - statsLeftWidth - rightSideWidth);
				statsLine = statsLeft + padding + rightSide;
			} else {
				const availableForRight = width - statsLeftWidth - 2;
				if (availableForRight > 0) {
					const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
					const padding = " ".repeat(Math.max(0, width - statsLeftWidth - visibleWidth(truncatedRight)));
					statsLine = statsLeft + padding + truncatedRight;
				} else {
					statsLine = statsLeft;
				}
			}

			const dimStatsLeft = th.fg("dim", statsLeft);
			const remainder = statsLine.slice(statsLeft.length);
			const dimRemainder = th.fg("dim", remainder);
			const pwdLine = truncateToWidth(th.fg("dim", pwd), width, th.fg("dim", "..."));
			const lines = [pwdLine, dimStatsLeft + dimRemainder];

			// extension statuses
			const extensionStatuses = footerData.getExtensionStatuses();
			if (extensionStatuses.size > 0) {
				const sortedStatuses = Array.from(extensionStatuses.entries())
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([, text]) => sanitizeStatusText(text));
				const statusLine = sortedStatuses.join(" ");
				lines.push(truncateToWidth(statusLine, width, th.fg("dim", "...")));
			}

			return lines;
		},
	};
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
				const line = buildPrompt(status, ctx.ui.theme);
				ctx.ui.setWidget(WIDGET_ID, [line], { placement: "belowEditor" });
			} catch {
				ctx.ui.setWidget(WIDGET_ID, undefined);
			}
		}, 150);
	}

	// Initial display on session start — set custom footer + widget
	pi.on("session_start", async (_event, ctx) => {
		// Replace built-in footer with one that omits the git branch
		ctx.ui.setFooter((tui, th, footerData) =>
			createNoBranchFooter(ctx as any, th, footerData, tui, () => pi.getThinkingLevel()),
		);
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

	// Restore built-in footer and clear widget on shutdown
	pi.on("session_shutdown", async (_event, ctx) => {
		if (refreshTimer) {
			clearTimeout(refreshTimer);
			refreshTimer = null;
		}
		ctx.ui.setWidget(WIDGET_ID, undefined);
		ctx.ui.setFooter(undefined);
	});
}
