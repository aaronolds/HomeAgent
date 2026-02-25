import {
	JsonWebTokenError,
	sign,
	TokenExpiredError,
	verify,
} from "jsonwebtoken";

import { AuthError } from "./errors.js";

export interface SessionTokenPayload {
	deviceId: string;
	connectionId: string;
	role: string;
	iat: number;
	exp: number;
}

export function issueSessionToken(params: {
	deviceId: string;
	connectionId: string;
	role?: string;
	jwtSecret: string;
	ttlMs: number;
}): string {
	const { deviceId, connectionId, role, jwtSecret, ttlMs } = params;
	return sign(
		{
			deviceId,
			connectionId,
			role: role ?? "device",
		},
		jwtSecret,
		{ expiresIn: Math.floor(ttlMs / 1000) },
	);
}

export function verifySessionToken(
	token: string,
	jwtSecret: string,
): SessionTokenPayload {
	try {
		const decoded = verify(token, jwtSecret);
		if (typeof decoded !== "object" || decoded === null) {
			throw new AuthError("INVALID_TOKEN", "Session token payload is invalid.");
		}

		const { deviceId, connectionId, role, iat, exp } = decoded;
		if (
			typeof deviceId !== "string" ||
			typeof connectionId !== "string" ||
			typeof role !== "string" ||
			typeof iat !== "number" ||
			typeof exp !== "number"
		) {
			throw new AuthError("INVALID_TOKEN", "Session token payload is invalid.");
		}

		return { deviceId, connectionId, role, iat, exp };
	} catch (error: unknown) {
		if (error instanceof AuthError) {
			throw error;
		}

		if (error instanceof TokenExpiredError) {
			throw new AuthError("EXPIRED_TOKEN", "Session token has expired.");
		}

		if (error instanceof JsonWebTokenError) {
			throw new AuthError("INVALID_TOKEN", "Session token is invalid.");
		}

		throw error;
	}
}

export function refreshSessionToken(
	token: string,
	jwtSecret: string,
	ttlMs: number,
): string {
	const payload = verifySessionToken(token, jwtSecret);

	return issueSessionToken({
		deviceId: payload.deviceId,
		connectionId: payload.connectionId,
		role: payload.role,
		jwtSecret,
		ttlMs,
	});
}
