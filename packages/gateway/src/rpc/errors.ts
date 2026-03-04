/**
 * Standard RPC error codes following JSON-RPC style numbering.
 */
export const RPC_ERROR_CODES = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,
	// Custom gateway errors
	UNAUTHORIZED: -32000,
	FORBIDDEN: -32001,
	MISSING_IDEMPOTENCY_KEY: -32002,
	DUPLICATE_REQUEST: -32003,
	DEVICE_REVOKED: -32004,
	RATE_LIMITED: -32005,
	FRAME_TOO_LARGE: -32006,
} as const;

export type RpcErrorCode =
	(typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES];

export class RpcError extends Error {
	readonly code: RpcErrorCode;
	readonly data?: unknown;
	readonly retryable: boolean;

	constructor(
		code: RpcErrorCode,
		message: string,
		retryable: boolean,
		data?: unknown,
	) {
		super(message);
		this.name = "RpcError";
		this.code = code;
		this.retryable = retryable;
		this.data = data;
	}
}

export function parseError(message = "Parse error"): RpcError {
	return new RpcError(RPC_ERROR_CODES.PARSE_ERROR, message, false);
}

export function invalidRequest(message = "Invalid request"): RpcError {
	return new RpcError(RPC_ERROR_CODES.INVALID_REQUEST, message, false);
}

export function methodNotFound(method: string): RpcError {
	return new RpcError(
		RPC_ERROR_CODES.METHOD_NOT_FOUND,
		`Method not found: ${method}`,
		false,
		{ method },
	);
}

export function invalidParams(message = "Invalid params"): RpcError {
	return new RpcError(RPC_ERROR_CODES.INVALID_PARAMS, message, false);
}

export function internalError(message = "Internal error"): RpcError {
	return new RpcError(RPC_ERROR_CODES.INTERNAL_ERROR, message, true);
}

export function unauthorized(message = "Unauthorized"): RpcError {
	return new RpcError(RPC_ERROR_CODES.UNAUTHORIZED, message, false);
}

export function forbidden(role: string, method: string): RpcError {
	return new RpcError(
		RPC_ERROR_CODES.FORBIDDEN,
		`Forbidden: role '${role}' cannot call method '${method}'`,
		false,
		{ role, method },
	);
}

export function missingIdempotencyKey(method: string): RpcError {
	return new RpcError(
		RPC_ERROR_CODES.MISSING_IDEMPOTENCY_KEY,
		`Missing idempotency key for method '${method}'`,
		false,
		{ method },
	);
}

export function duplicateRequest(): RpcError {
	return new RpcError(
		RPC_ERROR_CODES.DUPLICATE_REQUEST,
		"Duplicate request",
		true,
	);
}

export function deviceRevoked(deviceId: string): RpcError {
	return new RpcError(
		RPC_ERROR_CODES.DEVICE_REVOKED,
		`Device revoked: ${deviceId}`,
		false,
		{ deviceId },
	);
}

export function rateLimited(message = "Rate limit exceeded"): RpcError {
	return new RpcError(RPC_ERROR_CODES.RATE_LIMITED, message, true);
}

export function frameTooLarge(size: number, maxSize: number): RpcError {
	return new RpcError(
		RPC_ERROR_CODES.FRAME_TOO_LARGE,
		`Frame size ${size} exceeds maximum ${maxSize}`,
		false,
		{ size, maxSize },
	);
}
