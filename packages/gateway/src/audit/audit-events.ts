import type { AuditEvent } from "../state/types.js";

export function authFailureEvent(deviceId: string, reason: string): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "auth_failure",
		outcome: "failure",
		deviceId,
		details: { reason },
	};
}

export function authSuccessEvent(deviceId: string): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "auth_success",
		outcome: "success",
		deviceId,
	};
}

export function nonceReplayEvent(deviceId: string, nonce: string): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "nonce_replay",
		outcome: "failure",
		deviceId,
		details: { nonce },
	};
}

export function connectionEvent(
	deviceId: string,
	action: "connected" | "disconnected",
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "connection",
		outcome: "success",
		deviceId,
		details: { action },
	};
}

export function deviceRegisteredEvent(
	deviceId: string,
	actor?: string,
): AuditEvent {
	const event: AuditEvent = {
		timestamp: Date.now(),
		event: "device_registered",
		outcome: "success",
		deviceId,
	};
	if (actor !== undefined) {
		event.actor = actor;
	}
	return event;
}

export function deviceApprovedEvent(
	deviceId: string,
	actor: string,
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "device_approved",
		outcome: "success",
		deviceId,
		actor,
	};
}

export function deviceRevokedEvent(
	deviceId: string,
	actor: string,
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "device_revoked",
		outcome: "success",
		deviceId,
		actor,
	};
}

export function rpcDeniedEvent(
	deviceId: string,
	method: string,
	reason: string,
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "rpc_denied",
		outcome: "denied",
		deviceId,
		details: { method, reason },
	};
}

export function execApprovalEvent(
	deviceId: string,
	requestId: string,
	approved: boolean,
	actor: string,
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "exec_approval",
		outcome: approved ? "success" : "denied",
		deviceId,
		actor,
		details: { requestId, approved },
	};
}

export function pluginDisabledEvent(
	pluginId: string,
	actor: string,
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "plugin_disabled",
		outcome: "success",
		actor,
		details: { pluginId },
	};
}

export function secretAccessedEvent(key: string, actor: string): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "secret_accessed",
		outcome: "success",
		actor,
		details: { key },
	};
}

export function secretStoredEvent(key: string, actor: string): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "secret_stored",
		outcome: "success",
		actor,
		details: { key },
	};
}

export function fileAccessViolationEvent(
	path: string,
	deviceId: string,
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "file_access_violation",
		outcome: "denied",
		deviceId,
		details: { path },
	};
}

export function transcriptWriteErrorEvent(
	sessionId: string,
	error: string,
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "transcript_write_error",
		outcome: "failure",
		details: { sessionId, error },
	};
}
