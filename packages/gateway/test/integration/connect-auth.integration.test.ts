import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";
import WebSocket from "ws";

import {
	cleanupTestGateway,
	closeSocket,
	createConnectMessage,
	createTestGateway,
	waitForSocketClose,
	waitForSocketMessage,
	waitForSocketOpen,
} from "../helpers/test-gateway.js";

function createClient(url: string): WebSocket {
	return new WebSocket(url);
}

describe("gateway websocket connect auth", () => {
	it("accepts a valid connect payload", async () => {
		const ctx = await createTestGateway();
		const socket = createClient(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);

			const messagePromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send(
				JSON.stringify(
					createConnectMessage({
						deviceId: ctx.testDevice.deviceId,
						sharedSecret: ctx.testDevice.sharedSecret,
						role: ctx.testDevice.role,
						authToken: ctx.testDevice.authToken,
					}),
				),
			);

			const message = await messagePromise;
			expect(message.approved).toBe(true);
			expect(typeof message.connectionId).toBe("string");
			expect(typeof message.serverVersion).toBe("string");
			expect(message.heartbeatSec).toBe(30);
			expect(typeof message.sessionToken).toBe("string");
		} finally {
			await closeSocket(socket);
			await cleanupTestGateway(ctx);
		}
	});

	it("rejects connect with invalid hmac signature", async () => {
		const ctx = await createTestGateway();
		const socket = createClient(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);

			const errorPromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send(
				JSON.stringify(
					createConnectMessage({
						deviceId: ctx.testDevice.deviceId,
						sharedSecret: ctx.testDevice.sharedSecret,
						signature: "00",
						role: ctx.testDevice.role,
						authToken: ctx.testDevice.authToken,
					}),
				),
			);

			const error = await errorPromise;
			expect(error.code).toBe(4001);
			expect(error.message).toBe("Connect signature is invalid.");
			expect(error.retryable).toBe(false);

			const close = await waitForSocketClose(socket);
			expect(close.code).toBe(1008);
			expect(close.reason).toBe("INVALID_HMAC");
		} finally {
			await cleanupTestGateway(ctx);
		}
	});

	it("rejects connect with stale timestamp", async () => {
		const ctx = await createTestGateway();
		const socket = createClient(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);

			const errorPromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send(
				JSON.stringify(
					createConnectMessage({
						deviceId: ctx.testDevice.deviceId,
						sharedSecret: ctx.testDevice.sharedSecret,
						timestamp: Date.now() - (ctx.config.timestampSkewMs + 10_000),
						role: ctx.testDevice.role,
						authToken: ctx.testDevice.authToken,
					}),
				),
			);

			const error = await errorPromise;
			expect(error.code).toBe(4002);
			expect(error.message).toBe("Connect timestamp is outside allowed skew.");
			expect(error.retryable).toBe(true);

			const close = await waitForSocketClose(socket);
			expect(close.code).toBe(1008);
			expect(close.reason).toBe("STALE_TIMESTAMP");
		} finally {
			await cleanupTestGateway(ctx);
		}
	});

	it("rejects replayed nonce for second connect", async () => {
		const ctx = await createTestGateway();
		const nonce = randomUUID();
		const timestamp = Date.now();
		const firstSocket = createClient(ctx.wsUrl);
		let secondSocket: WebSocket | null = null;

		try {
			await waitForSocketOpen(firstSocket);

			const firstConnectPayload = createConnectMessage({
				deviceId: ctx.testDevice.deviceId,
				sharedSecret: ctx.testDevice.sharedSecret,
				nonce,
				timestamp,
				role: ctx.testDevice.role,
				authToken: ctx.testDevice.authToken,
			});

			const firstResponsePromise =
				waitForSocketMessage<Record<string, unknown>>(firstSocket);
			firstSocket.send(JSON.stringify(firstConnectPayload));
			const connectOk = await firstResponsePromise;
			expect(typeof connectOk.sessionToken).toBe("string");

			secondSocket = createClient(ctx.wsUrl);
			await waitForSocketOpen(secondSocket);
			const errorPromise =
				waitForSocketMessage<Record<string, unknown>>(secondSocket);
			secondSocket.send(JSON.stringify(firstConnectPayload));

			const error = await errorPromise;
			expect(error.code).toBe(4003);
			expect(error.message).toBe(
				"Nonce was already used in the active window.",
			);
			expect(error.retryable).toBe(false);

			const close = await waitForSocketClose(secondSocket);
			expect(close.code).toBe(1008);
			expect(close.reason).toBe("REPLAYED_NONCE");
		} finally {
			if (secondSocket !== null) {
				await closeSocket(secondSocket);
			}
			await closeSocket(firstSocket);
			await cleanupTestGateway(ctx);
		}
	});

	it("rejects unapproved device", async () => {
		const ctx = await createTestGateway({ approvedDevice: false });
		const socket = createClient(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);

			const errorPromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send(
				JSON.stringify(
					createConnectMessage({
						deviceId: ctx.testDevice.deviceId,
						sharedSecret: ctx.testDevice.sharedSecret,
						role: ctx.testDevice.role,
						authToken: ctx.testDevice.authToken,
					}),
				),
			);

			const error = await errorPromise;
			expect(error.code).toBe(4004);
			expect(error.message).toBe("Device is not approved.");
			expect(error.retryable).toBe(false);

			const close = await waitForSocketClose(socket);
			expect(close.code).toBe(1008);
			expect(close.reason).toBe("UNAPPROVED_DEVICE");
		} finally {
			await cleanupTestGateway(ctx);
		}
	});

	it("rejects revoked device", async () => {
		const ctx = await createTestGateway();
		ctx.operationalStore.revokeDevice(ctx.testDevice.deviceId);
		const socket = createClient(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);

			const errorPromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send(
				JSON.stringify(
					createConnectMessage({
						deviceId: ctx.testDevice.deviceId,
						sharedSecret: ctx.testDevice.sharedSecret,
						role: ctx.testDevice.role,
						authToken: ctx.testDevice.authToken,
					}),
				),
			);

			const error = await errorPromise;
			expect(error.code).toBe(4008);
			expect(error.message).toBe("Device has been revoked.");
			expect(error.retryable).toBe(false);

			const close = await waitForSocketClose(socket);
			expect(close.code).toBe(1008);
			expect(close.reason).toBe("REVOKED_DEVICE");
		} finally {
			await cleanupTestGateway(ctx);
		}
	});

	it("rejects unknown device", async () => {
		const ctx = await createTestGateway();
		const socket = createClient(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);

			const errorPromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send(
				JSON.stringify(
					createConnectMessage({
						deviceId: "device-unknown",
						sharedSecret: "unknown-secret",
						role: "node",
						authToken: "unknown-auth-token",
					}),
				),
			);

			const error = await errorPromise;
			expect(error.code).toBe(4005);
			expect(error.message).toBe("Device is not registered.");
			expect(error.retryable).toBe(false);

			const close = await waitForSocketClose(socket);
			expect(close.code).toBe(1008);
			expect(close.reason).toBe("UNKNOWN_DEVICE");
		} finally {
			await cleanupTestGateway(ctx);
		}
	});

	it("rejects malformed first message", async () => {
		const ctx = await createTestGateway();
		const socket = createClient(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);
			const errorPromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send("not-json");

			const error = await errorPromise;
			expect(error.code).toBe(4000);
			expect(error.message).toBe("Expected connect payload as first message.");
			expect(error.retryable).toBe(true);

			const close = await waitForSocketClose(socket);
			expect(close.code).toBe(1008);
			expect(close.reason).toBe("Expected connect payload");
		} finally {
			await cleanupTestGateway(ctx);
		}
	});
});
