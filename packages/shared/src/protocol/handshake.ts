import { z } from "zod/v4";
import { Identifier, NonEmptyString, RoleSchema } from "./types.js";

/**
 * Connect request - sent by a client to initiate a session.
 */
export const ConnectSchema = z.object({
	role: RoleSchema,
	deviceId: NonEmptyString,
	authToken: NonEmptyString,
	nonce: NonEmptyString,
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
 * Protocol error payload.
 */
export const ProtocolErrorSchema = z.object({
	code: z.number().int(),
	message: z.string(),
	retryable: z.boolean(),
});
export type ProtocolError = z.infer<typeof ProtocolErrorSchema>;
