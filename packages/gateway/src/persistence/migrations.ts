export interface Migration {
	version: number;
	description: string;
	up: string;
}

export const MIGRATIONS: Migration[] = [
	{
		version: 1,
		description: "Create devices table",
		up: `
			CREATE TABLE IF NOT EXISTS devices (
				device_id TEXT PRIMARY KEY,
				name TEXT,
				shared_secret TEXT NOT NULL,
				role TEXT NOT NULL DEFAULT 'client',
				approved INTEGER NOT NULL DEFAULT 0,
				revoked INTEGER NOT NULL DEFAULT 0,
				revoked_at INTEGER,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
		`,
	},
	{
		version: 2,
		description: "Create agents table",
		up: `
			CREATE TABLE IF NOT EXISTS agents (
				agent_id TEXT PRIMARY KEY,
				name TEXT,
				model TEXT,
				system_prompt TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
		`,
	},
	{
		version: 3,
		description: "Create schema_version table",
		up: `
			CREATE TABLE IF NOT EXISTS schema_version (
				version INTEGER PRIMARY KEY,
				applied_at INTEGER NOT NULL
			);
		`,
	},
];
