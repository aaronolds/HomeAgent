import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import {
	EncryptedFileSecretStore,
	type EncryptedFileSecretStoreOptions,
} from "./encrypted-file-secret-store.js";
import type {
	SecretCategory,
	SecretEntry,
	SecretMetadata,
	SecretStore,
} from "./secret-store.js";

// TODO: Full cross-platform integration tests

export interface KeychainSecretStoreOptions {
	/** Service name for keychain entries */
	serviceName?: string;
	/** Fallback options if keychain unavailable */
	fallback: EncryptedFileSecretStoreOptions;
}

function isKeychainAvailable(): boolean {
	const os = platform();
	try {
		if (os === "darwin") {
			execFileSync("which", ["security"], { stdio: "ignore" });
			return true;
		}
		if (os === "linux") {
			execFileSync("which", ["secret-tool"], { stdio: "ignore" });
			return true;
		}
	} catch {
		// CLI not found
	}
	return false;
}

export class KeychainSecretStore implements SecretStore {
	private readonly delegate: SecretStore;
	private readonly serviceName: string;
	private readonly keychainAvailable: boolean;

	public constructor(options: KeychainSecretStoreOptions) {
		this.serviceName = options.serviceName ?? "homeagent";
		this.keychainAvailable = isKeychainAvailable();

		// For now, always delegate to EncryptedFileSecretStore.
		// Keychain integration reads/writes individual secrets but the
		// EncryptedFileSecretStore is the battle-tested primary path.
		this.delegate = new EncryptedFileSecretStore(options.fallback);
	}

	/** Whether OS keychain CLI was detected at construction time. */
	public get hasKeychainAccess(): boolean {
		return this.keychainAvailable;
	}

	public get(key: string): SecretEntry | undefined {
		return this.delegate.get(key);
	}

	public set(key: string, value: string, category: SecretCategory): void {
		this.delegate.set(key, value, category);
	}

	public delete(key: string): boolean {
		return this.delegate.delete(key);
	}

	public has(key: string): boolean {
		return this.delegate.has(key);
	}

	public list(): Array<{ key: string; metadata: SecretMetadata }> {
		return this.delegate.list();
	}

	public close(): void {
		this.delegate.close();
	}
}
