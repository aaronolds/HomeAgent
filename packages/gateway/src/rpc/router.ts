import {
	IdempotencyKeyError,
	PROTOCOL_VERSION,
	ProtocolValidationError,
	parseRequestEnvelope,
	type RequestEnvelope,
	type ResponseEnvelope,
	type RpcMethod,
} from "@homeagent/shared";

import type { SqliteIdempotencyStore } from "../idempotency/sqlite-idempotency-store.js";
import type { SlidingWindowRateLimiter } from "../network/rate-limiter.js";
import {
	forbidden,
	internalError,
	invalidRequest,
	methodNotFound,
	missingIdempotencyKey,
	RpcError,
	rateLimited,
} from "./errors.js";
import {
	checkIdempotency,
	completeIdempotency,
	failIdempotency,
} from "./idempotency-middleware.js";
import type { MethodRegistry } from "./method-registry.js";
import { isAuthorized } from "./rbac.js";
import type { RpcContext } from "./types.js";

export class RpcRouter {
	public constructor(
		private readonly methodRegistry: MethodRegistry,
		private readonly idempotencyStore: SqliteIdempotencyStore | null,
		private readonly deviceRpcLimiter: SlidingWindowRateLimiter | null = null,
		private readonly agentRunLimiter: SlidingWindowRateLimiter | null = null,
	) {}

	/**
	 * Process a parsed message through the full middleware pipeline:
	 * 1. Parse request envelope (validate structure)
	 * 2. Check RBAC authorization
	 * 3. Run idempotency middleware (for side-effecting methods)
	 * 4. Execute handler
	 * 5. Return response envelope
	 */
	public async handle(
		raw: unknown,
		context: RpcContext,
	): Promise<ResponseEnvelope> {
		let envelope: RequestEnvelope;

		try {
			envelope = parseRequestEnvelope(raw);
		} catch (error: unknown) {
			if (error instanceof IdempotencyKeyError) {
				return this.buildErrorResponse(
					"unknown",
					missingIdempotencyKey(error.method),
				);
			}

			if (error instanceof ProtocolValidationError) {
				return this.buildErrorResponse(
					"unknown",
					invalidRequest(error.message),
				);
			}

			return this.buildErrorResponse("unknown", internalError());
		}

		const method = envelope.method;
		const handler = this.methodRegistry.get(method);
		if (handler === undefined) {
			return this.buildErrorResponse(envelope.id, methodNotFound(method));
		}

		if (!isAuthorized(context.role, method as RpcMethod)) {
			return this.buildErrorResponse(
				envelope.id,
				forbidden(context.role, method),
			);
		}

		if (
			this.deviceRpcLimiter !== null &&
			!this.deviceRpcLimiter.hit(context.deviceId)
		) {
			return this.buildErrorResponse(
				envelope.id,
				rateLimited("Per-device RPC rate limit exceeded"),
			);
		}

		if (
			method === "agent.run" &&
			this.agentRunLimiter !== null &&
			!this.agentRunLimiter.hit(context.deviceId)
		) {
			return this.buildErrorResponse(
				envelope.id,
				rateLimited("Per-device agent.run rate limit exceeded"),
			);
		}

		let idempotencyKey: string | undefined;
		try {
			if (this.idempotencyStore !== null) {
				const idempotencyCheck = checkIdempotency(
					method,
					envelope.idempotencyKey,
					context,
					this.idempotencyStore,
				);

				if (idempotencyCheck.cached) {
					return this.buildSuccessResponse(
						envelope.id,
						idempotencyCheck.cachedResponse ?? {},
					);
				}

				idempotencyKey = idempotencyCheck.namespacedKey;
			}

			const result = await handler(envelope.params, context);

			if (this.idempotencyStore !== null && idempotencyKey !== undefined) {
				completeIdempotency(this.idempotencyStore, idempotencyKey, result);
			}

			return this.buildSuccessResponse(envelope.id, result);
		} catch (error: unknown) {
			if (this.idempotencyStore !== null && idempotencyKey !== undefined) {
				failIdempotency(this.idempotencyStore, idempotencyKey, {
					message: error instanceof Error ? error.message : String(error),
				});
			}

			const rpcError = error instanceof RpcError ? error : internalError();
			return this.buildErrorResponse(envelope.id, rpcError);
		}
	}

	private buildErrorResponse(id: string, error: RpcError): ResponseEnvelope {
		return {
			version: PROTOCOL_VERSION,
			id,
			error: {
				code: error.code,
				message: error.message,
				retryable: error.retryable,
			},
		};
	}

	private buildSuccessResponse(
		id: string,
		result: Record<string, unknown>,
	): ResponseEnvelope {
		return {
			version: PROTOCOL_VERSION,
			id,
			result,
		};
	}
}
