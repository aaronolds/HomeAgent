import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "../protocol/constants.js";
import { IdempotencyKeyError } from "../protocol/errors.js";
import {
	buildIdempotencyKey,
	requiresIdempotencyKey,
} from "../protocol/idempotency.js";
import { parseRequestEnvelope } from "../protocol/validate.js";

describe("idempotency", () => {
	it("requiresIdempotencyKey returns true for required methods", () => {
		expect(requiresIdempotencyKey("message.send")).toBe(true);
		expect(requiresIdempotencyKey("agent.run")).toBe(true);
		expect(requiresIdempotencyKey("node.exec.request")).toBe(true);
		expect(requiresIdempotencyKey("node.exec.approve")).toBe(true);
	});

	it("requiresIdempotencyKey returns false for non-required methods", () => {
		expect(requiresIdempotencyKey("session.resolve")).toBe(false);
		expect(requiresIdempotencyKey("agent.cancel")).toBe(false);
		expect(requiresIdempotencyKey("status.get")).toBe(false);
		expect(requiresIdempotencyKey("device.revoke")).toBe(false);
		expect(requiresIdempotencyKey("plugin.disable")).toBe(false);
	});

	it("buildIdempotencyKey constructs correct namespaced key", () => {
		const key = buildIdempotencyKey("device-1", "message.send", "abc123");
		expect(key).toBe("device-1:message.send:abc123");
	});

	it("parseRequestEnvelope throws IdempotencyKeyError when method requires key but none provided", () => {
		const input = {
			version: PROTOCOL_VERSION,
			id: "req-1",
			method: "message.send",
			params: { sessionId: "s1", content: "hello" },
			ts: Date.now(),
		};

		expect(() => parseRequestEnvelope(input)).toThrow(IdempotencyKeyError);
	});

	it("parseRequestEnvelope succeeds when idempotency key provided for required methods", () => {
		const input = {
			version: PROTOCOL_VERSION,
			id: "req-1",
			method: "agent.run",
			params: { sessionId: "s1", agentId: "a1" },
			idempotencyKey: "run-1",
			ts: Date.now(),
		} as const;

		const parsed = parseRequestEnvelope(input);
		expect(parsed.idempotencyKey).toBe("run-1");
		expect(parsed.method).toBe("agent.run");
	});

	it("parseRequestEnvelope succeeds when idempotency key not provided for non-required methods", () => {
		const input = {
			version: PROTOCOL_VERSION,
			id: "req-1",
			method: "status.get",
			params: {},
			ts: Date.now(),
		} as const;

		const parsed = parseRequestEnvelope(input);
		expect(parsed.method).toBe("status.get");
		expect(parsed.idempotencyKey).toBeUndefined();
	});
});
