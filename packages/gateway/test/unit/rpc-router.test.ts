import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROTOCOL_VERSION } from "@homeagent/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/audit/audit-log.js";
import { SqliteIdempotencyStore } from "../../src/idempotency/sqlite-idempotency-store.js";
import { RPC_ERROR_CODES } from "../../src/rpc/errors.js";
import { registerV1Handlers } from "../../src/rpc/method-handlers.js";
import { MethodRegistry } from "../../src/rpc/method-registry.js";
import { RpcRouter } from "../../src/rpc/router.js";
import type { RpcContext } from "../../src/rpc/types.js";
import { ConnectionManager } from "../../src/server/connection-context.js";
import { DeviceRegistry } from "../../src/state/device-registry.js";

function makeRequest(
	method: string,
	params: Record<string, unknown> = {},
	idempotencyKey?: string,
) {
	return {
		version: PROTOCOL_VERSION,
		id: randomUUID(),
		method,
		params,
		ts: Date.now(),
		...(idempotencyKey ? { idempotencyKey } : {}),
	};
}

const clientContext: RpcContext = {
	connectionId: "conn-1",
	deviceId: "device-1",
	role: "client",
	sessionToken: "token-1",
};

const adminContext: RpcContext = {
	connectionId: "conn-admin",
	deviceId: "device-admin",
	role: "admin",
	sessionToken: "token-admin",
};

const nodeContext: RpcContext = {
	connectionId: "conn-node",
	deviceId: "device-node",
	role: "node",
	sessionToken: "token-node",
};

describe("RpcRouter", () => {
	let router: RpcRouter;
	let store: SqliteIdempotencyStore;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), "router-test-"));
		store = new SqliteIdempotencyStore({
			dbPath: join(tempDir, "test.db"),
			ttlMs: 86_400_000,
			cleanupIntervalMs: 3_600_000,
		});
		const registry = new MethodRegistry();
		const dataDir = tempDir;
		const deviceRegistry = new DeviceRegistry(dataDir);
		await deviceRegistry.load();
		const connectionManager = new ConnectionManager();
		const auditLog = new AuditLog(dataDir);
		registerV1Handlers(registry, {
			deviceRegistry,
			connectionManager,
			auditLog,
		});
		router = new RpcRouter(registry, store);
	});

	afterEach(() => {
		store.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("validation", () => {
		it("rejects malformed envelope", async () => {
			const result = await router.handle({ garbage: true }, clientContext);
			expect(result.error).toBeDefined();
			expect(result.error?.code).toBe(RPC_ERROR_CODES.PARSE_ERROR);
		});

		it("rejects unknown method", async () => {
			const result = await router.handle(
				makeRequest("unknown.method"),
				clientContext,
			);
			expect(result.error).toBeDefined();
		});
	});

	describe("RBAC enforcement", () => {
		it("denies client calling device.revoke", async () => {
			const result = await router.handle(
				makeRequest("device.revoke", { deviceId: "d1" }),
				clientContext,
			);
			expect(result.error).toBeDefined();
			expect(result.error?.code).toBe(RPC_ERROR_CODES.FORBIDDEN);
		});

		it("denies node calling message.send", async () => {
			const result = await router.handle(
				makeRequest(
					"message.send",
					{ sessionId: "s1", content: "hello" },
					"key1",
				),
				nodeContext,
			);
			expect(result.error).toBeDefined();
			expect(result.error?.code).toBe(RPC_ERROR_CODES.FORBIDDEN);
		});

		it("allows admin to call device.revoke", async () => {
			const result = await router.handle(
				makeRequest("device.revoke", { deviceId: "some-device" }),
				adminContext,
			);
			expect(result.result).toBeDefined();
			expect(result.result?.revoked).toBe(true);
		});

		it("allows client to call status.get", async () => {
			const result = await router.handle(
				makeRequest("status.get", {}),
				clientContext,
			);
			expect(result.result).toBeDefined();
			expect(result.result?.status).toBe("idle");
		});
	});

	describe("idempotency", () => {
		it("rejects side-effecting method without idempotency key", async () => {
			const result = await router.handle(
				makeRequest("message.send", { sessionId: "s1", content: "hello" }),
				clientContext,
			);
			expect(result.error).toBeDefined();
			expect(result.error?.code).toBe(RPC_ERROR_CODES.MISSING_IDEMPOTENCY_KEY);
		});

		it("returns consistent result for duplicate idempotent call", async () => {
			const key = "idem-key-1";
			const params = { sessionId: "s1", content: "hello" };
			const first = await router.handle(
				makeRequest("message.send", params, key),
				clientContext,
			);
			expect(first.result).toBeDefined();
			expect(first.result?.messageId).toBeDefined();

			const second = await router.handle(
				makeRequest("message.send", params, key),
				clientContext,
			);
			expect(second.result).toBeDefined();
			expect(second.result?.messageId).toBe(first.result?.messageId);
		});

		it("allows non-side-effecting method without idempotency key", async () => {
			const result = await router.handle(
				makeRequest("status.get", {}),
				clientContext,
			);
			expect(result.error).toBeUndefined();
			expect(result.result).toBeDefined();
		});
	});

	describe("successful dispatch", () => {
		it("dispatches session.resolve", async () => {
			const result = await router.handle(
				makeRequest("session.resolve", { deviceId: "d1" }),
				clientContext,
			);
			expect(result.version).toBe(PROTOCOL_VERSION);
			expect(result.result).toBeDefined();
			expect(result.result?.sessionId).toBeDefined();
		});

		it("dispatches agent.run with idempotency key", async () => {
			const result = await router.handle(
				makeRequest("agent.run", { sessionId: "s1", agentId: "a1" }, "run-key"),
				clientContext,
			);
			expect(result.result).toBeDefined();
			expect(result.result?.runId).toBeDefined();
			expect(result.result?.status).toBe("queued");
		});
	});
});
