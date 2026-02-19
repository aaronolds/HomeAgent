import type { IdempotentMethod } from "./constants.js";
import { IDEMPOTENT_METHODS } from "./constants.js";

/**
 * Check whether a method requires an idempotency key.
 */
export function requiresIdempotencyKey(
	method: string,
): method is IdempotentMethod {
	return (IDEMPOTENT_METHODS as readonly string[]).includes(method);
}

/**
 * Build a namespaced idempotency key from its components.
 */
export function buildIdempotencyKey(
	deviceId: string,
	method: string,
	key: string,
): string {
	return `${deviceId}:${method}:${key}`;
}
