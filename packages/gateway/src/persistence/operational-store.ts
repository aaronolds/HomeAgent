import { chmodSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { AgentRecord, DeviceRecord } from "../state/types.js";
import { MIGRATIONS } from "./migrations.js";

export interface OperationalStoreOptions {
	dbPath: string;
	now?: () => number;
}

type DeviceRow = {
	device_id: string;
	name: string | null;
	shared_secret: string;
	role: string;
	approved: number;
	revoked: number;
	revoked_at: number | null;
	created_at: number;
	updated_at: number;
};

type AgentRow = {
	agent_id: string;
	name: string | null;
	model: string | null;
	system_prompt: string | null;
	created_at: number;
	updated_at: number;
};

type SchemaVersionRow = {
	version: number;
	applied_at: number;
};

function deviceRowToRecord(row: DeviceRow): DeviceRecord {
	const record: DeviceRecord = {
		deviceId: row.device_id,
		sharedSecret: row.shared_secret,
		role: row.role as DeviceRecord["role"],
		approved: row.approved === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
	if (row.name !== null) {
		record.name = row.name;
	}
	if (row.revoked === 1) {
		record.revoked = true;
	}
	if (row.revoked_at !== null) {
		record.revokedAt = row.revoked_at;
	}
	return record;
}

function agentRowToRecord(row: AgentRow): AgentRecord {
	const record: AgentRecord = {
		agentId: row.agent_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
	if (row.name !== null) {
		record.name = row.name;
	}
	if (row.model !== null) {
		record.model = row.model;
	}
	if (row.system_prompt !== null) {
		record.systemPrompt = row.system_prompt;
	}
	return record;
}

export class OperationalStore {
	private readonly db: DatabaseSync;
	private readonly now: () => number;
	private closed = false;

	private readonly getDeviceStmt: ReturnType<DatabaseSync["prepare"]>;
	private readonly insertDeviceStmt: ReturnType<DatabaseSync["prepare"]>;
	private readonly approveDeviceStmt: ReturnType<DatabaseSync["prepare"]>;
	private readonly revokeDeviceStmt: ReturnType<DatabaseSync["prepare"]>;
	private readonly listDevicesStmt: ReturnType<DatabaseSync["prepare"]>;

	private readonly getAgentStmt: ReturnType<DatabaseSync["prepare"]>;
	private readonly insertAgentStmt: ReturnType<DatabaseSync["prepare"]>;
	private readonly listAgentsStmt: ReturnType<DatabaseSync["prepare"]>;

	public constructor(options: OperationalStoreOptions) {
		const directoryPath = path.dirname(options.dbPath);
		mkdirSync(directoryPath, { recursive: true });

		this.now = options.now ?? Date.now;
		this.db = new DatabaseSync(options.dbPath);

		// Secure file permissions
		if (existsSync(options.dbPath)) {
			chmodSync(options.dbPath, 0o600);
		}

		this.db.exec("PRAGMA journal_mode = WAL;");
		this.db.exec("PRAGMA busy_timeout = 5000;");

		this.runMigrations();

		this.getDeviceStmt = this.db.prepare(
			"SELECT device_id, name, shared_secret, role, approved, revoked, revoked_at, created_at, updated_at FROM devices WHERE device_id = ?",
		);
		this.insertDeviceStmt = this.db.prepare(
			"INSERT INTO devices (device_id, name, shared_secret, role, approved, revoked, revoked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		);
		this.approveDeviceStmt = this.db.prepare(
			"UPDATE devices SET approved = 1, updated_at = ? WHERE device_id = ?",
		);
		this.revokeDeviceStmt = this.db.prepare(
			"UPDATE devices SET revoked = 1, revoked_at = ?, updated_at = ? WHERE device_id = ?",
		);
		this.listDevicesStmt = this.db.prepare(
			"SELECT device_id, name, shared_secret, role, approved, revoked, revoked_at, created_at, updated_at FROM devices",
		);

		this.getAgentStmt = this.db.prepare(
			"SELECT agent_id, name, model, system_prompt, created_at, updated_at FROM agents WHERE agent_id = ?",
		);
		this.insertAgentStmt = this.db.prepare(
			"INSERT INTO agents (agent_id, name, model, system_prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		);
		this.listAgentsStmt = this.db.prepare(
			"SELECT agent_id, name, model, system_prompt, created_at, updated_at FROM agents",
		);
	}

	// === Device Operations ===

	public getDevice(deviceId: string): DeviceRecord | undefined {
		const row = this.getDeviceStmt.get(deviceId) as DeviceRow | undefined;
		if (row === undefined) {
			return undefined;
		}
		return deviceRowToRecord(row);
	}

	public registerDevice(
		device: Omit<DeviceRecord, "createdAt" | "updatedAt">,
	): DeviceRecord {
		const timestamp = this.now();
		this.insertDeviceStmt.run(
			device.deviceId,
			device.name ?? null,
			device.sharedSecret,
			device.role,
			device.approved ? 1 : 0,
			device.revoked ? 1 : 0,
			device.revokedAt ?? null,
			timestamp,
			timestamp,
		);
		return {
			...device,
			createdAt: timestamp,
			updatedAt: timestamp,
		};
	}

	public approveDevice(deviceId: string): DeviceRecord | undefined {
		const timestamp = this.now();
		const result = this.approveDeviceStmt.run(timestamp, deviceId) as {
			changes: number;
		};
		if (result.changes === 0) {
			return undefined;
		}
		return this.getDevice(deviceId);
	}

	public revokeDevice(deviceId: string): DeviceRecord | undefined {
		const timestamp = this.now();
		const result = this.revokeDeviceStmt.run(
			timestamp,
			timestamp,
			deviceId,
		) as {
			changes: number;
		};
		if (result.changes === 0) {
			return undefined;
		}
		return this.getDevice(deviceId);
	}

	public listDevices(): DeviceRecord[] {
		const rows = this.listDevicesStmt.all() as DeviceRow[];
		return rows.map(deviceRowToRecord);
	}

	// === Agent Operations ===

	public getAgent(agentId: string): AgentRecord | undefined {
		const row = this.getAgentStmt.get(agentId) as AgentRow | undefined;
		if (row === undefined) {
			return undefined;
		}
		return agentRowToRecord(row);
	}

	public registerAgent(
		agent: Omit<AgentRecord, "createdAt" | "updatedAt">,
	): AgentRecord {
		const timestamp = this.now();
		this.insertAgentStmt.run(
			agent.agentId,
			agent.name ?? null,
			agent.model ?? null,
			agent.systemPrompt ?? null,
			timestamp,
			timestamp,
		);
		return {
			...agent,
			createdAt: timestamp,
			updatedAt: timestamp,
		};
	}

	public updateAgent(
		agentId: string,
		updates: Partial<Pick<AgentRecord, "name" | "model" | "systemPrompt">>,
	): AgentRecord | undefined {
		const existing = this.getAgent(agentId);
		if (existing === undefined) {
			return undefined;
		}

		const timestamp = this.now();
		const setClauses: string[] = ["updated_at = ?"];
		const params: (string | number | null)[] = [timestamp];

		if (updates.name !== undefined) {
			setClauses.push("name = ?");
			params.push(updates.name);
		}
		if (updates.model !== undefined) {
			setClauses.push("model = ?");
			params.push(updates.model);
		}
		if (updates.systemPrompt !== undefined) {
			setClauses.push("system_prompt = ?");
			params.push(updates.systemPrompt);
		}

		params.push(agentId);
		const stmt = this.db.prepare(
			`UPDATE agents SET ${setClauses.join(", ")} WHERE agent_id = ?`,
		);
		stmt.run(...params);

		return this.getAgent(agentId);
	}

	public listAgents(): AgentRecord[] {
		const rows = this.listAgentsStmt.all() as AgentRow[];
		return rows.map(agentRowToRecord);
	}

	// === Transaction Support ===

	public transaction<T>(fn: () => T): T {
		this.db.exec("BEGIN IMMEDIATE");
		try {
			const result = fn();
			this.db.exec("COMMIT");
			return result;
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}

	// === Migration ===

	private runMigrations(): void {
		// Ensure schema_version table exists first
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS schema_version (
				version INTEGER PRIMARY KEY,
				applied_at INTEGER NOT NULL
			);
		`);

		const appliedVersions = new Set<number>();
		const rows = this.db
			.prepare("SELECT version FROM schema_version")
			.all() as SchemaVersionRow[];
		for (const row of rows) {
			appliedVersions.add(row.version);
		}

		const insertVersion = this.db.prepare(
			"INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
		);

		for (const migration of MIGRATIONS) {
			if (appliedVersions.has(migration.version)) {
				continue;
			}
			this.db.exec(migration.up);
			insertVersion.run(migration.version, this.now());
		}
	}

	// === Lifecycle ===

	public close(): void {
		if (this.closed) {
			return;
		}
		this.closed = true;
		this.db.close();
	}
}
