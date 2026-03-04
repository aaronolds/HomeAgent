import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type IdempotencyState = "in_progress" | "completed" | "failed";

export interface IdempotencyRecord {
	key: string;
	state: IdempotencyState;
	response?: string;
	createdAt: number;
	expiresAt: number;
}

export interface IdempotencyStoreOptions {
	dbPath: string;
	ttlMs: number;
	cleanupIntervalMs: number;
	now?: () => number;
}

type IdempotencyRow = {
	key: string;
	state: IdempotencyState;
	response: string | null;
	created_at: number;
	expires_at: number;
};

export class SqliteIdempotencyStore {
	private readonly db: DatabaseSync;
	private readonly ttlMs: number;
	private readonly cleanupIntervalMs: number;
	private readonly now: () => number;
	private cleanupTimer: ReturnType<typeof setInterval> | undefined;

	private readonly getByKeyStatement: ReturnType<DatabaseSync["prepare"]>;
	private readonly deleteByKeyStatement: ReturnType<DatabaseSync["prepare"]>;
	private readonly insertStatement: ReturnType<DatabaseSync["prepare"]>;
	private readonly updateCompletedStatement: ReturnType<
		DatabaseSync["prepare"]
	>;
	private readonly updateFailedStatement: ReturnType<DatabaseSync["prepare"]>;
	private readonly cleanupStatement: ReturnType<DatabaseSync["prepare"]>;

	public constructor(options: IdempotencyStoreOptions) {
		const directoryPath = path.dirname(options.dbPath);
		mkdirSync(directoryPath, { recursive: true });

		this.db = new DatabaseSync(options.dbPath);
		this.db.exec("PRAGMA journal_mode = WAL;");
		this.db.exec("PRAGMA busy_timeout = 5000;");
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS idempotency_keys (
				key TEXT PRIMARY KEY,
				state TEXT NOT NULL DEFAULT 'in_progress',
				response TEXT,
				created_at INTEGER NOT NULL,
				expires_at INTEGER NOT NULL
			)
		`);
		this.db.exec(
			"CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys (expires_at)",
		);

		this.ttlMs = options.ttlMs;
		this.cleanupIntervalMs = options.cleanupIntervalMs;
		this.now = options.now ?? Date.now;

		this.getByKeyStatement = this.db.prepare(
			"SELECT key, state, response, created_at, expires_at FROM idempotency_keys WHERE key = ?",
		);
		this.deleteByKeyStatement = this.db.prepare(
			"DELETE FROM idempotency_keys WHERE key = ?",
		);
		this.insertStatement = this.db.prepare(
			"INSERT OR IGNORE INTO idempotency_keys (key, state, response, created_at, expires_at) VALUES (?, 'in_progress', NULL, ?, ?)",
		);
		this.updateCompletedStatement = this.db.prepare(
			"UPDATE idempotency_keys SET state = 'completed', response = ? WHERE key = ?",
		);
		this.updateFailedStatement = this.db.prepare(
			"UPDATE idempotency_keys SET state = 'failed', response = ? WHERE key = ?",
		);
		this.cleanupStatement = this.db.prepare(
			"DELETE FROM idempotency_keys WHERE expires_at < ?",
		);
	}

	public get(key: string): IdempotencyRecord | undefined {
		const row = this.getByKeyStatement.get(key) as IdempotencyRow | undefined;
		if (row === undefined) {
			return undefined;
		}

		if (row.expires_at < this.now()) {
			this.deleteByKeyStatement.run(key);
			return undefined;
		}

		const baseRecord = {
			key: row.key,
			state: row.state,
			createdAt: row.created_at,
			expiresAt: row.expires_at,
		};

		if (row.response === null) {
			return baseRecord;
		}

		return {
			...baseRecord,
			response: row.response,
		};
	}

	public create(key: string): boolean {
		const createdAt = this.now();
		const expiresAt = createdAt + this.ttlMs;

		const insertResult = this.insertStatement.run(
			key,
			createdAt,
			expiresAt,
		) as {
			changes: number;
			lastInsertRowid: number;
		};

		if (insertResult.changes > 0) {
			return true;
		}

		const existing = this.getByKeyStatement.get(key) as
			| IdempotencyRow
			| undefined;
		if (existing !== undefined && existing.expires_at < createdAt) {
			this.deleteByKeyStatement.run(key);
			const retryResult = this.insertStatement.run(
				key,
				createdAt,
				expiresAt,
			) as {
				changes: number;
				lastInsertRowid: number;
			};
			return retryResult.changes > 0;
		}

		return false;
	}

	public complete(key: string, response: unknown): void {
		this.updateCompletedStatement.run(JSON.stringify(response), key);
	}

	public fail(key: string, error: unknown): void {
		this.updateFailedStatement.run(JSON.stringify(error), key);
	}

	public cleanup(): number {
		const result = this.cleanupStatement.run(this.now()) as {
			changes: number;
			lastInsertRowid: number;
		};
		return result.changes;
	}

	public startCleanupTimer(): void {
		if (this.cleanupTimer !== undefined) {
			return;
		}

		this.cleanupTimer = setInterval(() => {
			this.cleanup();
		}, this.cleanupIntervalMs);

		const timer = this.cleanupTimer as { unref?: () => void } | number;
		if (
			typeof timer === "object" &&
			timer !== null &&
			"unref" in timer &&
			typeof timer.unref === "function"
		) {
			timer.unref();
		}
	}

	public stopCleanupTimer(): void {
		if (this.cleanupTimer === undefined) {
			return;
		}

		clearInterval(this.cleanupTimer);
		this.cleanupTimer = undefined;
	}

	public close(): void {
		this.stopCleanupTimer();
		this.db.close();
	}
}
