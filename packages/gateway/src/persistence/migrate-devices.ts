import { existsSync, readFileSync, renameSync } from "node:fs";

import type { OperationalStore } from "./operational-store.js";

export interface MigrateDevicesOptions {
	/** Path to devices.json file */
	jsonPath: string;
	/** OperationalStore to import into */
	store: OperationalStore;
}

export interface MigrationResult {
	migrated: number;
	skipped: boolean;
	errors: string[];
}

export function migrateDevicesFromJson(
	options: MigrateDevicesOptions,
): MigrationResult {
	const { jsonPath, store } = options;
	const migratedPath = `${jsonPath}.migrated`;

	// Already migrated
	if (existsSync(migratedPath)) {
		return { migrated: 0, skipped: true, errors: [] };
	}

	// Source file doesn't exist
	if (!existsSync(jsonPath)) {
		return { migrated: 0, skipped: true, errors: [] };
	}

	// Parse JSON
	let records: unknown[];
	try {
		const raw = readFileSync(jsonPath, "utf8");
		records = JSON.parse(raw) as unknown[];
	} catch {
		return {
			migrated: 0,
			skipped: false,
			errors: ["Failed to parse devices.json"],
		};
	}

	if (!Array.isArray(records)) {
		return {
			migrated: 0,
			skipped: false,
			errors: ["devices.json does not contain an array"],
		};
	}

	let migrated = 0;
	const errors: string[] = [];

	store.transaction(() => {
		for (const record of records) {
			const device = record as Record<string, unknown>;
			try {
				const input: Parameters<typeof store.registerDevice>[0] = {
					deviceId: device.deviceId as string,
					sharedSecret: device.sharedSecret as string,
					role: (device.role as "admin" | "node" | "client") ?? "client",
					approved: (device.approved as boolean) ?? false,
				};
				if (typeof device.name === "string") {
					input.name = device.name;
				}
				if (typeof device.revoked === "boolean") {
					input.revoked = device.revoked;
				}
				if (typeof device.revokedAt === "number") {
					input.revokedAt = device.revokedAt;
				}
				store.registerDevice(input);
				migrated++;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				errors.push(`Failed to migrate device ${device.deviceId}: ${message}`);
			}
		}
	});

	// Only rename if we actually processed something (even with some errors)
	if (errors.length === 0 || migrated > 0) {
		renameSync(jsonPath, migratedPath);
	}

	return { migrated, skipped: false, errors };
}
