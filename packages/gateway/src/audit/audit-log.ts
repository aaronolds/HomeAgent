import { appendFile, mkdir, open } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AuditEvent } from "../state/types.js";
import { redactFields } from "./redact.js";

type FileSystem = Pick<
	typeof import("node:fs/promises"),
	"appendFile" | "mkdir" | "open"
>;

export interface AuditLogOptions {
	datasync?: boolean;
}

export class AuditLog {
	private readonly auditPath: string;
	private readonly fs: FileSystem;
	private readonly datasync: boolean;

	public constructor(
		dataDir: string,
		options?: AuditLogOptions,
		fs: FileSystem = { appendFile, mkdir, open },
	) {
		this.auditPath = join(dataDir, "audit.jsonl");
		this.fs = fs;
		this.datasync = options?.datasync ?? false;
	}

	public async log(event: AuditEvent): Promise<void> {
		const redacted: AuditEvent = event.details
			? { ...event, details: redactFields(event.details) }
			: event;

		await this.fs.mkdir(dirname(this.auditPath), { recursive: true });
		const line = `${JSON.stringify(redacted)}\n`;

		if (this.datasync) {
			const fh = await this.fs.open(this.auditPath, "a");
			try {
				await fh.write(line, undefined, "utf8");
				await fh.datasync();
			} finally {
				await fh.close();
			}
		} else {
			await this.fs.appendFile(this.auditPath, line, "utf8");
		}
	}
}

// Backward-compatible factory aliases
export {
	authFailureEvent as createAuthFailureEvent,
	connectionEvent as createConnectionEvent,
	nonceReplayEvent as createNonceReplayEvent,
} from "./audit-events.js";
