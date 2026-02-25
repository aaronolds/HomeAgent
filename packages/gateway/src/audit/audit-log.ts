import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AuditEvent } from "../state/types.js";

type FileSystem = Pick<
	typeof import("node:fs/promises"),
	"appendFile" | "mkdir"
>;

export class AuditLog {
	private readonly auditPath: string;
	private readonly fs: FileSystem;

	public constructor(dataDir: string, fs: FileSystem = { appendFile, mkdir }) {
		this.auditPath = join(dataDir, "audit.jsonl");
		this.fs = fs;
	}

	public async log(event: AuditEvent): Promise<void> {
		await this.fs.mkdir(dirname(this.auditPath), { recursive: true });
		await this.fs.appendFile(
			this.auditPath,
			`${JSON.stringify(event)}\n`,
			"utf8",
		);
	}
}

export function createAuthFailureEvent(
	deviceId: string,
	reason: string,
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "auth_failure",
		deviceId,
		details: { reason },
	};
}

export function createNonceReplayEvent(
	deviceId: string,
	nonce: string,
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "nonce_replay",
		deviceId,
		details: { nonce },
	};
}

export function createConnectionEvent(
	deviceId: string,
	action: "connected" | "disconnected",
): AuditEvent {
	return {
		timestamp: Date.now(),
		event: "connection",
		deviceId,
		details: { action },
	};
}
