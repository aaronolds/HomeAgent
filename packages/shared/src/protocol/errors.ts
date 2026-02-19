/**
 * Base class for protocol validation errors.
 */
export class ProtocolValidationError extends Error {
	public readonly issues: readonly ProtocolIssue[];

	constructor(message: string, issues: readonly ProtocolIssue[]) {
		super(message);
		this.name = "ProtocolValidationError";
		this.issues = issues;
	}
}

/**
 * Error thrown when a required idempotency key is missing.
 */
export class IdempotencyKeyError extends ProtocolValidationError {
	public readonly method: string;

	constructor(method: string) {
		super(`Idempotency key is required for method "${method}"`, [
			{ path: ["idempotencyKey"], message: `Required for method "${method}"` },
		]);
		this.name = "IdempotencyKeyError";
		this.method = method;
	}
}

/**
 * A single validation issue with path info.
 */
export interface ProtocolIssue {
	readonly path: readonly (string | number)[];
	readonly message: string;
}
