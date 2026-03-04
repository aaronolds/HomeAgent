import { randomUUID } from "node:crypto";

import {
	ConnectOkSchema,
	ConnectSchema,
	type ProtocolError,
	ProtocolErrorSchema,
} from "@homeagent/shared";
import type { FastifyInstance } from "fastify";
import type WebSocket from "ws";
import type { RawData } from "ws";

import {
	createAuthFailureEvent,
	createConnectionEvent,
	createNonceReplayEvent,
} from "../audit/audit-log.js";
import { AuthError, type AuthErrorCode } from "../auth/errors.js";
import { validateTimestamp, verifyHmac } from "../auth/hmac-auth.js";
import { issueSessionToken } from "../auth/session-token.js";
import type { RpcRouter } from "../rpc/router.js";
import type { RpcContext } from "../rpc/types.js";
import type { ConnectionContext } from "./connection-context.js";
import type { GatewayDependencies } from "./create-gateway-server.js";
import { handleHeartbeat } from "./heartbeat-handler.js";

const AUTH_FAILURE_CLOSE_CODE = 1008;
const PROTOCOL_FAILURE_CLOSE_CODE = 1002;
const HANDSHAKE_TIMEOUT_CLOSE_CODE = 1008;
const HANDSHAKE_TIMEOUT_MS = 10_000;
const HEARTBEAT_SECONDS = 30;
const SERVER_VERSION = "0.0.1";

const PROTOCOL_ERROR_CODES: Record<AuthErrorCode, number> = {
	INVALID_HMAC: 4001,
	STALE_TIMESTAMP: 4002,
	REPLAYED_NONCE: 4003,
	UNAPPROVED_DEVICE: 4004,
	UNKNOWN_DEVICE: 4005,
	INVALID_TOKEN: 4006,
	EXPIRED_TOKEN: 4007,
};

function sendJson(socket: WebSocket, payload: unknown): void {
	socket.send(JSON.stringify(payload));
}

function sendProtocolError(socket: WebSocket, error: ProtocolError): void {
	const parsed = ProtocolErrorSchema.parse(error);
	sendJson(socket, parsed);
}

function mapAuthErrorToProtocol(error: AuthError): ProtocolError {
	return {
		code: PROTOCOL_ERROR_CODES[error.code],
		message: error.message,
		retryable: error.code === "STALE_TIMESTAMP",
	};
}

function parseIncomingMessage(payload: RawData): unknown {
	if (typeof payload === "string") {
		return JSON.parse(payload);
	}

	if (payload instanceof Buffer) {
		return JSON.parse(payload.toString("utf8"));
	}

	if (payload instanceof ArrayBuffer) {
		return JSON.parse(Buffer.from(payload).toString("utf8"));
	}

	if (Array.isArray(payload)) {
		const combined = Buffer.concat(payload);
		return JSON.parse(combined.toString("utf8"));
	}

	return JSON.parse(Buffer.from(payload.buffer).toString("utf8"));
}

function waitForFirstMessage(socket: WebSocket): Promise<RawData> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			cleanup();
			reject(new Error("Handshake timed out waiting for connect payload."));
		}, HANDSHAKE_TIMEOUT_MS);

		const onMessage = (message: RawData) => {
			cleanup();
			resolve(message);
		};

		const onClose = () => {
			cleanup();
			reject(new Error("Socket closed before handshake payload was received."));
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

function attachPostHandshakeHandlers(
	socket: WebSocket,
	deps: GatewayDependencies,
	connectionCtx: ConnectionContext,
	jwtSecret: string,
): void {
	socket.on("message", (raw) => {
		let message: unknown;
		try {
			message = parseIncomingMessage(raw);
		} catch {
			sendProtocolError(socket, {
				code: 4000,
				message: "Malformed message payload.",
				retryable: false,
			});
			socket.close(PROTOCOL_FAILURE_CLOSE_CODE, "Malformed message payload");
			return;
		}

		if (
			typeof message === "object" &&
			message !== null &&
			"type" in message &&
			message.type === "heartbeat"
		) {
			handleHeartbeat({
				message,
				connectionCtx,
				jwtSecret,
				ttlMs: deps.config.sessionTokenTtlMs,
				socket,
				connectionManager: deps.connectionManager,
			});
			return;
		}

		const rpcContext: RpcContext = {
			connectionId: connectionCtx.connectionId,
			deviceId: connectionCtx.deviceId,
			role: connectionCtx.role,
			sessionToken: connectionCtx.sessionToken,
		};
		const rpcRouter: RpcRouter = deps.rpcRouter;
		void rpcRouter.handle(message, rpcContext).then(
			(response) => {
				sendJson(socket, response);
			},
			(error) => {
				console.error("[gateway] rpc handler error", {
					connectionId: connectionCtx.connectionId,
					error: error instanceof Error ? error.message : String(error),
				});
			},
		);
	});

	socket.once("close", () => {
		deps.connectionManager.remove(connectionCtx.connectionId);
		void deps.auditLog.log(
			createConnectionEvent(connectionCtx.deviceId, "disconnected"),
		);
	});

	socket.once("error", (error) => {
		console.error("[gateway] websocket post-handshake error", {
			deviceId: connectionCtx.deviceId,
			connectionId: connectionCtx.connectionId,
			error: error.message,
		});
	});
}

async function processHandshake(
	socket: WebSocket,
	deps: GatewayDependencies,
): Promise<void> {
	let connectPayload: unknown;
	try {
		const rawConnect = await waitForFirstMessage(socket);
		connectPayload = parseIncomingMessage(rawConnect);
	} catch {
		sendProtocolError(socket, {
			code: 4000,
			message: "Expected connect payload as first message.",
			retryable: true,
		});
		socket.close(HANDSHAKE_TIMEOUT_CLOSE_CODE, "Expected connect payload");
		return;
	}

	const parsedConnect = ConnectSchema.safeParse(connectPayload);
	if (!parsedConnect.success) {
		sendProtocolError(socket, {
			code: 4000,
			message: "Invalid connect payload.",
			retryable: false,
		});
		socket.close(PROTOCOL_FAILURE_CLOSE_CODE, "Invalid connect payload");
		return;
	}

	const message = parsedConnect.data;

	try {
		if (!validateTimestamp(message.timestamp, deps.config.timestampSkewMs)) {
			throw new AuthError(
				"STALE_TIMESTAMP",
				"Connect timestamp is outside allowed skew.",
				message.deviceId,
			);
		}

		const device = await deps.deviceRegistry.getDevice(message.deviceId);
		if (device === undefined) {
			throw new AuthError(
				"UNKNOWN_DEVICE",
				"Device is not registered.",
				message.deviceId,
			);
		}

		if (device.approved !== true) {
			throw new AuthError(
				"UNAPPROVED_DEVICE",
				"Device is not approved.",
				message.deviceId,
			);
		}

		if (
			!verifyHmac(
				message.signature,
				message.deviceId,
				message.nonce,
				message.timestamp,
				device.sharedSecret,
			)
		) {
			throw new AuthError(
				"INVALID_HMAC",
				"Connect signature is invalid.",
				message.deviceId,
			);
		}

		const acceptedNonce = deps.nonceStore.checkAndMark(
			message.nonce,
			message.deviceId,
		);
		if (!acceptedNonce) {
			void deps.auditLog.log(
				createNonceReplayEvent(message.deviceId, message.nonce),
			);
			throw new AuthError(
				"REPLAYED_NONCE",
				"Nonce was already used in the active window.",
				message.deviceId,
			);
		}

		if (deps.config.jwtSecret === undefined) {
			throw new Error("JWT secret is required before issuing session tokens.");
		}

		const jwtSecret = deps.config.jwtSecret;

		const connectionId = randomUUID();
		const connectedAt = Date.now();
		const sessionToken = issueSessionToken({
			deviceId: message.deviceId,
			connectionId,
			role: message.role,
			jwtSecret,
			ttlMs: deps.config.sessionTokenTtlMs,
		});

		deps.connectionManager.add({
			connectionId,
			deviceId: message.deviceId,
			role: message.role,
			sessionToken,
			connectedAt,
		});

		const connectOk = ConnectOkSchema.parse({
			connectionId,
			approved: true,
			serverVersion: SERVER_VERSION,
			heartbeatSec: HEARTBEAT_SECONDS,
			sessionToken,
		});

		sendJson(socket, connectOk);

		const connectionCtx: ConnectionContext = {
			connectionId,
			deviceId: message.deviceId,
			role: message.role,
			sessionToken,
			connectedAt,
		};

		attachPostHandshakeHandlers(socket, deps, connectionCtx, jwtSecret);
		await deps.auditLog.log(
			createConnectionEvent(message.deviceId, "connected"),
		);
	} catch (error: unknown) {
		if (error instanceof AuthError) {
			sendProtocolError(socket, mapAuthErrorToProtocol(error));
			await deps.auditLog.log(
				createAuthFailureEvent(message.deviceId, error.code),
			);
			socket.close(AUTH_FAILURE_CLOSE_CODE, error.code);
			return;
		}

		console.error("[gateway] handshake error", {
			deviceId: message.deviceId,
			error: (error as Error).message,
		});
		sendProtocolError(socket, {
			code: 4500,
			message: "Internal server error.",
			retryable: true,
		});
		socket.close(1011, "Internal server error");
	}
}

export function registerWebSocketRoutes(
	server: FastifyInstance,
	deps: GatewayDependencies,
): void {
	server.get("/ws", { websocket: true }, (socket) => {
		void processHandshake(socket, deps);
	});
}
