import type { Role } from "@homeagent/shared";

export type DeviceRecord = {
	deviceId: string;
	name?: string;
	sharedSecret: string;
	role: Role;
	approved: boolean;
	revoked?: boolean;
	revokedAt?: number;
	createdAt: number;
	updatedAt: number;
};

export type NonceEntry = {
	nonce: string;
	deviceId: string;
	timestamp: number;
};

export type AuditEvent = {
	timestamp: number;
	event: string;
	deviceId?: string;
	details?: Record<string, unknown>;
};
