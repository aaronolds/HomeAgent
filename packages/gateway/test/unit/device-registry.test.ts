import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DeviceRegistry } from "../../src/state/device-registry.js";

describe("device-registry", () => {
	const tempDirs: string[] = [];

	afterEach(async () => {
		await Promise.all(
			tempDirs
				.splice(0, tempDirs.length)
				.map((dir) => rm(dir, { recursive: true, force: true })),
		);
	});

	async function createRegistry(): Promise<{
		registry: DeviceRegistry;
		dataDir: string;
	}> {
		const dataDir = await mkdtemp(join(tmpdir(), "homeagent-device-registry-"));
		tempDirs.push(dataDir);
		return {
			registry: new DeviceRegistry(dataDir),
			dataDir,
		};
	}

	it("registerDevice and getDevice round-trip", async () => {
		const { registry } = await createRegistry();

		await registry.registerDevice({
			deviceId: "device-1",
			name: "Test Device",
			sharedSecret: "secret-1",
			approved: false,
		});

		const device = await registry.getDevice("device-1");
		expect(device).toMatchObject({
			deviceId: "device-1",
			name: "Test Device",
			sharedSecret: "secret-1",
			approved: false,
		});
		expect(device?.createdAt).toBeTypeOf("number");
		expect(device?.updatedAt).toBeTypeOf("number");
	});

	it("isApproved returns false for unapproved device", async () => {
		const { registry } = await createRegistry();

		await registry.registerDevice({
			deviceId: "device-1",
			name: "Test Device",
			sharedSecret: "secret-1",
			approved: false,
		});

		expect(await registry.isApproved("device-1")).toBe(false);
	});

	it("approveDevice sets approved to true", async () => {
		const { registry } = await createRegistry();

		await registry.registerDevice({
			deviceId: "device-1",
			name: "Test Device",
			sharedSecret: "secret-1",
			approved: false,
		});

		expect(await registry.approveDevice("device-1")).toBe(true);
		expect(await registry.isApproved("device-1")).toBe(true);
	});

	it("getSharedSecret returns the shared secret", async () => {
		const { registry } = await createRegistry();

		await registry.registerDevice({
			deviceId: "device-1",
			name: "Test Device",
			sharedSecret: "secret-1",
			approved: false,
		});

		expect(await registry.getSharedSecret("device-1")).toBe("secret-1");
	});

	it("getDevice returns undefined for unknown device", async () => {
		const { registry } = await createRegistry();

		expect(await registry.getDevice("unknown-device")).toBeUndefined();
	});

	it("persists device records and reloads from disk", async () => {
		const { registry, dataDir } = await createRegistry();

		await registry.registerDevice({
			deviceId: "device-1",
			name: "Persisted Device",
			sharedSecret: "persisted-secret",
			approved: false,
		});
		await registry.approveDevice("device-1");

		const reloadedRegistry = new DeviceRegistry(dataDir);
		const device = await reloadedRegistry.getDevice("device-1");

		expect(device).toMatchObject({
			deviceId: "device-1",
			name: "Persisted Device",
			sharedSecret: "persisted-secret",
			approved: true,
		});
	});
});
