import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteIdempotencyStore } from "../../src/idempotency/sqlite-idempotency-store.js";

describe("SqliteIdempotencyStore", () => {
	let store: SqliteIdempotencyStore;
	let tempDir: string;
	let currentTime: number;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "idempotency-test-"));
		currentTime = 1_000_000;
		store = new SqliteIdempotencyStore({
			dbPath: join(tempDir, "test.db"),
			ttlMs: 60_000,
			cleanupIntervalMs: 300_000,
			now: () => currentTime,
		});
	});

	afterEach(() => {
		store.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("create", () => {
		it("creates a new record and returns true", () => {
			expect(store.create("key1")).toBe(true);
		});

		it("returns false for duplicate key", () => {
			store.create("key1");
			expect(store.create("key1")).toBe(false);
		});

		it("allows recreation after TTL expiry", () => {
			store.create("key1");
			currentTime += 61_000;
			expect(store.create("key1")).toBe(true);
		});
	});

	describe("get", () => {
		it("returns undefined for nonexistent key", () => {
			expect(store.get("nonexistent")).toBeUndefined();
		});

		it("returns record for existing key", () => {
			store.create("key1");
			const record = store.get("key1");
			expect(record).toBeDefined();
			expect(record?.key).toBe("key1");
			expect(record?.state).toBe("in_progress");
		});

		it("returns undefined for expired key", () => {
			store.create("key1");
			currentTime += 61_000;
			expect(store.get("key1")).toBeUndefined();
		});
	});

	describe("complete", () => {
		it("marks record as completed with response", () => {
			store.create("key1");
			store.complete("key1", { messageId: "msg-1", ts: 123 });
			const record = store.get("key1");
			expect(record?.state).toBe("completed");
			expect(record?.response).toBe(
				JSON.stringify({ messageId: "msg-1", ts: 123 }),
			);
		});
	});

	describe("fail", () => {
		it("marks record as failed with error", () => {
			store.create("key1");
			store.fail("key1", { message: "handler error" });
			const record = store.get("key1");
			expect(record?.state).toBe("failed");
			expect(record?.response).toBe(
				JSON.stringify({ message: "handler error" }),
			);
		});
	});

	describe("cleanup", () => {
		it("removes expired records", () => {
			store.create("key1");
			store.create("key2");
			currentTime += 61_000;
			const deleted = store.cleanup();
			expect(deleted).toBe(2);
			expect(store.get("key1")).toBeUndefined();
			expect(store.get("key2")).toBeUndefined();
		});

		it("preserves non-expired records", () => {
			store.create("key1");
			currentTime += 30_000;
			const deleted = store.cleanup();
			expect(deleted).toBe(0);
			expect(store.get("key1")).toBeDefined();
		});
	});

	describe("duplicate replay", () => {
		it("returns completed response on duplicate lookup", () => {
			store.create("key1");
			store.complete("key1", { result: "ok" });

			const record = store.get("key1");
			expect(record?.state).toBe("completed");
			const response = record?.response;
			expect(response).toBeDefined();
			expect(JSON.parse(response ?? "{}")).toEqual({ result: "ok" });
		});
	});
});
