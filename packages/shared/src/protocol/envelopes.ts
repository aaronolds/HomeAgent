import { z } from "zod/v4";
import { RPC_METHODS } from "./constants.js";
import { ProtocolErrorSchema } from "./handshake.js";
import {
	Identifier,
	NonEmptyString,
	ProtocolVersion,
	Timestamp,
} from "./types.js";

/**
 * RPC Request envelope - sent by clients.
 */
export const RequestEnvelopeSchema = z.object({
	version: ProtocolVersion,
	id: Identifier,
	method: z.enum(RPC_METHODS),
	params: z.record(z.string(), z.unknown()),
	idempotencyKey: NonEmptyString.optional(),
	ts: Timestamp,
});
export type RequestEnvelope = z.infer<typeof RequestEnvelopeSchema>;

/**
 * RPC Response envelope - sent by the server.
 */
export const ResponseEnvelopeSchema = z.object({
	version: ProtocolVersion,
	id: Identifier,
	result: z.record(z.string(), z.unknown()).optional(),
	error: ProtocolErrorSchema.optional(),
});
export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;

/**
 * Event envelope - server-initiated push.
 */
export const EventEnvelopeSchema = z.object({
	version: ProtocolVersion,
	event: NonEmptyString,
	data: z.unknown(),
	ts: Timestamp,
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
