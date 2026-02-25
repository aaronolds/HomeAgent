import { describe, expect, it } from "vitest";
import { ConfigValidationError } from "../src/index.js";

describe("ConfigValidationError", () => {
	it("is an instance of Error", () => {
		const error = new ConfigValidationError("Invalid configuration", []);
		expect(error).toBeInstanceOf(Error);
	});

	it("sets name to ConfigValidationError", () => {
		const error = new ConfigValidationError("Invalid configuration", []);
		expect(error.name).toBe("ConfigValidationError");
	});

	it("stores constructor issues", () => {
		const issues = [
			{
				path: ["runtime", "execution", "toolTimeoutMs"],
				message: "Expected number, received string",
			},
		] as const;

		const error = new ConfigValidationError("Invalid configuration", issues);
		expect(error.issues).toEqual(issues);
	});

	it("formats issue paths and messages", () => {
		const error = new ConfigValidationError("Invalid configuration", [
			{
				path: ["gateway", "limits", "perDeviceRpcPerMinute"],
				message: "Too small: expected number to be >0",
			},
			{
				path: ["security", "tlsEnabled"],
				message: "Expected boolean",
			},
		]);

		expect(error.formatIssues()).toBe(
			"  - gateway.limits.perDeviceRpcPerMinute: Too small: expected number to be >0\n  - security.tlsEnabled: Expected boolean",
		);
	});

	it("formats empty path as (root)", () => {
		const error = new ConfigValidationError("Invalid configuration", [
			{
				path: [],
				message: "Expected object",
			},
		]);

		expect(error.formatIssues()).toBe("  - (root): Expected object");
	});
});