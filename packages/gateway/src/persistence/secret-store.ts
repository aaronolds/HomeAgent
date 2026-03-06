export type SecretCategory =
	| "provider_token"
	| "llm_api_key"
	| "device_secret"
	| "custom";

export interface SecretMetadata {
	category: SecretCategory;
	createdAt: number;
	updatedAt: number;
}

export interface SecretEntry {
	value: string;
	metadata: SecretMetadata;
}

export interface SecretStore {
	/** Get a secret by key. Returns undefined if not found. */
	get(key: string): SecretEntry | undefined;
	/** Store a secret. Overwrites if key exists. */
	set(key: string, value: string, category: SecretCategory): void;
	/** Delete a secret by key. Returns true if it existed. */
	delete(key: string): boolean;
	/** Check if a secret exists. */
	has(key: string): boolean;
	/** List all secret keys (never returns values). */
	list(): Array<{ key: string; metadata: SecretMetadata }>;
	/** Close/cleanup resources. */
	close(): void;
}
