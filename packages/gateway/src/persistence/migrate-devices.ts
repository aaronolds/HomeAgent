import { existsSync, readFileSync, renameSync } from "node:fs";
import { ROLES } from "@homeagent/shared";

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
				// Validate required string fields
				if (
					typeof device.deviceId !== "string" ||
					device.deviceId.length === 0
				) {
					errors.push(
						`Skipping record: 'deviceId' must be a non-empty string (got ${JSON.stringify(device.deviceId)})`,
					);
					continue;
				}
				if (
					typeof device.sharedSecret !== "string" ||
					device.sharedSecret.length === 0
				) {
					errors.push(
						`Skipping record ${device.deviceId}: 'sharedSecret' must be a non-empty string`,
					);
					continue;
				}
				// Validate role against the allowed set; default to "client"
				const rawRole = device.role ?? "client";
				if (!ROLES.includes(rawRole as (typeof ROLES)[number])) {
					errors.push(
						`Skipping record ${device.deviceId}: 'role' must be one of ${ROLES.join(", ")} (got ${JSON.stringify(rawRole)})`,
					);
					continue;
				}
				const input: Parameters<typeof store.registerDevice>[0] = {
					deviceId: device.deviceId,
					sharedSecret: device.sharedSecret,
					role: rawRole as "admin" | "node" | "client",
					// Treat any truthy value (boolean true or numeric 1 from legacy SQLite exports) as approved
					approved: Boolean(device.approved),
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

	// Only rename when all records migrated without errors; keep the source file
	// when errors occurred so it can be manually remediated and retried.
	if (errors.length === 0) {
		renameSync(jsonPath, migratedPath);
	}

	return { migrated, skipped: false, errors };
}
