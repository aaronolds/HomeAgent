export type DeviceRecord = {
	deviceId: string;
	name: string;
	sharedSecret: string;
	approved: boolean;
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
