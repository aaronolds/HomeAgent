import { randomBytes } from "node:crypto";
import { join } from "node:path";

import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";

import { AuditLog } from "../audit/audit-log.js";
import type { GatewayServerConfig } from "../config/gateway-config.js";
import { SqliteIdempotencyStore } from "../idempotency/sqlite-idempotency-store.js";
import { validateOrigin } from "../network/origin-validator.js";
import { SlidingWindowRateLimiter } from "../network/rate-limiter.js";
import { EncryptedFileSecretStore } from "../persistence/encrypted-file-secret-store.js";
import { KeychainSecretStore } from "../persistence/keychain-secret-store.js";
import { migrateDevicesFromJson } from "../persistence/migrate-devices.js";
import { OperationalStore } from "../persistence/operational-store.js";
import type { SecretStore } from "../persistence/secret-store.js";
import { registerV1Handlers } from "../rpc/method-handlers.js";
import { MethodRegistry } from "../rpc/method-registry.js";
import { RpcRouter } from "../rpc/router.js";
import { NonceStore } from "../state/nonce-store.js";
import { buildTlsOptions } from "../tls/tls-options.js";
import { ConnectionManager } from "./connection-context.js";
import { registerWebSocketRoutes } from "./register-websocket-routes.js";

export interface GatewayDependencies {
	config: GatewayServerConfig;
	operationalStore: OperationalStore;
	secretStore: SecretStore | null;
	nonceStore: NonceStore;
	auditLog: AuditLog;
	connectionManager: ConnectionManager;
	rpcRouter: RpcRouter;
	idempotencyStore: SqliteIdempotencyStore | null;
	ipRateLimiter: SlidingWindowRateLimiter;
}

export async function createGatewayServer(
	deps: GatewayDependencies,
): Promise<FastifyInstance> {
	const tlsOptions = await buildTlsOptions(deps.config);
	const server: FastifyInstance =
		tlsOptions === null
			? Fastify()
			: (Fastify({ https: tlsOptions.https }) as unknown as FastifyInstance);

	if (deps.config.network.strictCors) {
		const corsOrigin =
			deps.config.network.originAllowlist.length > 0
				? deps.config.network.originAllowlist
				: false;
		await server.register(cors, {
			origin: corsOrigin,
			methods: ["GET", "POST"],
			credentials: true,
		});
	}

	await server.register(websocket, {
		options: {
			maxPayload: deps.config.frameLimits.maxFrameBytes,
			verifyClient: (info, cb) => {
				const origin = info.req.headers.origin;
				if (
					!validateOrigin(
						origin,
						deps.config.network.originAllowlist,
						deps.config.network.strictOrigin,
					)
				) {
					cb(false, 403, "Forbidden: origin not allowed");
					return;
				}

				const ip = info.req.socket.remoteAddress ?? "unknown";
				if (!deps.ipRateLimiter.hit(ip)) {
					cb(false, 429, "Too Many Requests");
					return;
				}

				cb(true);
			},
		},
	});
	registerWebSocketRoutes(server, deps);

	return server;
}

export async function startGateway(
	config: GatewayServerConfig,
): Promise<FastifyInstance> {
	const effectiveConfig: GatewayServerConfig = {
		...config,
		jwtSecret: config.jwtSecret ?? randomBytes(32).toString("hex"),
	};

	const dbPath =
		effectiveConfig.sqlitePath ?? join(effectiveConfig.dataDir, "homeagent.db");
	const operationalStore = new OperationalStore({ dbPath });

	const migrationResult = migrateDevicesFromJson({
		jsonPath: join(effectiveConfig.dataDir, "devices.json"),
		store: operationalStore,
	});
	if (migrationResult.errors.length > 0) {
		console.warn("[gateway] device migration errors", migrationResult.errors);
	}

	const passphrase =
		effectiveConfig.masterPassphrase ?? process.env.HOMEAGENT_MASTER_PASSPHRASE;

	let secretStore: SecretStore | null = null;
	if (effectiveConfig.secretsBackend === "keychain") {
		if (passphrase === undefined) {
			console.warn(
				"[gateway] no master passphrase configured — keychain fallback requires a passphrase; secret store disabled",
			);
		} else {
			secretStore = new KeychainSecretStore({
				fallback: {
					vaultPath: join(effectiveConfig.dataDir, "secrets.vault"),
					passphrase,
				},
			});
		}
	} else {
		if (passphrase === undefined) {
			console.warn(
				"[gateway] no master passphrase configured — secret store disabled",
			);
		} else {
			secretStore = new EncryptedFileSecretStore({
				vaultPath: join(effectiveConfig.dataDir, "secrets.vault"),
				passphrase,
			});
		}
	}

	const nonceStore = new NonceStore(effectiveConfig.nonceWindowMs);
	const auditLog = new AuditLog(effectiveConfig.dataDir, {
		datasync: effectiveConfig.fsyncWrites,
	});
	const connectionManager = new ConnectionManager();
	const methodRegistry = new MethodRegistry();
	registerV1Handlers(methodRegistry, {
		operationalStore,
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

	const ipRateLimiter = new SlidingWindowRateLimiter(
		60_000,
		effectiveConfig.rateLimits.perIpConnectionsPerMinute,
	);
	const deviceRpcLimiter = new SlidingWindowRateLimiter(
		60_000,
		effectiveConfig.rateLimits.perDeviceRpcPerMinute,
	);
	const agentRunLimiter = new SlidingWindowRateLimiter(
		60_000,
		effectiveConfig.rateLimits.perDeviceAgentRunPerMinute,
	);

	const evictInterval = setInterval(() => {
		ipRateLimiter.evict();
		deviceRpcLimiter.evict();
		agentRunLimiter.evict();
	}, 60_000);

	const rpcRouter = new RpcRouter(
		methodRegistry,
		idempotencyStore,
		deviceRpcLimiter,
		agentRunLimiter,
	);

	const server = await createGatewayServer({
		config: effectiveConfig,
		operationalStore,
		secretStore,
		nonceStore,
		auditLog,
		connectionManager,
		rpcRouter,
		idempotencyStore,
		ipRateLimiter,
	});

	server.addHook("onClose", async () => {
		clearInterval(evictInterval);
		idempotencyStore.close();
		operationalStore.close();
		secretStore?.close();
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
