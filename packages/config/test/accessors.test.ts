import { describe, expect, it } from "vitest";
import {
	DEFAULT_CONFIG,
	createConfig,
	getGatewayFrameLimits,
	getGatewayNetwork,
	getGatewayRateLimits,
	getGatewaySession,
	getRuntimeCompaction,
	getRuntimeExecution,
	getSecurityToggles,
} from "../src/index.js";

describe("config accessors", () => {
	it("extracts correct sections from default config", () => {
		const config = createConfig();

		expect(getGatewayRateLimits(config)).toEqual(DEFAULT_CONFIG.gateway.limits);
		expect(getGatewayFrameLimits(config)).toEqual(
			DEFAULT_CONFIG.gateway.frameLimits,
		);
		expect(getGatewaySession(config)).toEqual(DEFAULT_CONFIG.gateway.session);
		expect(getGatewayNetwork(config)).toEqual(DEFAULT_CONFIG.gateway.network);
		expect(getRuntimeCompaction(config)).toEqual(DEFAULT_CONFIG.runtime.compaction);
		expect(getRuntimeExecution(config)).toEqual(DEFAULT_CONFIG.runtime.execution);
		expect(getSecurityToggles(config)).toEqual(DEFAULT_CONFIG.security);
	});

	it("extracts correct sections from custom config", () => {
		const config = createConfig({
			gateway: {
				limits: {
					perIpConnectionsPerMinute: 100,
				},
				network: {
					originAllowlist: ["https://example.com"],
				},
			},
			runtime: {
				compaction: {
					thresholdRatio: 0.5,
				},
			},
			security: {
				allowInsecure: true,
			},
		});

		expect(getGatewayRateLimits(config).perIpConnectionsPerMinute).toBe(100);
		expect(getGatewayNetwork(config).originAllowlist).toEqual([
			"https://example.com",
		]);
		expect(getRuntimeCompaction(config).thresholdRatio).toBe(0.5);
		expect(getSecurityToggles(config).allowInsecure).toBe(true);
	});
});