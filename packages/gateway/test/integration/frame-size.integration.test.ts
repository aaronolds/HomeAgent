import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import {
	cleanupTestGateway,
	closeSocket,
	createConnectMessage,
	createTestGateway,
	waitForSocketClose,
	waitForSocketMessage,
	waitForSocketOpen,
	type TestGatewayContext,
} from "../helpers/test-gateway.js";

describe("frame size limits", () => {
	let ctx: TestGatewayContext;

	afterEach(async () => {
		if (ctx) {
			await cleanupTestGateway(ctx);
		}
	});

	it("accepts messages within frame size limit", async () => {
		ctx = await createTestGateway({
			configOverrides: {
				frameLimits: { maxFrameBytes: 4096 },
				network: {
					originAllowlist: [],
					strictOrigin: false,
					strictCors: false,
				},
			},
		});

		const ws = new WebSocket(ctx.wsUrl);
		await waitForSocketOpen(ws);

		// Send a valid connect message (well under 4096 bytes)
		const connectMsg = createConnectMessage({
			deviceId: ctx.testDevice.deviceId,
			sharedSecret: ctx.testDevice.sharedSecret,
		});
		ws.send(JSON.stringify(connectMsg));

		// Should receive connectOk
		const response = await waitForSocketMessage<{
			connectionId?: string;
			approved?: boolean;
		}>(ws);
		expect(response.connectionId).toBeDefined();
		expect(response.approved).toBe(true);

		await closeSocket(ws);
	});

	it("disconnects on oversized message", async () => {
		ctx = await createTestGateway({
			configOverrides: {
				frameLimits: { maxFrameBytes: 256 },
				network: {
					originAllowlist: [],
					strictOrigin: false,
					strictCors: false,
				},
			},
		});

		const ws = new WebSocket(ctx.wsUrl);
		await waitForSocketOpen(ws);

		// Send an oversized message (>256 bytes)
		const oversizedPayload = "x".repeat(512);
		ws.send(oversizedPayload);

		// ws should close the connection
		const closeEvent = await waitForSocketClose(ws);
		expect(closeEvent.code).toBe(1009);
	});
});
