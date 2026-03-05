import { describe, expect, it } from "vitest";
import { validateOrigin } from "../../src/network/origin-validator.js";

describe("validateOrigin", () => {
	it("rejects missing origin when strictOrigin=true", () => {
		expect(validateOrigin(undefined, [], true)).toBe(false);
	});

	it("rejects empty origin when strictOrigin=true", () => {
		expect(validateOrigin("", [], true)).toBe(false);
	});

	it("allows any origin when strictOrigin=true and allowlist empty", () => {
		expect(validateOrigin("http://example.com", [], true)).toBe(true);
	});

	it("allows missing origin when strictOrigin=false and allowlist empty", () => {
		expect(validateOrigin(undefined, [], false)).toBe(true);
	});

	it("allows origin on allowlist", () => {
		expect(
			validateOrigin("http://localhost:3000", ["http://localhost:3000"], true),
		).toBe(true);
	});

	it("rejects origin not on allowlist", () => {
		expect(
			validateOrigin("http://evil.com", ["http://localhost:3000"], true),
		).toBe(false);
	});

	it("case-insensitive matching", () => {
		expect(
			validateOrigin("HTTP://LOCALHOST:3000", ["http://localhost:3000"], true),
		).toBe(true);
	});

	it("rejects missing origin when allowlist is non-empty even if strictOrigin=false", () => {
		expect(validateOrigin(undefined, ["http://localhost:3000"], false)).toBe(
			false,
		);
	});
});
