import { afterEach, describe, expect, it, vi } from "vitest";

import {
	computeHmac,
	validateTimestamp,
	verifyHmac,
} from "../../src/auth/hmac-auth.js";

describe("hmac-auth", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("computeHmac returns a consistent hex digest", () => {
		const digestA = computeHmac(
			"device-1",
			"nonce-1",
			1_700_000_000_000,
			"shared-secret",
		);
		const digestB = computeHmac(
			"device-1",
			"nonce-1",
			1_700_000_000_000,
			"shared-secret",
		);

		expect(digestA).toBe(digestB);
		expect(digestA).toMatch(/^[a-f0-9]{64}$/);
	});

	it("verifyHmac returns true for a valid signature", () => {
		const signature = computeHmac(
			"device-1",
			"nonce-1",
			1_700_000_000_000,
			"shared-secret",
		);

		expect(
			verifyHmac(
				signature,
				"device-1",
				"nonce-1",
				1_700_000_000_000,
				"shared-secret",
			),
		).toBe(true);
	});

	it("verifyHmac returns false for a wrong signature", () => {
		expect(
			verifyHmac(
				"00".repeat(32),
				"device-1",
				"nonce-1",
				1_700_000_000_000,
				"shared-secret",
			),
		).toBe(false);
	});

	it("verifyHmac returns false for tampered deviceId, nonce, or timestamp", () => {
		const signature = computeHmac(
			"device-1",
			"nonce-1",
			1_700_000_000_000,
			"shared-secret",
		);

		expect(
			verifyHmac(
				signature,
				"device-2",
				"nonce-1",
				1_700_000_000_000,
				"shared-secret",
			),
		).toBe(false);
		expect(
			verifyHmac(
				signature,
				"device-1",
				"nonce-2",
				1_700_000_000_000,
				"shared-secret",
			),
		).toBe(false);
		expect(
			verifyHmac(
				signature,
				"device-1",
				"nonce-1",
				1_700_000_000_001,
				"shared-secret",
			),
		).toBe(false);
	});

	it("verifyHmac returns false for signatures with different length", () => {
		expect(() =>
			verifyHmac(
				"abcd",
				"device-1",
				"nonce-1",
				1_700_000_000_000,
				"shared-secret",
			),
		).not.toThrow();
		expect(
			verifyHmac(
				"abcd",
				"device-1",
				"nonce-1",
				1_700_000_000_000,
				"shared-secret",
			),
		).toBe(false);
	});

	it("validateTimestamp returns true for current timestamp", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-24T12:00:00.000Z"));

		expect(validateTimestamp(Date.now(), 30_000)).toBe(true);
	});

	it("validateTimestamp returns false for stale timestamp beyond skew", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-24T12:00:30.001Z"));

		expect(
			validateTimestamp(new Date("2026-02-24T12:00:00.000Z").valueOf(), 30_000),
		).toBe(false);
	});

	it("validateTimestamp returns true for timestamp within skew window", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-24T12:00:25.000Z"));

		expect(
			validateTimestamp(new Date("2026-02-24T12:00:00.000Z").valueOf(), 30_000),
		).toBe(true);
	});
});
