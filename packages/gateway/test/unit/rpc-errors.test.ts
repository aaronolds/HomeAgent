import { describe, expect, it } from "vitest";
import {
	deviceRevoked,
	duplicateRequest,
	forbidden,
	frameTooLarge,
	internalError,
	invalidParams,
	invalidRequest,
	methodNotFound,
	missingIdempotencyKey,
	parseError,
	RPC_ERROR_CODES,
	RpcError,
	rateLimited,
	unauthorized,
} from "../../src/rpc/errors.js";

describe("RPC Errors", () => {
	it("creates parse error", () => {
		const err = parseError();
		expect(err).toBeInstanceOf(RpcError);
		expect(err.code).toBe(RPC_ERROR_CODES.PARSE_ERROR);
		expect(err.retryable).toBe(false);
	});

	it("creates method not found error with method data", () => {
		const err = methodNotFound("unknown.method");
		expect(err.code).toBe(RPC_ERROR_CODES.METHOD_NOT_FOUND);
		expect(err.data).toEqual({ method: "unknown.method" });
		expect(err.retryable).toBe(false);
	});

	it("creates forbidden error with role and method", () => {
		const err = forbidden("client", "device.revoke");
		expect(err.code).toBe(RPC_ERROR_CODES.FORBIDDEN);
		expect(err.data).toEqual({ role: "client", method: "device.revoke" });
		expect(err.retryable).toBe(false);
	});

	it("creates missing idempotency key error", () => {
		const err = missingIdempotencyKey("message.send");
		expect(err.code).toBe(RPC_ERROR_CODES.MISSING_IDEMPOTENCY_KEY);
		expect(err.retryable).toBe(false);
	});

	it("creates duplicate request error (retryable)", () => {
		const err = duplicateRequest();
		expect(err.code).toBe(RPC_ERROR_CODES.DUPLICATE_REQUEST);
		expect(err.retryable).toBe(true);
	});

	it("creates internal error (retryable)", () => {
		const err = internalError();
		expect(err.code).toBe(RPC_ERROR_CODES.INTERNAL_ERROR);
		expect(err.retryable).toBe(true);
	});

	it("creates device revoked error", () => {
		const err = deviceRevoked("device-123");
		expect(err.code).toBe(RPC_ERROR_CODES.DEVICE_REVOKED);
		expect(err.data).toEqual({ deviceId: "device-123" });
		expect(err.retryable).toBe(false);
	});

	const factories = [
		() => parseError(),
		() => invalidRequest(),
		() => methodNotFound("x"),
		() => invalidParams(),
		() => internalError(),
		() => unauthorized(),
		() => forbidden("client", "x"),
		() => missingIdempotencyKey("x"),
		() => duplicateRequest(),
		() => deviceRevoked("x"),
	];

	for (const factory of factories) {
		it(`${factory().message} is an RpcError`, () => {
			expect(factory()).toBeInstanceOf(RpcError);
			expect(factory()).toBeInstanceOf(Error);
		});
	}
});

describe("rateLimited", () => {
	it("returns correct code and is retryable", () => {
		const err = rateLimited();
		expect(err.code).toBe(RPC_ERROR_CODES.RATE_LIMITED);
		expect(err.message).toBe("Rate limit exceeded");
		expect(err.retryable).toBe(true);
	});

	it("accepts custom message", () => {
		const err = rateLimited("Custom rate limit message");
		expect(err.message).toBe("Custom rate limit message");
	});
});

describe("frameTooLarge", () => {
	it("returns correct code and is not retryable", () => {
		const err = frameTooLarge(2_000_000, 1_048_576);
		expect(err.code).toBe(RPC_ERROR_CODES.FRAME_TOO_LARGE);
		expect(err.message).toBe("Frame size 2000000 exceeds maximum 1048576");
		expect(err.retryable).toBe(false);
		expect(err.data).toEqual({ size: 2_000_000, maxSize: 1_048_576 });
	});
});
