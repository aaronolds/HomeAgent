import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
} from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type {
	SecretCategory,
	SecretEntry,
	SecretMetadata,
	SecretStore,
} from "./secret-store.js";

export class SecretStoreError extends Error {
	constructor(
		message: string,
		public readonly code: "wrong_passphrase" | "corrupted_vault" | "io_error",
	) {
		super(message);
		this.name = "SecretStoreError";
	}
}

export interface EncryptedFileSecretStoreOptions {
	/** Path to the vault file, e.g. ~/.homeagent/secrets.vault */
	vaultPath: string;
	/** Master passphrase for encryption */
	passphrase: string;
	/** Injectable clock for testing */
	now?: () => number;
}

const MAGIC = Buffer.from("HAVT");
const VERSION = 0x01;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const HEADER_LENGTH =
	MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

interface VaultData {
	[key: string]: { value: string; metadata: SecretMetadata };
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
	return scryptSync(passphrase, salt, 32, SCRYPT_PARAMS) as Buffer;
}

export class EncryptedFileSecretStore implements SecretStore {
	private readonly vaultPath: string;
	private readonly passphrase: string;
	private readonly now: () => number;
	private secrets: Map<string, SecretEntry>;
	private salt: Buffer;

	public constructor(options: EncryptedFileSecretStoreOptions) {
		this.vaultPath = options.vaultPath;
		this.passphrase = options.passphrase;
		this.now = options.now ?? Date.now;
		this.secrets = new Map();
		this.salt = randomBytes(SALT_LENGTH);

		if (existsSync(this.vaultPath)) {
			this.load();
		}
	}

	public get(key: string): SecretEntry | undefined {
		return this.secrets.get(key);
	}

	public set(key: string, value: string, category: SecretCategory): void {
		const now = this.now();
		const existing = this.secrets.get(key);
		const metadata: SecretMetadata = {
			category,
			createdAt: existing?.metadata.createdAt ?? now,
			updatedAt: now,
		};
		this.secrets.set(key, { value, metadata });
		this.save();
	}

	public delete(key: string): boolean {
		const existed = this.secrets.delete(key);
		if (existed) {
			this.save();
		}
		return existed;
	}

	public has(key: string): boolean {
		return this.secrets.has(key);
	}

	public list(): Array<{ key: string; metadata: SecretMetadata }> {
		const result: Array<{ key: string; metadata: SecretMetadata }> = [];
		for (const [key, entry] of this.secrets) {
			result.push({ key, metadata: entry.metadata });
		}
		return result;
	}

	public close(): void {
		this.secrets.clear();
	}

	private load(): void {
		let data: Buffer;
		try {
			data = readFileSync(this.vaultPath);
		} catch (err) {
			throw new SecretStoreError(
				`Failed to read vault file: ${(err as Error).message}`,
				"io_error",
			);
		}

		if (data.length < HEADER_LENGTH) {
			throw new SecretStoreError(
				"Vault file is too small to be valid",
				"corrupted_vault",
			);
		}

		const magic = data.subarray(0, 4);
		if (!magic.equals(MAGIC)) {
			throw new SecretStoreError(
				"Invalid vault file magic bytes",
				"corrupted_vault",
			);
		}

		const version = data[4];
		if (version !== VERSION) {
			throw new SecretStoreError(
				`Unsupported vault version: ${version}`,
				"corrupted_vault",
			);
		}

		this.salt = Buffer.from(data.subarray(5, 5 + SALT_LENGTH));
		const iv = data.subarray(5 + SALT_LENGTH, 5 + SALT_LENGTH + IV_LENGTH);
		const authTag = data.subarray(
			5 + SALT_LENGTH + IV_LENGTH,
			5 + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
		);
		const ciphertext = data.subarray(HEADER_LENGTH);

		const key = deriveKey(this.passphrase, this.salt);

		let decrypted: Buffer;
		try {
			const decipher = createDecipheriv("aes-256-gcm", key, iv);
			decipher.setAuthTag(authTag);
			decrypted = Buffer.concat([
				decipher.update(ciphertext),
				decipher.final(),
			]);
		} catch {
			throw new SecretStoreError(
				"Failed to decrypt vault — wrong passphrase or corrupted data",
				"wrong_passphrase",
			);
		}

		let parsed: VaultData;
		try {
			parsed = JSON.parse(decrypted.toString("utf8")) as VaultData;
		} catch {
			throw new SecretStoreError(
				"Vault data is not valid JSON",
				"corrupted_vault",
			);
		}

		this.secrets = new Map();
		for (const [entryKey, entry] of Object.entries(parsed)) {
			this.secrets.set(entryKey, entry);
		}
	}

	private save(): void {
		const vaultData: VaultData = {};
		for (const [key, entry] of this.secrets) {
			vaultData[key] = entry;
		}

		const plaintext = Buffer.from(JSON.stringify(vaultData), "utf8");
		const iv = randomBytes(IV_LENGTH);
		const key = deriveKey(this.passphrase, this.salt);

		const cipher = createCipheriv("aes-256-gcm", key, iv);
		const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
		const authTag = cipher.getAuthTag();

		const header = Buffer.alloc(5 + SALT_LENGTH);
		MAGIC.copy(header, 0);
		header[4] = VERSION;
		this.salt.copy(header, 5);

		const vaultBuffer = Buffer.concat([header, iv, authTag, encrypted]);

		const dir = dirname(this.vaultPath);
		mkdirSync(dir, { recursive: true });

		const tmpPath = `${this.vaultPath}.tmp`;
		try {
			writeFileSync(tmpPath, vaultBuffer, { mode: 0o600 });
			renameSync(tmpPath, this.vaultPath);
		} catch (err) {
			throw new SecretStoreError(
				`Failed to write vault file: ${(err as Error).message}`,
				"io_error",
			);
		}
	}
}
