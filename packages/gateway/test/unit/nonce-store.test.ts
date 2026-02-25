import { describe, expect, it } from "vitest";

import { NonceStore } from "../../src/state/nonce-store.js";

describe("nonce-store", () => {
	it("checkAndMark returns true for a new nonce", () => {
		const nowMs = 1_000;
		const store = new NonceStore(5_000, () => nowMs);

		expect(store.checkAndMark("nonce-1", "device-1")).toBe(true);
	});

	it("checkAndMark returns false for a replayed nonce", () => {
		const nowMs = 1_000;
		const store = new NonceStore(5_000, () => nowMs);

		expect(store.checkAndMark("nonce-1", "device-1")).toBe(true);
		expect(store.checkAndMark("nonce-1", "device-1")).toBe(false);
	});

	it("different nonces are independent", () => {
		const nowMs = 1_000;
		const store = new NonceStore(5_000, () => nowMs);

		expect(store.checkAndMark("nonce-1", "device-1")).toBe(true);
		expect(store.checkAndMark("nonce-2", "device-1")).toBe(true);
	});

	it("the same nonce from different devices is allowed", () => {
		const nowMs = 1_000;
		const store = new NonceStore(5_000, () => nowMs);

		expect(store.checkAndMark("shared-nonce", "device-1")).toBe(true);
		expect(store.checkAndMark("shared-nonce", "device-2")).toBe(true);
	});

	it("evict removes expired entries", () => {
		let nowMs = 1_000;
		const store = new NonceStore(5_000, () => nowMs);

		expect(store.checkAndMark("nonce-old", "device-1")).toBe(true);
		nowMs = 7_000;
		expect(store.evict()).toBe(1);
	});

	it("checkAndMark returns true for previously expired nonce after eviction", () => {
		let nowMs = 1_000;
		const store = new NonceStore(5_000, () => nowMs);

		expect(store.checkAndMark("nonce-1", "device-1")).toBe(true);
		nowMs = 7_000;
		expect(store.evict()).toBe(1);
		expect(store.checkAndMark("nonce-1", "device-1")).toBe(true);
	});
});
