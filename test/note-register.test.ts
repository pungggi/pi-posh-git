/**
 * Regression test for the before_agent_start display gating.
 *
 * The note must attach to the LLM context every turn (the returned message is
 * always present), but it should only render a visible bubble when the note
 * body, git status, or resolved path actually changed. Previously `display`
 * was hard-wired to `true`, so the note re-appeared on every turn even when
 * nothing changed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// No real git in unit tests — keep the payload deterministic.
vi.mock("../src/git.js", () => ({
	getCachedGitStatus: vi.fn().mockResolvedValue(null),
	formatGitLine: vi.fn().mockReturnValue("git: mock"),
	invalidateGitCache: vi.fn(),
}));

import { registerNote } from "../src/note/register.js";
import { writeNote } from "../src/note/note-file.js";

type Handler = (event?: unknown, ctx?: unknown) => unknown | Promise<unknown>;
type PiLike = Parameters<typeof registerNote>[0] & { handlers: Map<string, Handler> };

function makePi() {
	const handlers = new Map<string, Handler>();
	return {
		on: vi.fn((event: string, handler: Handler) => {
			handlers.set(event, handler);
		}),
		sendMessage: vi.fn(),
		registerCommand: vi.fn(),
		getThinkingLevel: vi.fn().mockReturnValue(0),
		handlers,
	} as unknown as PiLike;
}

describe("before_agent_start display gating", () => {
	let tmp: string;
	let notePath: string;
	let prevEnv: string | undefined;

	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-posh-git-"));
		notePath = path.join(tmp, "note.md");
		writeNote(notePath, "hello");
		prevEnv = process.env.PI_POSH_GIT_NOTE_PATH;
		// Force override resolution so the note lives in the temp dir. No
		// session_start is fired, so no real fs.watch is registered — the gating
		// logic under test lives entirely in before_agent_start.
		process.env.PI_POSH_GIT_NOTE_PATH = notePath;
	});

	afterEach(() => {
		if (prevEnv === undefined) delete process.env.PI_POSH_GIT_NOTE_PATH;
		else process.env.PI_POSH_GIT_NOTE_PATH = prevEnv;
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	it("shows the bubble on turn 1, hides it when unchanged, shows it again on change", async () => {
		const pi = makePi();
		registerNote(pi);

		const beforeAgentStart = pi.handlers.get("before_agent_start")!;

		// Turn 1: nothing sent yet → must display.
		const r1 = (await beforeAgentStart()) as { message: { display: boolean; customType: string } };
		expect(r1.message.display).toBe(true);
		expect(r1.message.customType).toBe("pi-posh-git-note");

		// Turn 2: note body, git, and path all unchanged → hide the bubble, but
		// still attach the note to context (message present).
		const r2 = (await beforeAgentStart()) as { message: { display: boolean; customType: string } };
		expect(r2.message.display).toBe(false);
		expect(r2.message).toBeDefined();
		expect(r2.message.customType).toBe("pi-posh-git-note");

		// Turn 3: note body changed → display again.
		writeNote(notePath, "world");
		const r3 = (await beforeAgentStart()) as { message: { display: boolean } };
		expect(r3.message.display).toBe(true);
	});
});
