import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptWriter } from "../../src/persistence/transcript-writer.js";

describe("TranscriptWriter", () => {
	let tempDir: string;
	let currentTime: number;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "transcript-test-"));
		currentTime = 1_000_000;
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	function createWriter(
		overrides: Partial<{
			dataDir: string;
			agentId: string;
			sessionId: string;
			fsync: boolean;
			onError: (error: Error) => void;
		}> = {},
	) {
		return new TranscriptWriter({
			dataDir: tempDir,
			agentId: "agent-1",
			sessionId: "session-1",
			fsync: false,
			now: () => currentTime,
			...overrides,
		});
	}

	describe("append and recover round-trip", () => {
		it("writes entries and recovers them", () => {
			const writer = createWriter();
			writer.append({ type: "request", data: { msg: "hello" } });
			writer.append({ type: "response", data: { msg: "world" } });
			writer.close();

			const { entries, truncated } = TranscriptWriter.recover(writer.path);
			expect(truncated).toBe(false);
			expect(entries).toHaveLength(2);
			expect(entries[0]).toEqual({
				ts: 1_000_000,
				type: "request",
				data: { msg: "hello" },
			});
			expect(entries[1]).toEqual({
				ts: 1_000_000,
				type: "response",
				data: { msg: "world" },
			});
		});
	});

	describe("lazy file creation", () => {
		it("does not create file until first append", () => {
			const writer = createWriter();
			expect(existsSync(writer.path)).toBe(false);
			writer.append({ type: "system", data: "init" });
			expect(existsSync(writer.path)).toBe(true);
			writer.close();
		});
	});

	describe("auto timestamp", () => {
		it("adds ts from now() when entry has no ts", () => {
			currentTime = 42_000;
			const writer = createWriter();
			writer.append({ type: "event", data: "tick" });
			writer.close();

			const { entries } = TranscriptWriter.recover(writer.path);
			expect(entries[0].ts).toBe(42_000);
		});
	});

	describe("custom timestamp", () => {
		it("preserves explicit ts on entry", () => {
			const writer = createWriter();
			writer.append({ ts: 99_999, type: "request", data: "explicit" });
			writer.close();

			const { entries } = TranscriptWriter.recover(writer.path);
			expect(entries[0].ts).toBe(99_999);
		});
	});

	describe("directory creation", () => {
		it("creates nested directory structure", () => {
			const writer = createWriter({
				dataDir: join(tempDir, "deep", "nested"),
				agentId: "a",
				sessionId: "s",
			});
			writer.append({ type: "system", data: "x" });
			writer.close();

			const expectedDir = join(
				tempDir,
				"deep",
				"nested",
				"agents",
				"a",
				"sessions",
			);
			expect(existsSync(expectedDir)).toBe(true);
		});
	});

	describe("crash recovery", () => {
		it("discards truncated last line and sets truncated flag", () => {
			const writer = createWriter();
			writer.append({ type: "request", data: "good" });
			writer.close();

			// Append a partial/corrupt line directly
			const content = readFileSync(writer.path, "utf8");
			writeFileSync(writer.path, `${content}{"type":"broken`);

			const { entries, truncated } = TranscriptWriter.recover(writer.path);
			expect(truncated).toBe(true);
			expect(entries).toHaveLength(1);
			expect(entries[0].data).toBe("good");
		});
	});

	describe("multiple entries", () => {
		it("appends and recovers many entries", () => {
			const writer = createWriter();
			for (let i = 0; i < 10; i++) {
				currentTime = 1_000 + i;
				writer.append({ type: "event", data: { index: i } });
			}
			writer.close();

			const { entries, truncated } = TranscriptWriter.recover(writer.path);
			expect(truncated).toBe(false);
			expect(entries).toHaveLength(10);
			for (let i = 0; i < 10; i++) {
				expect(entries[i].ts).toBe(1_000 + i);
				expect(entries[i].data).toEqual({ index: i });
			}
		});
	});

	describe("close idempotency", () => {
		it("does not throw when close is called twice", () => {
			const writer = createWriter();
			writer.append({ type: "system", data: "x" });
			writer.close();
			expect(() => writer.close()).not.toThrow();
		});

		it("does not throw when close is called without any append", () => {
			const writer = createWriter();
			expect(() => writer.close()).not.toThrow();
		});
	});

	describe("file permissions", () => {
		it("creates file with 0o600 mode", () => {
			const writer = createWriter();
			writer.append({ type: "system", data: "perm" });
			writer.close();

			const stats = statSync(writer.path);
			expect(stats.mode & 0o777).toBe(0o600);
		});
	});

	describe("error callback", () => {
		it("calls onError when write fails", () => {
			const onError = vi.fn();
			const writer = createWriter({ onError });
			writer.append({ type: "system", data: "open file" });

			// Close the fd out from under the writer to force a write error
			writer.close();
			// fd is now null, next append will try to open — use a read-only dir to force error
			const readOnlyWriter = new TranscriptWriter({
				dataDir: "/dev/null/impossible",
				agentId: "a",
				sessionId: "s",
				fsync: false,
				onError,
				now: () => currentTime,
			});
			readOnlyWriter.append({ type: "error", data: "fail" });
			expect(onError).toHaveBeenCalledOnce();
			expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
		});
	});

	describe("injectable clock", () => {
		it("uses injected now() for timestamps", () => {
			let time = 5_000;
			const writer = new TranscriptWriter({
				dataDir: tempDir,
				agentId: "agent-clock",
				sessionId: "sess-clock",
				fsync: false,
				now: () => time,
			});

			writer.append({ type: "request", data: "first" });
			time = 6_000;
			writer.append({ type: "response", data: "second" });
			writer.close();

			const { entries } = TranscriptWriter.recover(writer.path);
			expect(entries[0].ts).toBe(5_000);
			expect(entries[1].ts).toBe(6_000);
		});
	});

	describe("path construction", () => {
		it("builds correct file path", () => {
			const writer = createWriter({
				dataDir: "/home/user/.homeagent",
				agentId: "my-agent",
				sessionId: "sess-abc",
			});
			expect(writer.path).toBe(
				"/home/user/.homeagent/agents/my-agent/sessions/sess-abc.jsonl",
			);
		});
	});

	describe("fsync enabled", () => {
		it("writes successfully with fsync enabled", () => {
			const writer = createWriter({ fsync: true });
			writer.append({ type: "system", data: "synced" });
			writer.close();

			const { entries } = TranscriptWriter.recover(writer.path);
			expect(entries).toHaveLength(1);
			expect(entries[0].data).toBe("synced");
		});
	});
});
