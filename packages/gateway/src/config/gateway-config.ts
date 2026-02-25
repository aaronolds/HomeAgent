export interface GatewayConfig {
	host: string;
	port: number;
	insecure: boolean;
	certPath?: string;
	keyPath?: string;
	nonceWindowMs: number;
	timestampSkewMs: number;
	sessionTokenTtlMs: number;
	dataDir: string;
	jwtSecret?: string;
}

export function createDefaultConfig(): GatewayConfig {
	return {
		host: "0.0.0.0",
		port: 8443,
		insecure: false,
		nonceWindowMs: 300_000,
		timestampSkewMs: 30_000,
		sessionTokenTtlMs: 900_000,
		dataDir: ".homeagent",
	};
}
