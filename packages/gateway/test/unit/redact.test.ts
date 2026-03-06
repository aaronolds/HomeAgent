import { describe, expect, it } from "vitest";

import { redactFields, redactSecret } from "../../src/audit/redact.js";

describe("redactSecret", () => {
	it("masks long strings showing last 4 chars", () => {
		expect(redactSecret("my-super-secret-key")).toBe("****-key");
	});

	it("masks exactly 5-char strings showing last 4", () => {
		expect(redactSecret("abcde")).toBe("****bcde");
	});

	it("masks short strings (<=4) completely", () => {
		expect(redactSecret("abc")).toBe("****");
		expect(redactSecret("abcd")).toBe("****");
	});

	it("masks empty string", () => {
		expect(redactSecret("")).toBe("****");
	});
});

describe("redactFields", () => {
	it("redacts default sensitive field names", () => {
		const obj = {
			sharedSecret: "super-secret-value",
			token: "tok_live_12345",
			name: "device-1",
		};
		const result = redactFields(obj);
		expect(result.sharedSecret).toBe("****alue");
		expect(result.token).toBe("****2345");
		expect(result.name).toBe("device-1");
	});

	it("redacts nested objects recursively", () => {
		const obj = {
			outer: "visible",
			nested: {
				password: "hunter2-extended",
				safe: 42,
				deep: {
					apiKey: "sk-live-abcdef1234",
				},
			},
		};
		const result = redactFields(obj);
		expect(result.outer).toBe("visible");
		expect((result.nested as Record<string, unknown>).password).toBe(
			"****nded",
		);
		expect((result.nested as Record<string, unknown>).safe).toBe(42);
		expect(
			(
				(result.nested as Record<string, unknown>).deep as Record<
					string,
					unknown
				>
			).apiKey,
		).toBe("****1234");
	});

	it("does not modify the original object", () => {
		const obj = { password: "secret123" };
		const result = redactFields(obj);
		expect(obj.password).toBe("secret123");
		expect(result.password).toBe("****t123");
	});

	it("handles custom field list", () => {
		const obj = { foo: "bar-value", baz: "qux-value" };
		const result = redactFields(obj, ["foo"]);
		expect(result.foo).toBe("****alue");
		expect(result.baz).toBe("qux-value");
	});

	it("leaves non-string values for matching keys unchanged", () => {
		const obj = { password: 12345, token: true };
		const result = redactFields(obj);
		expect(result.password).toBe(12345);
		expect(result.token).toBe(true);
	});

	it("handles arrays inside objects", () => {
		const obj = {
			items: [{ secret: "abc-secret-xyz" }, { name: "safe" }],
		};
		const result = redactFields(obj);
		expect((result.items as Record<string, unknown>[])[0].secret).toBe(
			"****-xyz",
		);
		expect((result.items as Record<string, unknown>[])[1].name).toBe("safe");
	});

	it("covers all default sensitive field names", () => {
		const obj = {
			sharedSecret: "value-one-two",
			token: "value-one-two",
			apiKey: "value-one-two",
			passphrase: "value-one-two",
			password: "value-one-two",
			secret: "value-one-two",
		};
		const result = redactFields(obj);
		for (const key of Object.keys(result)) {
			expect(result[key]).toBe("****-two");
		}
	});
});
