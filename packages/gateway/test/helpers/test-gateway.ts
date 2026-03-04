import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Role } from "@homeagent/shared";
import type { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { AuditLog } from "../../src/audit/audit-log.js";
import { computeHmac } from "../../src/auth/hmac-auth.js";
import type { GatewayConfig } from "../../src/config/gateway-config.js";
import { SqliteIdempotencyStore } from "../../src/idempotency/sqlite-idempotency-store.js";
import { registerV1Handlers } from "../../src/rpc/method-handlers.js";
import { MethodRegistry } from "../../src/rpc/method-registry.js";
import { RpcRouter } from "../../src/rpc/router.js";
import { ConnectionManager } from "../../src/server/connection-context.js";
import { createGatewayServer } from "../../src/server/create-gateway-server.js";
import { DeviceRegistry } from "../../src/state/device-registry.js";
import { NonceStore } from "../../src/state/nonce-store.js";

export interface TestDeviceInfo {
	deviceId: string;
	sharedSecret: string;
	role: string;
	authToken: string;
}

export interface TestGatewayContext {
	server: FastifyInstance;
	config: GatewayConfig;
	deviceRegistry: DeviceRegistry;
	nonceStore: NonceStore;
	auditLog: AuditLog;
	connectionManager: ConnectionManager;
	rpcRouter: RpcRouter;
	idempotencyStore: SqliteIdempotencyStore;
	dataDir: string;
	address: string;
	wsUrl: string;
	testDevice: TestDeviceInfo;
}

export interface CreateTestGatewayOptions {
	approvedDevice?: boolean;
	configOverrides?: Partial<GatewayConfig>;
	additionalDevices?: Array<{
		deviceId: string;
		sharedSecret: string;
		approved: boolean;
		role?: string;
	}>;
}

const DEFAULT_TEST_DEVICE: TestDeviceInfo = {
	deviceId: "device-test-1",
	sharedSecret: "test-shared-secret-1",
	role: "node",
	authToken: "auth-token-test-1",
};

function toWebSocketUrl(address: string): string {
	if (address.startsWith("http://")) {
		const url = new URL(address);
		url.protocol = "ws:";
		url.pathname = "/ws";
		return url.toString();
	}

	if (address.startsWith("https://")) {
		const url = new URL(address);
		url.protocol = "wss:";
		url.pathname = "/ws";
		return url.toString();
	}

	throw new Error(`Unsupported server address format: ${address}`);
}

export async function createTestGateway(
	options: CreateTestGatewayOptions = {},
): Promise<TestGatewayContext> {
	const dataDir = await mkdtemp(join(tmpdir(), "homeagent-gateway-test-"));

	const config: GatewayConfig = {
		host: "127.0.0.1",
		port: 0,
		insecure: true,
		nonceWindowMs: 300_000,
		timestampSkewMs: 30_000,
		sessionTokenTtlMs: 60_000,
		idempotencyTtlMs: 86_400_000,
		idempotencyCleanupIntervalMs: 3_600_000,
		dataDir,
		jwtSecret: "gateway-test-jwt-secret",
		...options.configOverrides,
	};

	const deviceRegistry = new DeviceRegistry(config.dataDir);
	const nonceStore = new NonceStore(config.nonceWindowMs);
	const auditLog = new AuditLog(config.dataDir);
	const connectionManager = new ConnectionManager();

	await deviceRegistry.load();

	await deviceRegistry.registerDevice({
		deviceId: DEFAULT_TEST_DEVICE.deviceId,
		sharedSecret: DEFAULT_TEST_DEVICE.sharedSecret,
		approved: options.approvedDevice ?? true,
		role: DEFAULT_TEST_DEVICE.role,
	});

	for (const device of options.additionalDevices ?? []) {
		const role: Role =
			device.role === "admin" ||
			device.role === "node" ||
			device.role === "client"
				? device.role
				: "client";

		await deviceRegistry.registerDevice({
			deviceId: device.deviceId,
			sharedSecret: device.sharedSecret,
			approved: device.approved,
			role,
		});
	}

	const methodRegistry = new MethodRegistry();
	registerV1Handlers(methodRegistry, {
		deviceRegistry,
		connectionManager,
		auditLog,
	});

	const idempotencyStore = new SqliteIdempotencyStore({
		dbPath: join(dataDir, "homeagent.db"),
		ttlMs: config.idempotencyTtlMs ?? 86_400_000,
		cleanupIntervalMs: config.idempotencyCleanupIntervalMs ?? 3_600_000,
	});
	idempotencyStore.startCleanupTimer();

	const rpcRouter = new RpcRouter(methodRegistry, idempotencyStore);

	const server = await createGatewayServer({
		config,
		deviceRegistry,
		nonceStore,
		auditLog,
		connectionManager,
		rpcRouter,
		idempotencyStore,
	});

	const address = await server.listen({ host: config.host, port: config.port });
	const wsUrl = toWebSocketUrl(address);

	return {
		server,
		config,
		deviceRegistry,
		nonceStore,
		auditLog,
		connectionManager,
		rpcRouter,
		idempotencyStore,
		dataDir,
		address,
		wsUrl,
		testDevice: DEFAULT_TEST_DEVICE,
	};
}

export async function cleanupTestGateway(
	ctx: TestGatewayContext,
): Promise<void> {
	ctx.idempotencyStore.close();
	await ctx.server.close();
	await rm(ctx.dataDir, { recursive: true, force: true });
}

export function createConnectMessage(params: {
	deviceId: string;
	sharedSecret: string;
	nonce?: string;
	timestamp?: number;
	role?: string;
	authToken?: string;
	signature?: string;
}): {
	role: string;
	deviceId: string;
	authToken: string;
	nonce: string;
	timestamp: number;
	signature: string;
} {
	const nonce = params.nonce ?? randomUUID();
	const timestamp = params.timestamp ?? Date.now();
	const role = params.role ?? "node";
	const authToken = params.authToken ?? "test-auth-token";
	const signature =
		params.signature ??
		computeHmac(params.deviceId, nonce, timestamp, params.sharedSecret);

	return {
		role,
		deviceId: params.deviceId,
		authToken,
		nonce,
		timestamp,
		signature,
	};
}

export async function waitForSocketOpen(
	socket: WebSocket,
	timeoutMs = 2_000,
): Promise<void> {
	if (socket.readyState === WebSocket.OPEN) {
		return;
	}

	if (
		socket.readyState === WebSocket.CLOSING ||
		socket.readyState === WebSocket.CLOSED
	) {
		throw new Error(
			"WebSocket is not open and cannot transition to open state.",
		);
	}

	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			cleanup();
			reject(new Error("Timed out waiting for WebSocket open."));
		}, timeoutMs);

		const onOpen = () => {
			cleanup();
			resolve();
		};

		const onClose = () => {
			cleanup();
			reject(new Error("WebSocket closed before opening."));
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		function cleanup(): void {
			clearTimeout(timeout);
			socket.off("open", onOpen);
			socket.off("close", onClose);
			socket.off("error", onError);
		}

		socket.once("open", onOpen);
		socket.once("close", onClose);
		socket.once("error", onError);
	});
}

export async function waitForSocketMessage<T = unknown>(
	socket: WebSocket,
	timeoutMs = 2_000,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(() => {
			cleanup();
			reject(new Error("Timed out waiting for WebSocket message."));
		}, timeoutMs);

		const onMessage = (raw: WebSocket.RawData) => {
			cleanup();
			try {
				let text: string;
				if (typeof raw === "string") {
					text = raw;
				} else if (Buffer.isBuffer(raw)) {
					text = raw.toString("utf8");
				} else if (Array.isArray(raw)) {
					text = Buffer.concat(raw).toString("utf8");
				} else if (raw instanceof ArrayBuffer) {
					text = Buffer.from(raw).toString("utf8");
				} else {
					text = String(raw);
				}
				resolve(JSON.parse(text) as T);
			} catch (error: unknown) {
				reject(error);
			}
		};

		const onClose = () => {
			cleanup();
			reject(new Error("WebSocket closed before message was received."));
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		function cleanup(): void {
			clearTimeout(timeout);
			socket.off("message", onMessage);
			socket.off("close", onClose);
			socket.off("error", onError);
		}

		socket.once("message", onMessage);
		socket.once("close", onClose);
		socket.once("error", onError);
	});
}

export async function waitForSocketClose(
	socket: WebSocket,
	timeoutMs = 2_000,
): Promise<{ code: number; reason: string }> {
	return new Promise<{ code: number; reason: string }>((resolve, reject) => {
		const timeout = setTimeout(() => {
			cleanup();
			reject(new Error("Timed out waiting for WebSocket close."));
		}, timeoutMs);

		const onClose = (code: number, reason: Buffer) => {
			cleanup();
			resolve({ code, reason: reason.toString("utf8") });
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		function cleanup(): void {
			clearTimeout(timeout);
			socket.off("close", onClose);
			socket.off("error", onError);
		}

		socket.once("close", onClose);
		socket.once("error", onError);
	});
}

export async function closeSocket(socket: WebSocket): Promise<void> {
	if (
		socket.readyState === WebSocket.CLOSED ||
		socket.readyState === WebSocket.CLOSING
	) {
		return;
	}

	await new Promise<void>((resolve) => {
		socket.once("close", () => resolve());
		socket.close();
	});
}
