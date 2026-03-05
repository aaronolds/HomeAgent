import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import {
	cleanupTestGateway,
	createTestGateway,
	type TestGatewayContext,
} from "../helpers/test-gateway.js";

describe("origin validation", () => {
	let ctx: TestGatewayContext;

	afterEach(async () => {
		if (ctx) {
			await cleanupTestGateway(ctx);
		}
	});

	it("rejects connection from disallowed origin", async () => {
		ctx = await createTestGateway({
			configOverrides: {
				network: {
					originAllowlist: ["http://allowed.example.com"],
					strictOrigin: true,
					strictCors: false,
				},
			},
		});

		const ws = new WebSocket(ctx.wsUrl, { origin: "http://evil.example.com" });

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				ws.terminate();
				reject(new Error("Timed out"));
			}, 3000);

			ws.on("unexpected-response", (_req, res) => {
				clearTimeout(timeout);
				expect(res.statusCode).toBe(403);
				ws.terminate();
				resolve();
			});

			ws.on("open", () => {
				clearTimeout(timeout);
				ws.terminate();
				reject(new Error("Connection should not have opened"));
			});

			ws.on("error", () => {
				// Expected - connection refused
			});
		});
	});

	it("allows connection from allowed origin", async () => {
		ctx = await createTestGateway({
			configOverrides: {
				network: {
					originAllowlist: ["http://allowed.example.com"],
					strictOrigin: true,
					strictCors: false,
				},
			},
		});

		const ws = new WebSocket(ctx.wsUrl, {
			origin: "http://allowed.example.com",
		});

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				ws.terminate();
				reject(new Error("Timed out"));
			}, 3000);

			ws.on("open", () => {
				clearTimeout(timeout);
				ws.close();
				resolve();
			});

			ws.on("unexpected-response", (_req, res) => {
				clearTimeout(timeout);
				ws.terminate();
				reject(new Error(`Expected open but got ${res.statusCode}`));
			});

			ws.on("error", () => {
				// may fire alongside unexpected-response
			});
		});
	});

	it("rejects connection with missing origin when strictOrigin=true", async () => {
		ctx = await createTestGateway({
			configOverrides: {
				network: {
					originAllowlist: [],
					strictOrigin: true,
					strictCors: false,
				},
			},
		});

		// ws client without origin option doesn't send Origin header
		const ws = new WebSocket(ctx.wsUrl);

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				ws.terminate();
				reject(new Error("Timed out"));
			}, 3000);

			ws.on("unexpected-response", (_req, res) => {
				clearTimeout(timeout);
				expect(res.statusCode).toBe(403);
				ws.terminate();
				resolve();
			});

			ws.on("open", () => {
				clearTimeout(timeout);
				ws.terminate();
				reject(new Error("Connection should not have opened"));
			});

			ws.on("error", () => {});
		});
	});

	it("allows connection with missing origin when strictOrigin=false and allowlist empty", async () => {
		ctx = await createTestGateway({
			configOverrides: {
				network: {
					originAllowlist: [],
					strictOrigin: false,
					strictCors: false,
				},
			},
		});

		const ws = new WebSocket(ctx.wsUrl);

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				ws.terminate();
				reject(new Error("Timed out"));
			}, 3000);

			ws.on("open", () => {
				clearTimeout(timeout);
				ws.close();
				resolve();
			});

			ws.on("unexpected-response", (_req, res) => {
				clearTimeout(timeout);
				ws.terminate();
				reject(new Error(`Expected open but got ${res.statusCode}`));
			});

			ws.on("error", () => {});
		});
	});
});
