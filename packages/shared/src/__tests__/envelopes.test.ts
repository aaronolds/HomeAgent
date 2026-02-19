import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "../protocol/constants.js";
import {
	EventEnvelopeSchema,
	RequestEnvelopeSchema,
	ResponseEnvelopeSchema,
} from "../protocol/envelopes.js";

describe("envelope schemas", () => {
	it("RequestEnvelopeSchema requires version field", () => {
		const input = {
			version: PROTOCOL_VERSION,
			id: "req-1",
			method: "session.resolve",
			params: { deviceId: "device-1" },
			ts: Date.now(),
		};

		expect(RequestEnvelopeSchema.safeParse(input).success).toBe(true);
	});

	it("RequestEnvelopeSchema rejects missing version", () => {
		const input = {
			id: "req-1",
			method: "session.resolve",
			params: { deviceId: "device-1" },
			ts: Date.now(),
		};

		expect(RequestEnvelopeSchema.safeParse(input).success).toBe(false);
	});

	it("RequestEnvelopeSchema rejects wrong version", () => {
		const input = {
			version: "2.0",
			id: "req-1",
			method: "session.resolve",
			params: { deviceId: "device-1" },
			ts: Date.now(),
		};

		expect(RequestEnvelopeSchema.safeParse(input).success).toBe(false);
	});

	it("RequestEnvelopeSchema requires valid method from RPC_METHODS", () => {
		const input = {
			version: PROTOCOL_VERSION,
			id: "req-1",
			method: "not.a.method",
			params: {},
			ts: Date.now(),
		};

		expect(RequestEnvelopeSchema.safeParse(input).success).toBe(false);
	});

	it("ResponseEnvelopeSchema requires version", () => {
		const valid = {
			version: PROTOCOL_VERSION,
			id: "req-1",
			result: { ok: true },
		};
		expect(ResponseEnvelopeSchema.safeParse(valid).success).toBe(true);

		const missingVersion = {
			id: "req-1",
			result: { ok: true },
		};
		expect(ResponseEnvelopeSchema.safeParse(missingVersion).success).toBe(
			false,
		);
	});

	it("EventEnvelopeSchema requires version", () => {
		const valid = {
			version: PROTOCOL_VERSION,
			event: "session.updated",
			data: { status: "running" },
			ts: Date.now(),
		};
		expect(EventEnvelopeSchema.safeParse(valid).success).toBe(true);

		const missingVersion = {
			event: "session.updated",
			data: { status: "running" },
			ts: Date.now(),
		};
		expect(EventEnvelopeSchema.safeParse(missingVersion).success).toBe(false);
	});

	it("all envelopes include version field in parsed output", () => {
		const parsedRequest = RequestEnvelopeSchema.parse({
			version: PROTOCOL_VERSION,
			id: "req-1",
			method: "status.get",
			params: {},
			ts: Date.now(),
		});
		expect(parsedRequest.version).toBe(PROTOCOL_VERSION);

		const parsedResponse = ResponseEnvelopeSchema.parse({
			version: PROTOCOL_VERSION,
			id: "req-1",
			result: { status: "ok" },
		});
		expect(parsedResponse.version).toBe(PROTOCOL_VERSION);

		const parsedEvent = EventEnvelopeSchema.parse({
			version: PROTOCOL_VERSION,
			event: "agent.completed",
			data: { runId: "run-1" },
			ts: Date.now(),
		});
		expect(parsedEvent.version).toBe(PROTOCOL_VERSION);
	});

	it("envelopes reject completely malformed input", () => {
		const malformed: unknown[] = ["bad", 123, null, undefined];

		for (const input of malformed) {
			expect(RequestEnvelopeSchema.safeParse(input).success).toBe(false);
			expect(ResponseEnvelopeSchema.safeParse(input).success).toBe(false);
			expect(EventEnvelopeSchema.safeParse(input).success).toBe(false);
		}
	});
});
