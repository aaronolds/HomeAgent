import {
	HeartbeatAckSchema,
	HeartbeatRequestSchema,
	ProtocolErrorSchema,
} from "@homeagent/shared";
import type WebSocket from "ws";

import { AuthError } from "../auth/errors.js";
import {
	refreshSessionToken,
	verifySessionToken,
} from "../auth/session-token.js";
import type {
	ConnectionContext,
	ConnectionManager,
} from "./connection-context.js";

const AUTH_FAILURE_CLOSE_CODE = 1008;
const PROTOCOL_ERROR_CODES: Record<"INVALID_TOKEN" | "EXPIRED_TOKEN", number> =
	{
		INVALID_TOKEN: 4006,
		EXPIRED_TOKEN: 4007,
	};

function sendJson(socket: WebSocket, payload: unknown): void {
	socket.send(JSON.stringify(payload));
}

function sendProtocolError(
	socket: WebSocket,
	payload: {
		code: number;
		message: string;
		retryable: boolean;
	},
): void {
	sendJson(socket, ProtocolErrorSchema.parse(payload));
}

export function handleHeartbeat(params: {
	message: unknown;
	connectionCtx: ConnectionContext;
	jwtSecret: string;
	ttlMs: number;
	socket: WebSocket;
	connectionManager: ConnectionManager;
}): void {
	const {
		message,
		connectionCtx,
		jwtSecret,
		ttlMs,
		socket,
		connectionManager,
	} = params;

	const parsedHeartbeat = HeartbeatRequestSchema.safeParse(message);
	if (!parsedHeartbeat.success) {
		sendProtocolError(socket, {
			code: 4000,
			message: "Invalid heartbeat payload.",
			retryable: false,
		});
		return;
	}

	const { sessionToken } = parsedHeartbeat.data;

	try {
		const tokenPayload = verifySessionToken(sessionToken, jwtSecret);
		if (
			tokenPayload.connectionId !== connectionCtx.connectionId ||
			tokenPayload.deviceId !== connectionCtx.deviceId
		) {
			throw new AuthError(
				"INVALID_TOKEN",
				"Session token does not match active connection.",
			);
		}

		const nextSessionToken = refreshSessionToken(
			sessionToken,
			jwtSecret,
			ttlMs,
		);
		connectionCtx.sessionToken = nextSessionToken;
		connectionManager.add(connectionCtx);

		sendJson(
			socket,
			HeartbeatAckSchema.parse({
				type: "heartbeat_ack",
				sessionToken: nextSessionToken,
			}),
		);
	} catch (error: unknown) {
		if (
			error instanceof AuthError &&
			(error.code === "INVALID_TOKEN" || error.code === "EXPIRED_TOKEN")
		) {
			sendProtocolError(socket, {
				code: PROTOCOL_ERROR_CODES[error.code],
				message: error.message,
				retryable: false,
			});
			socket.close(AUTH_FAILURE_CLOSE_CODE, error.code);
			return;
		}

		console.error("[gateway] heartbeat processing error", {
			connectionId: connectionCtx.connectionId,
			deviceId: connectionCtx.deviceId,
			error: (error as Error).message,
		});
		sendProtocolError(socket, {
			code: 4500,
			message: "Internal server error.",
			retryable: true,
		});
	}
}
