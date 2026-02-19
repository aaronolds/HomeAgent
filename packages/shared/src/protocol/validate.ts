import type { z } from "zod/v4";
import type { RequestEnvelope } from "./envelopes.js";
import { RequestEnvelopeSchema } from "./envelopes.js";
import type { ProtocolIssue } from "./errors.js";
import { IdempotencyKeyError, ProtocolValidationError } from "./errors.js";
import { requiresIdempotencyKey } from "./idempotency.js";

function toProtocolPath(
	path: readonly PropertyKey[],
): readonly (string | number)[] {
	return path.filter(
		(segment): segment is string | number => typeof segment !== "symbol",
	);
}

/**
 * Validate and parse a raw request envelope.
 *
 * Performs structural validation via Zod, then checks idempotency
 * key requirements for side-effecting methods.
 *
 * @throws {ProtocolValidationError} on malformed payloads
 * @throws {IdempotencyKeyError} when idempotency key is missing for a side-effecting method
 */
export function parseRequestEnvelope(raw: unknown): RequestEnvelope {
	const result = RequestEnvelopeSchema.safeParse(raw);

	if (!result.success) {
		const issues: ProtocolIssue[] = result.error.issues.map((issue) => ({
			path: toProtocolPath(issue.path),
			message: issue.message,
		}));
		throw new ProtocolValidationError("Invalid request envelope", issues);
	}

	const envelope = result.data;

	if (requiresIdempotencyKey(envelope.method) && !envelope.idempotencyKey) {
		throw new IdempotencyKeyError(envelope.method);
	}

	return envelope;
}

/**
 * Safe version of parseRequestEnvelope that returns a result object
 * instead of throwing.
 */
export function safeParseRequestEnvelope(
	raw: unknown,
):
	| { success: true; data: RequestEnvelope }
	| { success: false; error: ProtocolValidationError | IdempotencyKeyError } {
	try {
		const data = parseRequestEnvelope(raw);
		return { success: true, data };
	} catch (error) {
		if (error instanceof ProtocolValidationError) {
			return { success: false, error };
		}
		throw error;
	}
}

/**
 * Generic schema validator that wraps Zod safeParse with typed protocol errors.
 */
export function validateSchema<T>(
	schema: z.ZodType<T>,
	data: unknown,
	label: string,
): T {
	const result = schema.safeParse(data);
	if (!result.success) {
		const issues: ProtocolIssue[] = result.error.issues.map((issue) => ({
			path: toProtocolPath(issue.path),
			message: issue.message,
		}));
		throw new ProtocolValidationError(`Invalid ${label}`, issues);
	}
	return result.data;
}
