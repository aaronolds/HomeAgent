import type { HomeAgentConfig } from "./schema.js";

/**
 * Immutable default configuration aligned with docs/plan.combined.md.
 */
export const DEFAULT_CONFIG: Readonly<HomeAgentConfig> = Object.freeze({
	gateway: Object.freeze({
		limits: Object.freeze({
			perIpConnectionsPerMinute: 10,
			perDeviceRpcPerMinute: 60,
			perDeviceAgentRunPerMinute: 10,
		}),
		frameLimits: Object.freeze({
			maxFrameBytes: 1_048_576,
		}),
		session: Object.freeze({
			heartbeatIntervalSeconds: 30,
			sessionTokenTtlSeconds: 3600,
			nonceReplayWindowSeconds: 300,
		}),
		network: Object.freeze({
			originAllowlist: Object.freeze([]) as unknown as string[],
			strictOrigin: true,
			strictCors: true,
		}),
	}),
	runtime: Object.freeze({
		compaction: Object.freeze({
			thresholdRatio: 0.75,
			recencyTurns: 20,
		}),
		execution: Object.freeze({
			toolTimeoutMs: 30_000,
		}),
	}),
	security: Object.freeze({
		tlsEnabled: true,
		allowInsecure: false,
		enforceAuth: true,
		enforceRbac: true,
	}),
});