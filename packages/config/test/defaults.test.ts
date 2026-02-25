import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/index.js";

describe("DEFAULT_CONFIG", () => {
	it("contains expected default values", () => {
		expect(DEFAULT_CONFIG).toEqual({
			gateway: {
				limits: {
					perIpConnectionsPerMinute: 10,
					perDeviceRpcPerMinute: 60,
					perDeviceAgentRunPerMinute: 10,
				},
				frameLimits: {
					maxFrameBytes: 1_048_576,
				},
				session: {
					heartbeatIntervalSeconds: 30,
					sessionTokenTtlSeconds: 3600,
					nonceReplayWindowSeconds: 300,
				},
				network: {
					originAllowlist: [],
					strictOrigin: true,
					strictCors: true,
				},
			},
			runtime: {
				compaction: {
					thresholdRatio: 0.75,
					recencyTurns: 20,
				},
				execution: {
					toolTimeoutMs: 30_000,
				},
			},
			security: {
				tlsEnabled: true,
				allowInsecure: false,
				enforceAuth: true,
				enforceRbac: true,
			},
		});
	});

	it("is deeply frozen", () => {
		expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
		expect(Object.isFrozen(DEFAULT_CONFIG.gateway)).toBe(true);
		expect(Object.isFrozen(DEFAULT_CONFIG.gateway.limits)).toBe(true);
		expect(Object.isFrozen(DEFAULT_CONFIG.gateway.frameLimits)).toBe(true);
		expect(Object.isFrozen(DEFAULT_CONFIG.gateway.session)).toBe(true);
		expect(Object.isFrozen(DEFAULT_CONFIG.gateway.network)).toBe(true);
		expect(Object.isFrozen(DEFAULT_CONFIG.gateway.network.originAllowlist)).toBe(
			true,
		);
		expect(Object.isFrozen(DEFAULT_CONFIG.runtime)).toBe(true);
		expect(Object.isFrozen(DEFAULT_CONFIG.runtime.compaction)).toBe(true);
		expect(Object.isFrozen(DEFAULT_CONFIG.runtime.execution)).toBe(true);
		expect(Object.isFrozen(DEFAULT_CONFIG.security)).toBe(true);
	});
});