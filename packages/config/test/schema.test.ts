import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, HomeAgentConfigSchema } from "../src/index.js";

describe("HomeAgentConfigSchema", () => {
	it("parses an empty object into defaults", () => {
		const parsed = HomeAgentConfigSchema.parse({});
		expect(parsed).toEqual(DEFAULT_CONFIG);
	});

	it("merges partial overrides with defaults", () => {
		const parsed = HomeAgentConfigSchema.parse({
			gateway: {
				limits: {
					perIpConnectionsPerMinute: 42,
				},
			},
			runtime: {
				compaction: {
					recencyTurns: 8,
				},
			},
		});

		expect(parsed.gateway.limits.perIpConnectionsPerMinute).toBe(42);
		expect(parsed.runtime.compaction.recencyTurns).toBe(8);
		expect(parsed.gateway.limits.perDeviceRpcPerMinute).toBe(
			DEFAULT_CONFIG.gateway.limits.perDeviceRpcPerMinute,
		);
		expect(parsed.security).toEqual(DEFAULT_CONFIG.security);
	});

	it("rejects invalid types", () => {
		const result = HomeAgentConfigSchema.safeParse({
			gateway: {
				session: {
					heartbeatIntervalSeconds: "30",
				},
			},
		});

		expect(result.success).toBe(false);
	});

	it("rejects negative numbers for positive fields", () => {
		const result = HomeAgentConfigSchema.safeParse({
			gateway: {
				limits: {
					perIpConnectionsPerMinute: -1,
				},
			},
		});

		expect(result.success).toBe(false);
	});

	it("rejects thresholdRatio values less than 0", () => {
		const result = HomeAgentConfigSchema.safeParse({
			runtime: {
				compaction: {
					thresholdRatio: -0.01,
				},
			},
		});

		expect(result.success).toBe(false);
	});

	it("rejects thresholdRatio values greater than 1", () => {
		const result = HomeAgentConfigSchema.safeParse({
			runtime: {
				compaction: {
					thresholdRatio: 1.01,
				},
			},
		});

		expect(result.success).toBe(false);
	});

	it("rejects non-boolean values for boolean fields", () => {
		const result = HomeAgentConfigSchema.safeParse({
			gateway: {
				network: {
					strictOrigin: "true",
				},
			},
		});

		expect(result.success).toBe(false);
	});

	it("accepts string arrays for originAllowlist", () => {
		const parsed = HomeAgentConfigSchema.parse({
			gateway: {
				network: {
					originAllowlist: ["https://example.com", "https://homeagent.dev"],
				},
			},
		});

		expect(parsed.gateway.network.originAllowlist).toEqual([
			"https://example.com",
			"https://homeagent.dev",
		]);
	});

	it("rejects non-string arrays for originAllowlist", () => {
		const result = HomeAgentConfigSchema.safeParse({
			gateway: {
				network: {
					originAllowlist: ["https://example.com", 123],
				},
			},
		});

		expect(result.success).toBe(false);
	});
});
