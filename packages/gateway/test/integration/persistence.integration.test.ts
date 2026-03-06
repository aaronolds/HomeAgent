import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { AuditLog } from "../../src/audit/audit-log.js";
import {
	EncryptedFileSecretStore,
	SecretStoreError,
} from "../../src/persistence/encrypted-file-secret-store.js";
import { migrateDevicesFromJson } from "../../src/persistence/migrate-devices.js";
import { OperationalStore } from "../../src/persistence/operational-store.js";
import { TranscriptWriter } from "../../src/persistence/transcript-writer.js";
import {
	cleanupTestGateway,
	closeSocket,
	createConnectMessage,
	createTestGateway,
	waitForSocketMessage,
	waitForSocketOpen,
} from "../helpers/test-gateway.js";

// ---------------------------------------------------------------------------
// 1. OperationalStore lifecycle
// ---------------------------------------------------------------------------

describe("persistence integration: OperationalStore lifecycle", () => {
	let store: OperationalStore;
	let tempDir: string;
	let dbPath: string;
	let currentTime: number;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "persist-int-opstore-"));
		dbPath = join(tempDir, "homeagent.db");
		currentTime = 1_000_000;
		store = new OperationalStore({
			dbPath,
			now: () => currentTime,
		});
	});

	afterEach(() => {
		store.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("register → retrieve → approve → verify → revoke → verify device", () => {
		store.registerDevice({
			deviceId: "dev-lifecycle",
			sharedSecret: "secret-lifecycle",
			role: "node",
			approved: false,
		});

		const registered = store.getDevice("dev-lifecycle");
		expect(registered).toBeDefined();
		expect(registered?.approved).toBe(false);
		expect(registered?.revoked).toBeUndefined();

		currentTime = 2_000_000;
		const approved = store.approveDevice("dev-lifecycle");
		expect(approved).toBeDefined();
		expect(approved?.approved).toBe(true);

		const afterApprove = store.getDevice("dev-lifecycle");
		expect(afterApprove?.approved).toBe(true);
		expect(afterApprove?.updatedAt).toBe(2_000_000);

		currentTime = 3_000_000;
		const revoked = store.revokeDevice("dev-lifecycle");
		expect(revoked).toBeDefined();
		expect(revoked?.revoked).toBe(true);

		const afterRevoke = store.getDevice("dev-lifecycle");
		expect(afterRevoke?.revoked).toBe(true);
		expect(afterRevoke?.revokedAt).toBe(3_000_000);
		expect(afterRevoke?.updatedAt).toBe(3_000_000);
	});

	it("register → retrieve → list agents", () => {
		store.registerAgent({ agentId: "agent-1", name: "Alpha", model: "gpt-4" });
		currentTime = 2_000_000;
		store.registerAgent({ agentId: "agent-2", name: "Beta" });

		const a1 = store.getAgent("agent-1");
		expect(a1).toBeDefined();
		expect(a1?.name).toBe("Alpha");
		expect(a1?.model).toBe("gpt-4");

		const agents = store.listAgents();
		expect(agents).toHaveLength(2);
		expect(agents.map((a) => a.agentId).sort()).toEqual(["agent-1", "agent-2"]);
	});

	it("transaction commits on success", () => {
		store.transaction(() => {
			store.registerDevice({
				deviceId: "tx-dev-1",
				sharedSecret: "s1",
				role: "client",
				approved: true,
			});
			store.registerAgent({ agentId: "tx-agent-1", name: "TxAgent" });
		});

		expect(store.getDevice("tx-dev-1")).toBeDefined();
		expect(store.getAgent("tx-agent-1")).toBeDefined();
	});

	it("transaction rolls back on error", () => {
		try {
			store.transaction(() => {
				store.registerDevice({
					deviceId: "tx-rollback",
					sharedSecret: "s1",
					role: "client",
					approved: false,
				});
				throw new Error("simulated failure");
			});
		} catch {
			// expected
		}

		expect(store.getDevice("tx-rollback")).toBeUndefined();
	});

	it("WAL mode is enabled", () => {
		const db = new DatabaseSync(dbPath);
		const row = db.prepare("PRAGMA journal_mode").get() as {
			journal_mode: string;
		};
		db.close();
		expect(row.journal_mode).toBe("wal");
	});

	it("database file permissions are 0o600", () => {
		const stat = statSync(dbPath);
		const mode = stat.mode & 0o777;
		expect(mode).toBe(0o600);
	});
});

// ---------------------------------------------------------------------------
// 2. TranscriptWriter round-trip
// ---------------------------------------------------------------------------

describe("persistence integration: TranscriptWriter round-trip", () => {
	let tempDir: string;
	let currentTime: number;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "persist-int-transcript-"));
		currentTime = 1_000_000;
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("append multiple entries → close → recover all entries", () => {
		const writer = new TranscriptWriter({
			dataDir: tempDir,
			agentId: "agent-1",
			sessionId: "session-1",
			fsync: false,
			now: () => currentTime,
		});

		writer.append({ type: "request", data: { prompt: "hello" } });
		currentTime = 2_000_000;
		writer.append({ type: "response", data: { text: "world" } });
		currentTime = 3_000_000;
		writer.append({ type: "event", data: { action: "tool_call" } });
		writer.close();

		const { entries, truncated } = TranscriptWriter.recover(writer.path);
		expect(truncated).toBe(false);
		expect(entries).toHaveLength(3);
		expect(entries[0].ts).toBe(1_000_000);
		expect(entries[0].type).toBe("request");
		expect(entries[1].ts).toBe(2_000_000);
		expect(entries[1].type).toBe("response");
		expect(entries[2].ts).toBe(3_000_000);
		expect(entries[2].type).toBe("event");
	});

	it("recovers complete entries and skips truncated last line", () => {
		const writer = new TranscriptWriter({
			dataDir: tempDir,
			agentId: "agent-crash",
			sessionId: "session-crash",
			fsync: false,
			now: () => currentTime,
		});

		writer.append({ type: "request", data: { prompt: "one" } });
		currentTime = 2_000_000;
		writer.append({ type: "response", data: { text: "two" } });
		writer.close();

		// Simulate crash: append a partial JSON line
		const filePath = writer.path;
		const partialLine = '{"ts":3000000,"type":"error","da';
		writeFileSync(filePath, readFileSync(filePath, "utf8") + partialLine);

		const { entries, truncated } = TranscriptWriter.recover(filePath);
		expect(truncated).toBe(true);
		expect(entries).toHaveLength(2);
		expect(entries[0].type).toBe("request");
		expect(entries[1].type).toBe("response");
	});
});

// ---------------------------------------------------------------------------
// 3. SecretStore round-trip
// ---------------------------------------------------------------------------

describe("persistence integration: EncryptedFileSecretStore round-trip", () => {
	let tempDir: string;
	let vaultPath: string;
	let currentTime: number;
	const passphrase = "integration-test-passphrase";

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "persist-int-secrets-"));
		vaultPath = join(tempDir, "secrets.vault");
		currentTime = 1_000_000;
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	function createStore(opts?: {
		passphrase?: string;
	}): EncryptedFileSecretStore {
		return new EncryptedFileSecretStore({
			vaultPath,
			passphrase: opts?.passphrase ?? passphrase,
			now: () => currentTime,
		});
	}

	it("set → get → verify value matches", () => {
		const store = createStore();
		store.set("my-api-key", "sk-12345-secret-value", "llm_api_key");

		const entry = store.get("my-api-key");
		expect(entry).toBeDefined();
		expect(entry?.value).toBe("sk-12345-secret-value");
		expect(entry?.metadata.category).toBe("llm_api_key");
		store.close();

		// Verify persistence: reopen with same passphrase
		const store2 = createStore();
		const reloaded = store2.get("my-api-key");
		expect(reloaded?.value).toBe("sk-12345-secret-value");
		store2.close();
	});

	it("vault file on disk is NOT plaintext", () => {
		const store = createStore();
		store.set("plaintext-check", "super-secret-value-12345", "custom");
		store.close();

		const raw = readFileSync(vaultPath);
		const rawString = raw.toString("utf8");
		expect(rawString).not.toContain("super-secret-value-12345");
		expect(rawString).not.toContain("plaintext-check");
	});

	it("wrong passphrase throws SecretStoreError", () => {
		const store = createStore();
		store.set("secret-key", "secret-val", "device_secret");
		store.close();

		expect(() => createStore({ passphrase: "wrong-passphrase" })).toThrow(
			SecretStoreError,
		);
	});

	it("delete → has returns false", () => {
		const store = createStore();
		store.set("to-delete", "value", "custom");
		expect(store.has("to-delete")).toBe(true);

		store.delete("to-delete");
		expect(store.has("to-delete")).toBe(false);
		store.close();

		// Verify deletion persists
		const store2 = createStore();
		expect(store2.has("to-delete")).toBe(false);
		store2.close();
	});
});

// ---------------------------------------------------------------------------
// 4. JSON → SQLite migration
// ---------------------------------------------------------------------------

describe("persistence integration: JSON → SQLite device migration", () => {
	let tempDir: string;
	let store: OperationalStore;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "persist-int-migrate-"));
		store = new OperationalStore({
			dbPath: join(tempDir, "homeagent.db"),
			now: () => 1_000_000,
		});
	});

	afterEach(() => {
		store.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("migrates devices.json into OperationalStore and renames file", () => {
		const jsonPath = join(tempDir, "devices.json");
		const devices = [
			{
				deviceId: "migrated-1",
				sharedSecret: "sec-1",
				role: "admin",
				approved: true,
			},
			{
				deviceId: "migrated-2",
				name: "Laptop",
				sharedSecret: "sec-2",
				role: "client",
				approved: false,
			},
		];
		writeFileSync(jsonPath, JSON.stringify(devices));

		const result = migrateDevicesFromJson({ jsonPath, store });
		expect(result.migrated).toBe(2);
		expect(result.skipped).toBe(false);
		expect(result.errors).toHaveLength(0);

		// Verify devices in SQLite
		const d1 = store.getDevice("migrated-1");
		expect(d1).toBeDefined();
		expect(d1?.role).toBe("admin");
		expect(d1?.approved).toBe(true);

		const d2 = store.getDevice("migrated-2");
		expect(d2).toBeDefined();
		expect(d2?.name).toBe("Laptop");
		expect(d2?.approved).toBe(false);

		// Verify rename
		expect(existsSync(jsonPath)).toBe(false);
		expect(existsSync(`${jsonPath}.migrated`)).toBe(true);
	});

	it("second migration call is a no-op (already migrated)", () => {
		const jsonPath = join(tempDir, "devices.json");
		writeFileSync(
			jsonPath,
			JSON.stringify([
				{ deviceId: "d1", sharedSecret: "s1", role: "client", approved: true },
			]),
		);

		migrateDevicesFromJson({ jsonPath, store });
		const secondResult = migrateDevicesFromJson({ jsonPath, store });
		expect(secondResult.skipped).toBe(true);
		expect(secondResult.migrated).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// 5. Audit log with redaction
// ---------------------------------------------------------------------------

describe("persistence integration: audit log with redaction", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "persist-int-audit-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("redacts sharedSecret in written audit event", async () => {
		const auditLog = new AuditLog(tempDir, { datasync: false });

		await auditLog.log({
			timestamp: 1_000_000,
			event: "device_registered",
			outcome: "success",
			deviceId: "dev-audit",
			details: {
				sharedSecret: "super-secret-passphrase-1234",
				name: "visible-name",
			},
		});

		const auditPath = join(tempDir, "audit.jsonl");
		const content = readFileSync(auditPath, "utf8");
		const parsed = JSON.parse(content.trim());

		// The sharedSecret should be redacted
		expect(parsed.details.sharedSecret).not.toBe(
			"super-secret-passphrase-1234",
		);
		expect(parsed.details.sharedSecret).toContain("****");
		// Non-sensitive fields remain intact
		expect(parsed.details.name).toBe("visible-name");
	});
});

// ---------------------------------------------------------------------------
// 6. Full gateway startup with OperationalStore auth
// ---------------------------------------------------------------------------

describe("persistence integration: gateway startup with OperationalStore", () => {
	it("registers device in store → connects via WebSocket → authenticates", async () => {
		const ctx = await createTestGateway();
		const socket = new WebSocket(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);

			const messagePromise =
				waitForSocketMessage<Record<string, unknown>>(socket);

			socket.send(
				JSON.stringify(
					createConnectMessage({
						deviceId: ctx.testDevice.deviceId,
						sharedSecret: ctx.testDevice.sharedSecret,
						role: ctx.testDevice.role,
						authToken: ctx.testDevice.authToken,
					}),
				),
			);

			const message = await messagePromise;
			expect(message.approved).toBe(true);
			expect(typeof message.connectionId).toBe("string");
			expect(typeof message.sessionToken).toBe("string");
		} finally {
			await closeSocket(socket);
			await cleanupTestGateway(ctx);
		}
	});

	it("device registered directly in OperationalStore is accessible for auth", async () => {
		const ctx = await createTestGateway({
			additionalDevices: [
				{
					deviceId: "direct-store-device",
					sharedSecret: "direct-secret",
					approved: true,
					role: "client",
				},
			],
		});
		const socket = new WebSocket(ctx.wsUrl);

		try {
			await waitForSocketOpen(socket);

			const messagePromise =
				waitForSocketMessage<Record<string, unknown>>(socket);

			socket.send(
				JSON.stringify(
					createConnectMessage({
						deviceId: "direct-store-device",
						sharedSecret: "direct-secret",
						role: "client",
						authToken: "test-auth-token",
					}),
				),
			);

			const message = await messagePromise;
			expect(message.approved).toBe(true);
			expect(typeof message.sessionToken).toBe("string");
		} finally {
			await closeSocket(socket);
			await cleanupTestGateway(ctx);
		}
	});
});
