import { buildIdempotencyKey, requiresIdempotencyKey } from "@homeagent/shared";

import type { SqliteIdempotencyStore } from "../idempotency/sqlite-idempotency-store.js";
import { duplicateRequest } from "./errors.js";
import type { RpcContext } from "./types.js";

export interface IdempotencyCheckResult {
	/** If true, use cachedResponse. If false, proceed with handler. */
	cached: boolean;
	cachedResponse?: Record<string, unknown>;
	namespacedKey?: string;
}

export function checkIdempotency(
	method: string,
	idempotencyKey: string | undefined,
	context: RpcContext,
	store: SqliteIdempotencyStore,
): IdempotencyCheckResult {
	if (!requiresIdempotencyKey(method)) {
		return { cached: false };
	}

	if (idempotencyKey === undefined) {
		return { cached: false };
	}

	const namespacedKey = buildIdempotencyKey(
		context.deviceId,
		method,
		idempotencyKey,
	);
	const existing = store.get(namespacedKey);

	if (existing?.state === "completed") {
		const cachedResponse = JSON.parse(existing.response ?? "{}") as Record<
			string,
			unknown
		>;
		return {
			cached: true,
			cachedResponse,
			namespacedKey,
		};
	}

	if (existing?.state === "in_progress") {
		throw duplicateRequest();
	}

	const created = store.create(namespacedKey);
	if (!created) {
		const raceRecord = store.get(namespacedKey);
		if (raceRecord?.state === "completed") {
			const cachedResponse = JSON.parse(raceRecord.response ?? "{}") as Record<
				string,
				unknown
			>;
			return {
				cached: true,
				cachedResponse,
				namespacedKey,
			};
		}
		throw duplicateRequest();
	}
	return {
		cached: false,
		namespacedKey,
	};
}

export function completeIdempotency(
	store: SqliteIdempotencyStore,
	key: string,
	response: unknown,
): void {
	store.complete(key, response);
}

export function failIdempotency(
	store: SqliteIdempotencyStore,
	key: string,
	error: unknown,
): void {
	store.fail(key, error);
}
