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

export interface AgentRecord {
	agentId: string;
	name?: string;
	model?: string;
	systemPrompt?: string;
	createdAt: number;
	updatedAt: number;
}

export type NonceEntry = {
	nonce: string;
	deviceId: string;
	timestamp: number;
};

export type AuditEventType =
	| "auth_failure"
	| "auth_success"
	| "nonce_replay"
	| "connection"
	| "device_registered"
	| "device_approved"
	| "device_revoked"
	| "rpc_denied"
	| "exec_approval"
	| "plugin_disabled"
	| "secret_accessed"
	| "secret_stored"
	| "file_access_violation"
	| "transcript_write_error";

export type AuditOutcome = "success" | "failure" | "denied";

export interface AuditEvent {
	timestamp: number;
	event: AuditEventType;
	actor?: string;
	outcome: AuditOutcome;
	deviceId?: string;
	details?: Record<string, unknown>;
}
