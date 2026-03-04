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

describe("RPC Idempotency Integration", () => {
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

	it("rejects side-effecting method without idempotency key", async () => {
		const ws = await connectAs("device-client-1", "client-secret", "client");
		const req = makeRpcRequest("message.send", {
			sessionId: "s1",
			content: "hello",
		});
		ws.send(JSON.stringify(req));
		const response = await waitForSocketMessage<RpcResponse>(ws);
		expect(response.error).toBeDefined();
		expect(response.error?.code).toBe(-32002);
		ws.close();
	});

	it("returns consistent result for duplicate idempotent call", async () => {
		const ws = await connectAs("device-client-1", "client-secret", "client");
		const idempotencyKey = randomUUID();
		const params = { sessionId: "s1", content: "hello" };

		const req1 = makeRpcRequest("message.send", params, idempotencyKey);
		ws.send(JSON.stringify(req1));
		const response1 = await waitForSocketMessage<RpcResponse>(ws);
		expect(response1.result).toBeDefined();
		expect(response1.result?.messageId).toBeDefined();

		const req2 = makeRpcRequest("message.send", params, idempotencyKey);
		ws.send(JSON.stringify(req2));
		const response2 = await waitForSocketMessage<RpcResponse>(ws);
		expect(response2.result).toBeDefined();
		expect(response2.result?.messageId).toBe(response1.result?.messageId);
		ws.close();
	});

	it("allows non-side-effecting method without idempotency key", async () => {
		const ws = await connectAs("device-client-1", "client-secret", "client");
		const req = makeRpcRequest("status.get", {});
		ws.send(JSON.stringify(req));
		const response = await waitForSocketMessage<RpcResponse>(ws);
		expect(response.result).toBeDefined();
		expect(response.result?.status).toBe("idle");
		ws.close();
	});

	it("different idempotency keys produce different results", async () => {
		const ws = await connectAs("device-client-1", "client-secret", "client");
		const params = { sessionId: "s1", content: "hello" };

		const req1 = makeRpcRequest("message.send", params, "key-a");
		ws.send(JSON.stringify(req1));
		const response1 = await waitForSocketMessage<RpcResponse>(ws);

		const req2 = makeRpcRequest("message.send", params, "key-b");
		ws.send(JSON.stringify(req2));
		const response2 = await waitForSocketMessage<RpcResponse>(ws);

		expect(response1.result?.messageId).not.toBe(response2.result?.messageId);
		ws.close();
	});
});
