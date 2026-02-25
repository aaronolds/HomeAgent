export type AuthErrorCode =
	| "INVALID_HMAC"
	| "STALE_TIMESTAMP"
	| "REPLAYED_NONCE"
	| "UNAPPROVED_DEVICE"
	| "UNKNOWN_DEVICE"
	| "INVALID_TOKEN"
	| "EXPIRED_TOKEN";

export class AuthError extends Error {
	public readonly code: AuthErrorCode;
	public readonly deviceId?: string;

	public constructor(code: AuthErrorCode, message: string, deviceId?: string) {
		super(message);
		this.name = "AuthError";
		this.code = code;
		if (deviceId !== undefined) {
			this.deviceId = deviceId;
		}
	}
}
