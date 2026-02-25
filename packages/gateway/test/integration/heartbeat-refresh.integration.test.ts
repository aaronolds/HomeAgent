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

describe("gateway websocket heartbeat refresh", () => {
	it("acknowledges valid heartbeat and returns refreshed token", async () => {
		const ctx = await createTestGateway();
		const socket = createClient(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);
			const connectOkPromise =
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

			const connectOk = await connectOkPromise;
			const initialToken = connectOk.sessionToken;
			expect(typeof initialToken).toBe("string");
			await new Promise((resolve) => setTimeout(resolve, 25));

			const heartbeatAckPromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send(
				JSON.stringify({
					type: "heartbeat",
					sessionToken: initialToken,
				}),
			);

			const heartbeatAck = await heartbeatAckPromise;
			expect(heartbeatAck.type).toBe("heartbeat_ack");
			expect(typeof heartbeatAck.sessionToken).toBe("string");
		} finally {
			await closeSocket(socket);
			await cleanupTestGateway(ctx);
		}
	});

	it("rejects heartbeat with invalid token", async () => {
		const ctx = await createTestGateway();
		const socket = createClient(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);
			const connectOkPromise =
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

			await connectOkPromise;
			await new Promise((resolve) => setTimeout(resolve, 25));

			const errorPromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send(
				JSON.stringify({
					type: "heartbeat",
					sessionToken: "garbage-token",
				}),
			);

			const error = await errorPromise;
			expect(error.code).toBe(4006);
			expect(error.message).toBe("Session token is invalid.");
			expect(error.retryable).toBe(false);

			const close = await waitForSocketClose(socket);
			expect(close.code).toBe(1008);
			expect(close.reason).toBe("INVALID_TOKEN");
		} finally {
			await cleanupTestGateway(ctx);
		}
	});

	it("accepts refreshed token in subsequent heartbeat", async () => {
		const ctx = await createTestGateway();
		const socket = createClient(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);
			const connectOkPromise =
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

			const connectOk = await connectOkPromise;
			const firstToken = connectOk.sessionToken;
			expect(typeof firstToken).toBe("string");
			await new Promise((resolve) => setTimeout(resolve, 25));

			const firstAckPromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send(
				JSON.stringify({
					type: "heartbeat",
					sessionToken: firstToken,
				}),
			);
			const firstAck = await firstAckPromise;
			const secondToken = firstAck.sessionToken;
			expect(firstAck.type).toBe("heartbeat_ack");
			expect(typeof secondToken).toBe("string");

			const secondAckPromise =
				waitForSocketMessage<Record<string, unknown>>(socket);
			socket.send(
				JSON.stringify({
					type: "heartbeat",
					sessionToken: secondToken,
				}),
			);
			const secondAck = await secondAckPromise;
			expect(secondAck.type).toBe("heartbeat_ack");
			expect(typeof secondAck.sessionToken).toBe("string");
		} finally {
			await closeSocket(socket);
			await cleanupTestGateway(ctx);
		}
	});
});
