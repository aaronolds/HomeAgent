import { randomBytes } from "node:crypto";
import { join } from "node:path";

import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";

import { AuditLog } from "../audit/audit-log.js";
import type { GatewayConfig } from "../config/gateway-config.js";
import { SqliteIdempotencyStore } from "../idempotency/sqlite-idempotency-store.js";
import { registerV1Handlers } from "../rpc/method-handlers.js";
import { MethodRegistry } from "../rpc/method-registry.js";
import { RpcRouter } from "../rpc/router.js";
import { DeviceRegistry } from "../state/device-registry.js";
import { NonceStore } from "../state/nonce-store.js";
import { buildTlsOptions } from "../tls/tls-options.js";
import { ConnectionManager } from "./connection-context.js";
import { registerWebSocketRoutes } from "./register-websocket-routes.js";

export interface GatewayDependencies {
	config: GatewayConfig;
	deviceRegistry: DeviceRegistry;
	nonceStore: NonceStore;
	auditLog: AuditLog;
	connectionManager: ConnectionManager;
	rpcRouter: RpcRouter;
	idempotencyStore: SqliteIdempotencyStore | null;
}

export async function createGatewayServer(
	deps: GatewayDependencies,
): Promise<FastifyInstance> {
	const tlsOptions = await buildTlsOptions(deps.config);
	const server: FastifyInstance =
		tlsOptions === null
			? Fastify()
			: (Fastify({ https: tlsOptions.https }) as unknown as FastifyInstance);

	await server.register(websocket);
	registerWebSocketRoutes(server, deps);

	return server;
}

export async function startGateway(
	config: GatewayConfig,
): Promise<FastifyInstance> {
	const effectiveConfig: GatewayConfig = {
		...config,
		jwtSecret: config.jwtSecret ?? randomBytes(32).toString("hex"),
	};

	const deviceRegistry = new DeviceRegistry(effectiveConfig.dataDir);
	const nonceStore = new NonceStore(effectiveConfig.nonceWindowMs);
	const auditLog = new AuditLog(effectiveConfig.dataDir);
	const connectionManager = new ConnectionManager();
	const methodRegistry = new MethodRegistry();
	registerV1Handlers(methodRegistry, {
		deviceRegistry,
		connectionManager,
		auditLog,
	});

	const idempotencyStore = new SqliteIdempotencyStore({
		dbPath:
			effectiveConfig.sqlitePath ??
			join(effectiveConfig.dataDir, "homeagent.db"),
		ttlMs: effectiveConfig.idempotencyTtlMs,
		cleanupIntervalMs: effectiveConfig.idempotencyCleanupIntervalMs,
	});
	idempotencyStore.startCleanupTimer();

	const rpcRouter = new RpcRouter(methodRegistry, idempotencyStore);

	await deviceRegistry.load();

	const server = await createGatewayServer({
		config: effectiveConfig,
		deviceRegistry,
		nonceStore,
		auditLog,
		connectionManager,
		rpcRouter,
		idempotencyStore,
	});

	server.addHook("onClose", async () => {
		idempotencyStore.close();
	});

	const address = await server.listen({
		host: effectiveConfig.host,
		port: effectiveConfig.port,
	});

	console.log("[gateway] startup complete", {
		address,
		host: effectiveConfig.host,
		port: effectiveConfig.port,
		insecure: effectiveConfig.insecure,
		generatedJwtSecret: config.jwtSecret === undefined,
	});

	return server;
}
