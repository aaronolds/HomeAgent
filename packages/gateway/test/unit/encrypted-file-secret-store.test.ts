import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	EncryptedFileSecretStore,
	SecretStoreError,
} from "../../src/persistence/encrypted-file-secret-store.js";

describe("EncryptedFileSecretStore", () => {
	let tempDir: string;
	let vaultPath: string;
	let currentTime: number;
	const passphrase = "test-master-passphrase";

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "secret-store-test-"));
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

	describe("set and get", () => {
		it("stores a secret and retrieves it with correct value and metadata", () => {
			const store = createStore();
			store.set("api-key", "sk-12345", "llm_api_key");

			const entry = store.get("api-key");
			expect(entry).toBeDefined();
			expect(entry?.value).toBe("sk-12345");
			expect(entry?.metadata.category).toBe("llm_api_key");
			expect(entry?.metadata.createdAt).toBe(1_000_000);
			expect(entry?.metadata.updatedAt).toBe(1_000_000);
			store.close();
		});
	});

	describe("overwrite", () => {
		it("overwrites existing key with new value and updates timestamp", () => {
			const store = createStore();
			store.set("token", "v1", "provider_token");
			currentTime = 2_000_000;
			store.set("token", "v2", "provider_token");

			const entry = store.get("token");
			expect(entry?.value).toBe("v2");
			expect(entry?.metadata.createdAt).toBe(1_000_000);
			expect(entry?.metadata.updatedAt).toBe(2_000_000);
			store.close();
		});
	});

	describe("delete", () => {
		it("deletes an existing key and returns true", () => {
			const store = createStore();
			store.set("key1", "val1", "custom");

			expect(store.delete("key1")).toBe(true);
			expect(store.get("key1")).toBeUndefined();
			store.close();
		});

		it("returns false when deleting a nonexistent key", () => {
			const store = createStore();
			expect(store.delete("missing")).toBe(false);
			store.close();
		});
	});

	describe("has", () => {
		it("returns true for existing key", () => {
			const store = createStore();
			store.set("key1", "val1", "custom");

			expect(store.has("key1")).toBe(true);
			store.close();
		});

		it("returns false for missing key", () => {
			const store = createStore();
			expect(store.has("nonexistent")).toBe(false);
			store.close();
		});
	});

	describe("list", () => {
		it("returns keys and metadata without values", () => {
			const store = createStore();
			store.set("a", "secret-a", "llm_api_key");
			currentTime = 2_000_000;
			store.set("b", "secret-b", "provider_token");

			const listing = store.list();
			expect(listing).toHaveLength(2);

			const keys = listing.map((e) => e.key).sort();
			expect(keys).toEqual(["a", "b"]);

			// Verify no values are leaked
			for (const item of listing) {
				expect(item).not.toHaveProperty("value");
				expect(item.metadata).toBeDefined();
				expect(item.metadata.category).toBeDefined();
			}
			store.close();
		});
	});

	describe("wrong passphrase", () => {
		it("throws SecretStoreError with code wrong_passphrase", () => {
			const store = createStore();
			store.set("key1", "val1", "custom");
			store.close();

			expect(() => createStore({ passphrase: "wrong-passphrase" })).toThrow(
				SecretStoreError,
			);

			try {
				createStore({ passphrase: "wrong-passphrase" });
			} catch (err) {
				expect(err).toBeInstanceOf(SecretStoreError);
				expect((err as SecretStoreError).code).toBe("wrong_passphrase");
			}
		});
	});

	describe("empty vault", () => {
		it("creates a new store without an existing file", () => {
			const store = createStore();
			expect(store.list()).toHaveLength(0);
			expect(store.get("anything")).toBeUndefined();
			store.close();
		});
	});

	describe("persistence", () => {
		it("persists secrets across store instances", () => {
			const store1 = createStore();
			store1.set("key1", "val1", "provider_token");
			store1.set("key2", "val2", "device_secret");
			store1.close();

			const store2 = createStore();
			expect(store2.get("key1")?.value).toBe("val1");
			expect(store2.get("key1")?.metadata.category).toBe("provider_token");
			expect(store2.get("key2")?.value).toBe("val2");
			expect(store2.get("key2")?.metadata.category).toBe("device_secret");
			store2.close();
		});
	});

	describe("atomic write", () => {
		it("does not leave a .tmp file after save", () => {
			const store = createStore();
			store.set("key1", "val1", "custom");

			const tmpPath = `${vaultPath}.tmp`;
			let tmpExists = false;
			try {
				statSync(tmpPath);
				tmpExists = true;
			} catch {
				// Expected: file should not exist
			}
			expect(tmpExists).toBe(false);
			store.close();
		});
	});

	describe("file permissions", () => {
		it("creates vault file with 0o600 permissions", () => {
			const store = createStore();
			store.set("key1", "val1", "custom");

			const stats = statSync(vaultPath);
			// Mask to get only owner/group/other permission bits
			const permissions = stats.mode & 0o777;
			expect(permissions).toBe(0o600);
			store.close();
		});
	});

	describe("no plaintext", () => {
		it("does not contain secret values as plaintext in vault file", () => {
			const store = createStore();
			store.set("my-secret-key", "super-secret-value-12345", "custom");
			store.close();

			const raw = readFileSync(vaultPath);
			const rawString = raw.toString("utf8");
			expect(rawString).not.toContain("super-secret-value-12345");

			// Also check raw bytes
			const secretBytes = Buffer.from("super-secret-value-12345", "utf8");
			expect(raw.includes(secretBytes)).toBe(false);
		});
	});

	describe("multiple categories", () => {
		it("stores secrets with different categories and preserves metadata", () => {
			const store = createStore();
			store.set("token", "tok-1", "provider_token");
			currentTime = 1_500_000;
			store.set("api-key", "sk-1", "llm_api_key");
			currentTime = 2_000_000;
			store.set("device", "dev-1", "device_secret");
			currentTime = 2_500_000;
			store.set("misc", "misc-1", "custom");

			const listing = store.list();
			expect(listing).toHaveLength(4);

			const byKey = new Map(listing.map((e) => [e.key, e.metadata]));
			expect(byKey.get("token")?.category).toBe("provider_token");
			expect(byKey.get("api-key")?.category).toBe("llm_api_key");
			expect(byKey.get("device")?.category).toBe("device_secret");
			expect(byKey.get("misc")?.category).toBe("custom");

			expect(byKey.get("token")?.createdAt).toBe(1_000_000);
			expect(byKey.get("misc")?.createdAt).toBe(2_500_000);
			store.close();
		});
	});
});
