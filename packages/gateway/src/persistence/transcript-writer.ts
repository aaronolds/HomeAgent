import {
	closeSync,
	constants,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	writeSync,
} from "node:fs";
import { dirname, join } from "node:path";

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export interface TranscriptEntry {
	ts: number;
	type: "request" | "response" | "event" | "error" | "system";
	data: unknown;
}

export interface TranscriptWriterOptions {
	/** Base data directory, e.g. ~/.homeagent */
	dataDir: string;
	/** Agent ID for path construction */
	agentId: string;
	/** Session ID for path construction */
	sessionId: string;
	/** Whether to call fsyncSync() after each write for crash safety. Default: true */
	fsync?: boolean;
	/** Optional callback for error reporting (e.g., to audit log) */
	onError?: (error: Error) => void;
	/** Injectable clock for testing */
	now?: () => number;
}

export class TranscriptWriter {
	private fd: number | null = null;
	private readonly filePath: string;
	private readonly fsync: boolean;
	private readonly onError: ((error: Error) => void) | undefined;
	private readonly now: () => number;

	public constructor(options: TranscriptWriterOptions) {
		this.filePath = join(
			options.dataDir,
			"agents",
			options.agentId,
			"sessions",
			`${options.sessionId}.jsonl`,
		);
		this.fsync = options.fsync ?? true;
		this.onError = options.onError;
		this.now = options.now ?? Date.now;
	}

	/** Append a transcript entry. Opens file on first call. */
	public append(entry: Omit<TranscriptEntry, "ts"> | TranscriptEntry): void {
		const record: TranscriptEntry = {
			ts: "ts" in entry && typeof entry.ts === "number" ? entry.ts : this.now(),
			type: entry.type,
			data: entry.data,
		};

		try {
			if (this.fd === null) {
				mkdirSync(dirname(this.filePath), { recursive: true, mode: DIR_MODE });
				this.fd = openSync(
					this.filePath,
					constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND,
					FILE_MODE,
				);
			}

			const line = `${JSON.stringify(record)}\n`;
			writeSync(this.fd, line);

			if (this.fsync) {
				fsyncSync(this.fd);
			}
		} catch (error) {
			if (this.onError && error instanceof Error) {
				this.onError(error);
			} else {
				throw error;
			}
		}
	}

	/** Get the file path for this transcript */
	public get path(): string {
		return this.filePath;
	}

	/** Close the file descriptor */
	public close(): void {
		if (this.fd !== null) {
			closeSync(this.fd);
			this.fd = null;
		}
	}

	/**
	 * Static recovery method: read a transcript file and return parsed entries.
	 * Discards incomplete last line (crash recovery).
	 */
	public static recover(filePath: string): {
		entries: TranscriptEntry[];
		truncated: boolean;
	} {
		const content = readFileSync(filePath, "utf8");
		const lines = content.split("\n").filter((line) => line.length > 0);
		const entries: TranscriptEntry[] = [];
		let truncated = false;

		for (const line of lines) {
			try {
				entries.push(JSON.parse(line) as TranscriptEntry);
			} catch {
				truncated = true;
			}
		}

		return { entries, truncated };
	}
}
