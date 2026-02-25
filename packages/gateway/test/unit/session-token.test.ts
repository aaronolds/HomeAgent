import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "../../src/auth/errors.js";
import {
	issueSessionToken,
	refreshSessionToken,
	verifySessionToken,
} from "../../src/auth/session-token.js";

describe("session-token", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("issueSessionToken returns a string token", () => {
		const token = issueSessionToken({
			deviceId: "device-1",
			connectionId: "conn-1",
			role: "node",
			jwtSecret: "super-secret",
			ttlMs: 10_000,
		});

		expect(typeof token).toBe("string");
		expect(token.length).toBeGreaterThan(0);
	});

	it("verifySessionToken decodes a freshly issued token", () => {
		const token = issueSessionToken({
			deviceId: "device-1",
			connectionId: "conn-1",
			role: "node",
			jwtSecret: "super-secret",
			ttlMs: 10_000,
		});

		const payload = verifySessionToken(token, "super-secret");
		expect(payload.deviceId).toBe("device-1");
		expect(payload.connectionId).toBe("conn-1");
	});

	it("verifySessionToken returns expected payload fields", () => {
		const token = issueSessionToken({
			deviceId: "device-9",
			connectionId: "conn-9",
			role: "operator",
			jwtSecret: "super-secret",
			ttlMs: 10_000,
		});

		const payload = verifySessionToken(token, "super-secret");
		expect(payload).toMatchObject({
			deviceId: "device-9",
			connectionId: "conn-9",
			role: "operator",
		});
		expect(payload.iat).toBeTypeOf("number");
		expect(payload.exp).toBeTypeOf("number");
	});

	it("verifySessionToken throws AuthError INVALID_TOKEN for garbage token", () => {
		expect(() => verifySessionToken("not-a-jwt", "super-secret")).toThrowError(
			AuthError,
		);
		expect(() => verifySessionToken("not-a-jwt", "super-secret")).toThrowError(
			expect.objectContaining({ code: "INVALID_TOKEN" }),
		);
	});

	it("verifySessionToken throws AuthError EXPIRED_TOKEN for expired token", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-24T12:00:00.000Z"));

		const token = issueSessionToken({
			deviceId: "device-1",
			connectionId: "conn-1",
			role: "device",
			jwtSecret: "super-secret",
			ttlMs: 1_000,
		});

		vi.setSystemTime(new Date("2026-02-24T12:00:02.000Z"));

		expect(() => verifySessionToken(token, "super-secret")).toThrowError(
			expect.objectContaining({ code: "EXPIRED_TOKEN" }),
		);
	});

	it("refreshSessionToken returns a new valid token with same deviceId and connectionId", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-24T12:00:00.000Z"));

		const token = issueSessionToken({
			deviceId: "device-1",
			connectionId: "conn-1",
			role: "device",
			jwtSecret: "super-secret",
			ttlMs: 60_000,
		});

		vi.setSystemTime(new Date("2026-02-24T12:00:01.000Z"));
		const refreshed = refreshSessionToken(token, "super-secret", 60_000);
		const payload = verifySessionToken(refreshed, "super-secret");

		expect(refreshed).not.toBe(token);
		expect(payload.deviceId).toBe("device-1");
		expect(payload.connectionId).toBe("conn-1");
		expect(payload.role).toBe("device");
	});

	it("issueSessionToken uses default role device", () => {
		const token = issueSessionToken({
			deviceId: "device-default-role",
			connectionId: "conn-default-role",
			jwtSecret: "super-secret",
			ttlMs: 10_000,
		});

		const payload = verifySessionToken(token, "super-secret");
		expect(payload.role).toBe("device");
	});
});
