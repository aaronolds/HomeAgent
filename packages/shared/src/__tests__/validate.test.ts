import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "../protocol/constants.js";
import { ProtocolValidationError } from "../protocol/errors.js";
import { ConnectSchema } from "../protocol/handshake.js";
import {
	parseRequestEnvelope,
	safeParseRequestEnvelope,
	validateSchema,
} from "../protocol/validate.js";

describe("validate helpers", () => {
	it("parseRequestEnvelope returns valid data on correct input", () => {
		const input = {
			version: PROTOCOL_VERSION,
			id: "req-1",
			method: "session.resolve",
			params: { deviceId: "device-1" },
			ts: Date.now(),
		};

		const parsed = parseRequestEnvelope(input);
		expect(parsed).toEqual(input);
	});

	it("parseRequestEnvelope throws ProtocolValidationError on malformed input", () => {
		const input = {
			version: PROTOCOL_VERSION,
			method: "session.resolve",
			params: { deviceId: "device-1" },
			ts: Date.now(),
		};

		expect(() => parseRequestEnvelope(input)).toThrow(ProtocolValidationError);
	});

	it("ProtocolValidationError has issues array with path and message", () => {
		try {
			parseRequestEnvelope({
				version: PROTOCOL_VERSION,
				method: "session.resolve",
				params: { deviceId: "device-1" },
				ts: Date.now(),
			});
			expect.unreachable("Expected parseRequestEnvelope to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(ProtocolValidationError);
			const protocolError = error as ProtocolValidationError;
			expect(protocolError.issues.length).toBeGreaterThan(0);
			expect(protocolError.issues[0]).toHaveProperty("path");
			expect(protocolError.issues[0]).toHaveProperty("message");
		}
	});

	it("safeParseRequestEnvelope returns success true with data on valid input", () => {
		const input = {
			version: PROTOCOL_VERSION,
			id: "req-1",
			method: "status.get",
			params: {},
			ts: Date.now(),
		};

		const result = safeParseRequestEnvelope(input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe("req-1");
		}
	});

	it("safeParseRequestEnvelope returns success false with error on malformed input", () => {
		const result = safeParseRequestEnvelope("bad payload");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBeInstanceOf(ProtocolValidationError);
		}
	});

	it("validateSchema works with handshake schemas", () => {
		const parsed = validateSchema(
			ConnectSchema,
			{
				role: "client",
				deviceId: "device-1",
				authToken: "token",
				nonce: "nonce",
			},
			"connect",
		);

		expect(parsed.role).toBe("client");
	});

	it("validateSchema throws ProtocolValidationError on bad data", () => {
		expect(() =>
			validateSchema(
				ConnectSchema,
				{
					role: "client",
					deviceId: "device-1",
					nonce: "nonce",
				},
				"connect",
			),
		).toThrow(ProtocolValidationError);
	});
});
