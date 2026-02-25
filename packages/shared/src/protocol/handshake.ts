import { z } from "zod/v4";
import { Identifier, NonEmptyString, RoleSchema, Timestamp } from "./types.js";

/**
 * Connect request - sent by a client to initiate a session.
 */
export const ConnectSchema = z.object({
	role: RoleSchema,
	deviceId: NonEmptyString,
	authToken: NonEmptyString,
	nonce: NonEmptyString,
	timestamp: Timestamp,
	signature: NonEmptyString,
	agentId: NonEmptyString.optional(),
	capabilities: z.array(NonEmptyString).optional(),
});
export type Connect = z.infer<typeof ConnectSchema>;

/**
 * Connect OK - sent by the server on successful handshake.
 */
export const ConnectOkSchema = z.object({
	connectionId: Identifier,
	approved: z.boolean(),
	serverVersion: NonEmptyString,
	heartbeatSec: z.number().int().positive(),
	sessionToken: NonEmptyString,
});
export type ConnectOk = z.infer<typeof ConnectOkSchema>;

/**
 * Heartbeat request - sent by clients to keep session alive.
 */
export const HeartbeatRequestSchema = z.object({
	type: z.literal("heartbeat"),
	sessionToken: NonEmptyString,
});
export type HeartbeatRequest = z.infer<typeof HeartbeatRequestSchema>;

/**
 * Heartbeat acknowledgment - sent by server with refreshed session token.
 */
export const HeartbeatAckSchema = z.object({
	type: z.literal("heartbeat_ack"),
	sessionToken: NonEmptyString,
});
export type HeartbeatAck = z.infer<typeof HeartbeatAckSchema>;

/**
 * Protocol error payload.
 */
export const ProtocolErrorSchema = z.object({
	code: z.number().int(),
	message: z.string(),
	retryable: z.boolean(),
});
export type ProtocolError = z.infer<typeof ProtocolErrorSchema>;
