import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OperationalStore } from "../../src/persistence/operational-store.js";

describe("OperationalStore", () => {
	let store: OperationalStore;
	let tempDir: string;
	let currentTime: number;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "opstore-test-"));
		currentTime = 1_000_000;
		store = new OperationalStore({
			dbPath: join(tempDir, "test.db"),
			now: () => currentTime,
		});
	});

	afterEach(() => {
		store.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("Device CRUD", () => {
		it("registers a device and gets it back with all fields", () => {
			const device = store.registerDevice({
				deviceId: "dev-1",
				name: "Test Device",
				sharedSecret: "secret-abc",
				role: "client",
				approved: false,
			});

			expect(device.deviceId).toBe("dev-1");
			expect(device.name).toBe("Test Device");
			expect(device.sharedSecret).toBe("secret-abc");
			expect(device.role).toBe("client");
			expect(device.approved).toBe(false);
			expect(device.createdAt).toBe(1_000_000);
			expect(device.updatedAt).toBe(1_000_000);

			const fetched = store.getDevice("dev-1");
			expect(fetched).toBeDefined();
			expect(fetched?.deviceId).toBe("dev-1");
			expect(fetched?.name).toBe("Test Device");
			expect(fetched?.sharedSecret).toBe("secret-abc");
			expect(fetched?.role).toBe("client");
			expect(fetched?.approved).toBe(false);
		});

		it("registers a device with minimal fields", () => {
			const device = store.registerDevice({
				deviceId: "dev-min",
				sharedSecret: "secret-min",
				role: "client",
				approved: true,
			});

			expect(device.deviceId).toBe("dev-min");
			expect(device.name).toBeUndefined();
			expect(device.approved).toBe(true);

			const fetched = store.getDevice("dev-min");
			expect(fetched?.name).toBeUndefined();
		});

		it("returns undefined for a non-existent device", () => {
			expect(store.getDevice("nonexistent")).toBeUndefined();
		});

		it("approves a device", () => {
			store.registerDevice({
				deviceId: "dev-1",
				sharedSecret: "secret",
				role: "client",
				approved: false,
			});

			currentTime = 2_000_000;
			const approved = store.approveDevice("dev-1");

			expect(approved).toBeDefined();
			expect(approved?.approved).toBe(true);
			expect(approved?.updatedAt).toBe(2_000_000);
		});

		it("revokes a device", () => {
			store.registerDevice({
				deviceId: "dev-1",
				sharedSecret: "secret",
				role: "client",
				approved: true,
			});

			currentTime = 3_000_000;
			const revoked = store.revokeDevice("dev-1");

			expect(revoked).toBeDefined();
			expect(revoked?.revoked).toBe(true);
			expect(revoked?.revokedAt).toBe(3_000_000);
			expect(revoked?.updatedAt).toBe(3_000_000);
		});

		it("returns undefined when approving a non-existent device", () => {
			expect(store.approveDevice("nonexistent")).toBeUndefined();
		});

		it("returns undefined when revoking a non-existent device", () => {
			expect(store.revokeDevice("nonexistent")).toBeUndefined();
		});

		it("lists all devices", () => {
			expect(store.listDevices()).toEqual([]);

			store.registerDevice({
				deviceId: "dev-1",
				sharedSecret: "s1",
				role: "client",
				approved: false,
			});
			store.registerDevice({
				deviceId: "dev-2",
				sharedSecret: "s2",
				role: "admin",
				approved: true,
			});

			const devices = store.listDevices();
			expect(devices).toHaveLength(2);
			const ids = devices.map((d) => d.deviceId);
			expect(ids).toContain("dev-1");
			expect(ids).toContain("dev-2");
		});
	});

	describe("Agent CRUD", () => {
		it("registers an agent and gets it back", () => {
			const agent = store.registerAgent({
				agentId: "agent-1",
				name: "Test Agent",
				model: "gpt-4",
				systemPrompt: "You are helpful.",
			});

			expect(agent.agentId).toBe("agent-1");
			expect(agent.name).toBe("Test Agent");
			expect(agent.model).toBe("gpt-4");
			expect(agent.systemPrompt).toBe("You are helpful.");
			expect(agent.createdAt).toBe(1_000_000);

			const fetched = store.getAgent("agent-1");
			expect(fetched).toBeDefined();
			expect(fetched?.agentId).toBe("agent-1");
			expect(fetched?.model).toBe("gpt-4");
		});

		it("updates agent fields", () => {
			store.registerAgent({
				agentId: "agent-1",
				name: "Old Name",
				model: "gpt-3.5",
			});

			currentTime = 2_000_000;
			const updated = store.updateAgent("agent-1", {
				name: "New Name",
				model: "gpt-4",
			});

			expect(updated).toBeDefined();
			expect(updated?.name).toBe("New Name");
			expect(updated?.model).toBe("gpt-4");
			expect(updated?.updatedAt).toBe(2_000_000);
		});

		it("returns undefined when updating a non-existent agent", () => {
			expect(store.updateAgent("nonexistent", { name: "x" })).toBeUndefined();
		});

		it("lists agents", () => {
			expect(store.listAgents()).toEqual([]);

			store.registerAgent({ agentId: "a1" });
			store.registerAgent({ agentId: "a2", name: "Agent 2" });

			const agents = store.listAgents();
			expect(agents).toHaveLength(2);
		});

		it("returns undefined for a non-existent agent", () => {
			expect(store.getAgent("nonexistent")).toBeUndefined();
		});
	});

	describe("Transactions", () => {
		it("commits on success", () => {
			store.transaction(() => {
				store.registerDevice({
					deviceId: "tx-dev",
					sharedSecret: "s",
					role: "client",
					approved: false,
				});
			});

			expect(store.getDevice("tx-dev")).toBeDefined();
		});

		it("rolls back on failure", () => {
			expect(() => {
				store.transaction(() => {
					store.registerDevice({
						deviceId: "tx-fail",
						sharedSecret: "s",
						role: "client",
						approved: false,
					});
					throw new Error("abort");
				});
			}).toThrow("abort");

			expect(store.getDevice("tx-fail")).toBeUndefined();
		});

		it("supports nested operations", () => {
			store.transaction(() => {
				store.registerDevice({
					deviceId: "nested-1",
					sharedSecret: "s1",
					role: "client",
					approved: false,
				});
				store.registerAgent({ agentId: "nested-a1" });
			});

			expect(store.getDevice("nested-1")).toBeDefined();
			expect(store.getAgent("nested-a1")).toBeDefined();
		});
	});

	describe("Schema", () => {
		it("enables WAL mode", () => {
			const dbPath = join(tempDir, "test.db");
			const db = new DatabaseSync(dbPath);
			const row = db.prepare("PRAGMA journal_mode").get() as {
				journal_mode: string;
			};
			expect(row.journal_mode).toBe("wal");
			db.close();
		});

		it("sets file permissions to 0o600", () => {
			const dbPath = join(tempDir, "test.db");
			const stat = statSync(dbPath);
			const mode = stat.mode & 0o777;
			expect(mode).toBe(0o600);
		});

		it("runs migrations only once", () => {
			const dbPath = join(tempDir, "reuse.db");
			const store1 = new OperationalStore({
				dbPath,
				now: () => currentTime,
			});

			store1.registerDevice({
				deviceId: "persist",
				sharedSecret: "s",
				role: "client",
				approved: false,
			});
			store1.close();

			const store2 = new OperationalStore({
				dbPath,
				now: () => currentTime,
			});
			expect(store2.getDevice("persist")).toBeDefined();
			store2.close();
		});
	});

	describe("Injectable clock", () => {
		it("uses custom now() for timestamps", () => {
			currentTime = 42_000;
			const device = store.registerDevice({
				deviceId: "clock-dev",
				sharedSecret: "s",
				role: "client",
				approved: false,
			});

			expect(device.createdAt).toBe(42_000);
			expect(device.updatedAt).toBe(42_000);
		});
	});

	describe("close", () => {
		it("is idempotent", () => {
			store.close();
			store.close(); // should not throw
		});
	});
});
