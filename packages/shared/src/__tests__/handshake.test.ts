import { describe, expect, it } from "vitest";
import type {
	Connect,
	ConnectOk,
	ProtocolError,
} from "../protocol/handshake.js";
import {
	ConnectOkSchema,
	ConnectSchema,
	ProtocolErrorSchema,
} from "../protocol/handshake.js";

describe("handshake schemas", () => {
	it("ConnectSchema accepts valid connect payloads with all required fields", () => {
		const input = {
			role: "client",
			deviceId: "device-123",
			authToken: "token-abc",
			nonce: "nonce-xyz",
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
		};

		const missingRole = { ...base } as Omit<typeof base, "role">;
		delete (missingRole as { role?: string }).role;
		expect(ConnectSchema.safeParse(missingRole).success).toBe(false);

		const missingDeviceId = { ...base } as Omit<typeof base, "deviceId">;
		delete (missingDeviceId as { deviceId?: string }).deviceId;
		expect(ConnectSchema.safeParse(missingDeviceId).success).toBe(false);

		const missingAuthToken = { ...base } as Omit<typeof base, "authToken">;
		delete (missingAuthToken as { authToken?: string }).authToken;
		expect(ConnectSchema.safeParse(missingAuthToken).success).toBe(false);

		const missingNonce = { ...base } as Omit<typeof base, "nonce">;
		delete (missingNonce as { nonce?: string }).nonce;
		expect(ConnectSchema.safeParse(missingNonce).success).toBe(false);
	});

	it("ConnectSchema accepts optional fields", () => {
		const input = {
			role: "node",
			deviceId: "device-123",
			authToken: "token-abc",
			nonce: "nonce-xyz",
			agentId: "agent-001",
			capabilities: ["exec", "stream"],
		};

		const parsed = ConnectSchema.parse(input);
		expect(parsed.agentId).toBe("agent-001");
		expect(parsed.capabilities).toEqual(["exec", "stream"]);
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
});
