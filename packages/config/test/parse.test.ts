import { describe, expect, it } from "vitest";
import {
	ConfigValidationError,
	createConfig,
	DEFAULT_CONFIG,
	parseConfig,
	safeParseConfig,
} from "../src/index.js";

describe("parseConfig", () => {
	it("returns full defaults for empty input", () => {
		expect(parseConfig({})).toEqual(DEFAULT_CONFIG);
	});

	it("returns merged config for valid partial input", () => {
		const parsed = parseConfig({
			security: {
				allowInsecure: true,
			},
			runtime: {
				execution: {
					toolTimeoutMs: 45_000,
				},
			},
		});

		expect(parsed.security.allowInsecure).toBe(true);
		expect(parsed.runtime.execution.toolTimeoutMs).toBe(45_000);
		expect(parsed.security.enforceAuth).toBe(
			DEFAULT_CONFIG.security.enforceAuth,
		);
	});

	it("throws ConfigValidationError for invalid input", () => {
		expect(() =>
			parseConfig({
				runtime: {
					execution: {
						toolTimeoutMs: "slow",
					},
				},
			}),
		).toThrow(ConfigValidationError);
	});
});

describe("ConfigValidationError", () => {
	it("formatIssues returns human-readable output", () => {
		const error = new ConfigValidationError("Invalid configuration", [
			{
				path: ["gateway", "limits", "perIpConnectionsPerMinute"],
				message: "Expected number",
			},
			{ path: [], message: "Invalid root object" },
		]);

		expect(error.formatIssues()).toBe(
			"  - gateway.limits.perIpConnectionsPerMinute: Expected number\n  - (root): Invalid root object",
		);
	});
});

describe("safeParseConfig", () => {
	it("returns success result for valid input", () => {
		const result = safeParseConfig({});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(DEFAULT_CONFIG);
		}
	});

	it("returns error result with ConfigValidationError for invalid input", () => {
		const result = safeParseConfig({
			security: {
				tlsEnabled: "yes",
			},
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBeInstanceOf(ConfigValidationError);
			expect(result.error.issues.length).toBeGreaterThan(0);
		}
	});
});

describe("createConfig", () => {
	it("returns a frozen config equal to defaults", () => {
		const config = createConfig();

		expect(config).toEqual(DEFAULT_CONFIG);
		expect(Object.isFrozen(config)).toBe(true);
	});

	it("merges overrides correctly", () => {
		const config = createConfig({
			gateway: {
				session: {
					nonceReplayWindowSeconds: 600,
				},
			},
		});

		expect(config.gateway.session.nonceReplayWindowSeconds).toBe(600);
		expect(config.gateway.session.heartbeatIntervalSeconds).toBe(
			DEFAULT_CONFIG.gateway.session.heartbeatIntervalSeconds,
		);
	});

	it("throws for invalid overrides", () => {
		expect(() =>
			createConfig({
				gateway: {
					frameLimits: {
						maxFrameBytes: 0,
					},
				},
			}),
		).toThrow(ConfigValidationError);
	});
});
