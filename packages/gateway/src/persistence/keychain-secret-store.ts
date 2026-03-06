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

// TODO: Full cross-platform keychain read/write integration

export interface KeychainSecretStoreOptions {
	/** Service name for keychain entries (reserved for future OS keychain integration) */
	serviceName?: string;
	/**
	 * Storage options for the underlying EncryptedFileSecretStore.
	 * All secrets are currently stored here regardless of keychain availability.
	 */
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

/**
 * Detects whether an OS keychain is available and exposes that status via
 * `hasKeychainAccess`. All secret reads/writes are currently delegated to
 * `EncryptedFileSecretStore` — the OS keychain is not used for storage yet.
 *
 * Operators selecting `secretsBackend: "keychain"` should be aware that
 * secrets are stored in the encrypted vault file, not the OS keychain.
 * The `hasKeychainAccess` property can be used to detect keychain presence
 * for future integration.
 */
export class KeychainSecretStore implements SecretStore {
	private readonly delegate: SecretStore;
	private readonly serviceName: string;
	private readonly keychainAvailable: boolean;

	public constructor(options: KeychainSecretStoreOptions) {
		this.serviceName = options.serviceName ?? "homeagent";
		this.keychainAvailable = isKeychainAvailable();

		// All secret reads/writes are handled by EncryptedFileSecretStore.
		// OS keychain integration (via `security` on macOS / `secret-tool` on Linux)
		// is reserved for a future release. The `hasKeychainAccess` property indicates
		// whether a keychain CLI was detected at construction time.
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
