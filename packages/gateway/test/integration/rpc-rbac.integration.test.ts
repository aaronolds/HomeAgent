import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import {
	cleanupTestGateway,
	createConnectMessage,
	createTestGateway,
	type TestGatewayContext,
	waitForSocketMessage,
	waitForSocketOpen,
} from "../helpers/test-gateway.js";

type RpcErrorPayload = {
	code: number;
	message: string;
	retryable: boolean;
};

type RpcResponse = {
	version: string;
	id: string;
	result?: Record<string, unknown>;
	error?: RpcErrorPayload;
};

describe("RPC RBAC Integration", () => {
	let ctx: TestGatewayContext;

	beforeEach(async () => {
		ctx = await createTestGateway({
			additionalDevices: [
				{
					deviceId: "device-client-1",
					sharedSecret: "client-secret",
					approved: true,
					role: "client",
				},
				{
					deviceId: "device-admin-1",
					sharedSecret: "admin-secret",
					approved: true,
					role: "admin",
				},
			],
		});
	});

	afterEach(async () => {
		await cleanupTestGateway(ctx);
	});

	async function connectAs(
		deviceId: string,
		sharedSecret: string,
		role: string,
	): Promise<WebSocket> {
		const ws = new WebSocket(ctx.wsUrl);
		await waitForSocketOpen(ws);
		ws.send(
			JSON.stringify(createConnectMessage({ deviceId, sharedSecret, role })),
		);
		await waitForSocketMessage(ws); // consume connect_ok
		return ws;
	}

	function makeRpcRequest(
		method: string,
		params: Record<string, unknown> = {},
		idempotencyKey?: string,
	) {
		return {
			version: "1.0",
			id: randomUUID(),
			method,
			params,
			ts: Date.now(),
			...(idempotencyKey ? { idempotencyKey } : {}),
		};
	}

	it("denies client calling device.revoke with forbidden error", async () => {
		const ws = await connectAs("device-client-1", "client-secret", "client");
		const req = makeRpcRequest("device.revoke", { deviceId: "some-device" });
		ws.send(JSON.stringify(req));
		const response = await waitForSocketMessage<RpcResponse>(ws);
		expect(response.id).toBe(req.id);
		expect(response.error).toBeDefined();
		expect(response.error?.code).toBe(-32001);
		expect(response.error?.retryable).toBe(false);
		ws.close();
	});

	it("denies node calling message.send with forbidden error", async () => {
		const ws = await connectAs(
			ctx.testDevice.deviceId,
			ctx.testDevice.sharedSecret,
			"node",
		);
		const req = makeRpcRequest(
			"message.send",
			{ sessionId: "s1", content: "hi" },
			"idem1",
		);
		ws.send(JSON.stringify(req));
		const response = await waitForSocketMessage<RpcResponse>(ws);
		expect(response.error).toBeDefined();
		expect(response.error?.code).toBe(-32001);
		ws.close();
	});

	it("allows admin to call device.revoke", async () => {
		const ws = await connectAs("device-admin-1", "admin-secret", "admin");
		const req = makeRpcRequest("device.revoke", { deviceId: "some-device" });
		ws.send(JSON.stringify(req));
		const response = await waitForSocketMessage<RpcResponse>(ws);
		expect(response.result).toBeDefined();
		expect(response.result?.revoked).toBe(false);
		ws.close();
	});

	it("allows admin to call plugin.disable", async () => {
		const ws = await connectAs("device-admin-1", "admin-secret", "admin");
		const req = makeRpcRequest("plugin.disable", { pluginId: "plugin-1" });
		ws.send(JSON.stringify(req));
		const response = await waitForSocketMessage<RpcResponse>(ws);
		expect(response.result).toBeDefined();
		expect(response.result?.disabled).toBe(true);
		ws.close();
	});

	it("allows client to call status.get", async () => {
		const ws = await connectAs("device-client-1", "client-secret", "client");
		const req = makeRpcRequest("status.get", {});
		ws.send(JSON.stringify(req));
		const response = await waitForSocketMessage<RpcResponse>(ws);
		expect(response.result).toBeDefined();
		expect(response.result?.status).toBe("idle");
		ws.close();
	});

	it("denies node calling plugin.disable", async () => {
		const ws = await connectAs(
			ctx.testDevice.deviceId,
			ctx.testDevice.sharedSecret,
			"node",
		);
		const req = makeRpcRequest("plugin.disable", { pluginId: "p1" });
		ws.send(JSON.stringify(req));
		const response = await waitForSocketMessage<RpcResponse>(ws);
		expect(response.error).toBeDefined();
		expect(response.error?.code).toBe(-32001);
		ws.close();
	});
});
