export interface GatewayConfig {
	host: string;
	port: number;
	insecure: boolean;
	certPath?: string;
	keyPath?: string;
	nonceWindowMs: number;
	timestampSkewMs: number;
	sessionTokenTtlMs: number;
	idempotencyTtlMs: number;
	idempotencyCleanupIntervalMs: number;
	dataDir: string;
	sqlitePath?: string;
	jwtSecret?: string;
	rateLimits: {
		perIpConnectionsPerMinute: number;
		perDeviceRpcPerMinute: number;
		perDeviceAgentRunPerMinute: number;
	};
	frameLimits: {
		maxFrameBytes: number;
	};
	network: {
		originAllowlist: string[];
		strictOrigin: boolean;
		strictCors: boolean;
	};
}

export function createDefaultConfig(): GatewayConfig {
	return {
		host: "0.0.0.0",
		port: 8443,
		insecure: false,
		nonceWindowMs: 300_000,
		timestampSkewMs: 30_000,
		sessionTokenTtlMs: 900_000,
		idempotencyTtlMs: 86_400_000,
		idempotencyCleanupIntervalMs: 3_600_000,
		dataDir: ".homeagent",
		rateLimits: {
			perIpConnectionsPerMinute: 10,
			perDeviceRpcPerMinute: 60,
			perDeviceAgentRunPerMinute: 10,
		},
		frameLimits: {
			maxFrameBytes: 1_048_576,
		},
		network: {
			originAllowlist: [],
			strictOrigin: true,
			strictCors: true,
		},
	};
}
