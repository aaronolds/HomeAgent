import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateDevicesFromJson } from "../../src/persistence/migrate-devices.js";
import { OperationalStore } from "../../src/persistence/operational-store.js";

describe("migrateDevicesFromJson", () => {
	let tempDir: string;
	let store: OperationalStore;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "migrate-test-"));
		store = new OperationalStore({
			dbPath: join(tempDir, "test.db"),
			now: () => 1_000_000,
		});
	});

	afterEach(() => {
		store.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("migrates devices from a valid JSON file", () => {
		const jsonPath = join(tempDir, "devices.json");
		const devices = [
			{
				deviceId: "dev-1",
				sharedSecret: "s1",
				role: "client",
				approved: true,
			},
			{
				deviceId: "dev-2",
				name: "Phone",
				sharedSecret: "s2",
				role: "admin",
				approved: false,
			},
		];
		writeFileSync(jsonPath, JSON.stringify(devices));

		const result = migrateDevicesFromJson({ jsonPath, store });

		expect(result.migrated).toBe(2);
		expect(result.skipped).toBe(false);
		expect(result.errors).toEqual([]);
		expect(store.getDevice("dev-1")).toBeDefined();
		expect(store.getDevice("dev-2")?.name).toBe("Phone");
		expect(existsSync(jsonPath)).toBe(false);
		expect(existsSync(`${jsonPath}.migrated`)).toBe(true);
	});

	it("returns skipped when JSON file does not exist", () => {
		const result = migrateDevicesFromJson({
			jsonPath: join(tempDir, "nonexistent.json"),
			store,
		});

		expect(result.migrated).toBe(0);
		expect(result.skipped).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("returns skipped when .migrated file already exists", () => {
		const jsonPath = join(tempDir, "devices.json");
		writeFileSync(`${jsonPath}.migrated`, "done");

		const result = migrateDevicesFromJson({ jsonPath, store });

		expect(result.migrated).toBe(0);
		expect(result.skipped).toBe(true);
	});

	it("returns error for invalid JSON", () => {
		const jsonPath = join(tempDir, "devices.json");
		writeFileSync(jsonPath, "not-json{{{");

		const result = migrateDevicesFromJson({ jsonPath, store });

		expect(result.migrated).toBe(0);
		expect(result.skipped).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("Failed to parse");
		// File should NOT be renamed on parse failure
		expect(existsSync(jsonPath)).toBe(true);
	});

	it("handles duplicate devices as errors", () => {
		// Pre-register a device
		store.registerDevice({
			deviceId: "dev-1",
			sharedSecret: "existing",
			role: "client",
			approved: false,
		});

		const jsonPath = join(tempDir, "devices.json");
		const devices = [
			{
				deviceId: "dev-1",
				sharedSecret: "s1",
				role: "client",
				approved: true,
			},
			{
				deviceId: "dev-new",
				sharedSecret: "s2",
				role: "client",
				approved: false,
			},
		];
		writeFileSync(jsonPath, JSON.stringify(devices));

		const result = migrateDevicesFromJson({ jsonPath, store });

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]).toContain("dev-1");
	});
});
