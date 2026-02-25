import { describe, expect, it } from "vitest";
import type {
	Connect,
	ConnectOk,
	HeartbeatAck,
	HeartbeatRequest,
	ProtocolError,
} from "../protocol/handshake.js";
import {
	ConnectOkSchema,
	ConnectSchema,
	HeartbeatAckSchema,
	HeartbeatRequestSchema,
	ProtocolErrorSchema,
} from "../protocol/handshake.js";

describe("handshake schemas", () => {
	it("ConnectSchema accepts valid connect payloads with all required fields", () => {
		const input = {
			role: "client",
			deviceId: "device-123",
			authToken: "token-abc",
			nonce: "nonce-xyz",
			timestamp: Date.now(),
			signature: "hmac-signature",
		};

		const parsed: Connect = ConnectSchema.parse(input);
		expect(parsed).toEqual(input);
	});

	it("ConnectSchema rejects missing required fields", () => {
		const base = {
			role: "client",
			deviceId: "device-123",
			authToken: "token-abc",
			nonce: "nonce-xyz",
			timestamp: Date.now(),
			signature: "hmac-signature",
		};

		const missingRole = { ...base } as Omit<typeof base, "role">;
		delete (missingRole as { role?: string }).role;
		expect(ConnectSchema.safeParse(missingRole).success).toBe(false);

		const missingDeviceId = { ...base } as Omit<typeof base, "deviceId">;
		delete (missingDeviceId as { deviceId?: string }).deviceId;
		expect(ConnectSchema.safeParse(missingDeviceId).success).toBe(false);

		const missingNonce = { ...base } as Omit<typeof base, "nonce">;
		delete (missingNonce as { nonce?: string }).nonce;
		expect(ConnectSchema.safeParse(missingNonce).success).toBe(false);

		const missingTimestamp = { ...base } as Omit<typeof base, "timestamp">;
		delete (missingTimestamp as { timestamp?: number }).timestamp;
		expect(ConnectSchema.safeParse(missingTimestamp).success).toBe(false);

		const missingSignature = { ...base } as Omit<typeof base, "signature">;
		delete (missingSignature as { signature?: string }).signature;
		expect(ConnectSchema.safeParse(missingSignature).success).toBe(false);
	});

	it("ConnectSchema accepts optional fields", () => {
		const input = {
			role: "node",
			deviceId: "device-123",
			authToken: "token-abc",
			nonce: "nonce-xyz",
			timestamp: Date.now(),
			signature: "hmac-signature",
			agentId: "agent-001",
			capabilities: ["exec", "stream"],
		};

		const parsed = ConnectSchema.parse(input);
		expect(parsed.agentId).toBe("agent-001");
		expect(parsed.capabilities).toEqual(["exec", "stream"]);

		const withoutAuthToken = {
			role: "node",
			deviceId: "device-123",
			nonce: "nonce-xyz",
			timestamp: Date.now(),
			signature: "hmac-signature",
		};
		expect(ConnectSchema.safeParse(withoutAuthToken).success).toBe(true);
	});

	it("ConnectOkSchema accepts valid payloads", () => {
		const input = {
			connectionId: "conn-1",
			approved: true,
			serverVersion: "1.2.3",
			heartbeatSec: 30,
			sessionToken: "session-token",
		};

		const parsed: ConnectOk = ConnectOkSchema.parse(input);
		expect(parsed).toEqual(input);
	});

	it("ConnectOkSchema rejects missing and invalid fields", () => {
		const missingField = {
			connectionId: "conn-1",
			approved: true,
			serverVersion: "1.2.3",
			sessionToken: "session-token",
		};
		expect(ConnectOkSchema.safeParse(missingField).success).toBe(false);

		const invalidField = {
			connectionId: "conn-1",
			approved: true,
			serverVersion: "1.2.3",
			heartbeatSec: 0,
			sessionToken: "session-token",
		};
		expect(ConnectOkSchema.safeParse(invalidField).success).toBe(false);
	});

	it("ProtocolErrorSchema accepts valid error payloads", () => {
		const input = {
			code: 4001,
			message: "Invalid token",
			retryable: false,
		};

		const parsed: ProtocolError = ProtocolErrorSchema.parse(input);
		expect(parsed).toEqual(input);
	});

	it("ProtocolErrorSchema rejects missing fields", () => {
		const missingMessage = {
			code: 4001,
			retryable: false,
		};

		expect(ProtocolErrorSchema.safeParse(missingMessage).success).toBe(false);
	});

	it("HeartbeatRequestSchema accepts valid payloads", () => {
		const input = {
			type: "heartbeat",
			sessionToken: "session-token",
		};

		const parsed: HeartbeatRequest = HeartbeatRequestSchema.parse(input);
		expect(parsed).toEqual(input);
	});

	it("HeartbeatAckSchema accepts valid payloads", () => {
		const input = {
			type: "heartbeat_ack",
			sessionToken: "session-token-refreshed",
		};

		const parsed: HeartbeatAck = HeartbeatAckSchema.parse(input);
		expect(parsed).toEqual(input);
	});

	it("Heartbeat schemas reject invalid payloads", () => {
		const invalidRequestType = {
			type: "heartbeat_ack",
			sessionToken: "session-token",
		};
		expect(HeartbeatRequestSchema.safeParse(invalidRequestType).success).toBe(
			false,
		);

		const missingRequestToken = {
			type: "heartbeat",
		};
		expect(HeartbeatRequestSchema.safeParse(missingRequestToken).success).toBe(
			false,
		);

		const invalidAckType = {
			type: "heartbeat",
			sessionToken: "session-token",
		};
		expect(HeartbeatAckSchema.safeParse(invalidAckType).success).toBe(false);

		const missingAckToken = {
			type: "heartbeat_ack",
		};
		expect(HeartbeatAckSchema.safeParse(missingAckToken).success).toBe(false);
	});
});
