import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import {
	cleanupTestGateway,
	createTestGateway,
	type TestGatewayContext,
} from "../helpers/test-gateway.js";

describe("rate limiting", () => {
	let ctx: TestGatewayContext;

	afterEach(async () => {
		if (ctx) {
			await cleanupTestGateway(ctx);
		}
	});

	it("rejects connection when per-IP rate limit exceeded", async () => {
		ctx = await createTestGateway({
			configOverrides: {
				rateLimits: {
					perIpConnectionsPerMinute: 2,
					perDeviceRpcPerMinute: 100,
					perDeviceAgentRunPerMinute: 100,
				},
				network: {
					originAllowlist: [],
					strictOrigin: false,
					strictCors: false,
				},
			},
		});

		// Open first two connections (within limit)
		const sockets: WebSocket[] = [];
		for (let i = 0; i < 2; i++) {
			const ws = new WebSocket(ctx.wsUrl);
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					ws.terminate();
					reject(new Error("Timed out waiting for open"));
				}, 3000);

				ws.on("open", () => {
					clearTimeout(timeout);
					sockets.push(ws);
					resolve();
				});

				ws.on("error", (err) => {
					clearTimeout(timeout);
					reject(err);
				});
			});
		}

		// Third connection should be rejected with 429
		const ws3 = new WebSocket(ctx.wsUrl);
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				ws3.terminate();
				reject(new Error("Timed out"));
			}, 3000);

			ws3.on("unexpected-response", (_req, res) => {
				clearTimeout(timeout);
				expect(res.statusCode).toBe(429);
				ws3.terminate();
				resolve();
			});

			ws3.on("open", () => {
				clearTimeout(timeout);
				ws3.terminate();
				reject(new Error("Connection should have been rate limited"));
			});

			ws3.on("error", () => {});
		});

		// Cleanup open sockets
		for (const ws of sockets) {
			ws.terminate();
		}
	});
});
