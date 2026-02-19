import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, RPC_METHODS } from "../protocol/constants.js";
import { generateJsonSchemas } from "../protocol/json-schema.js";

describe("json schema generation", () => {
	it("generateJsonSchemas returns object with version and schemas", () => {
		const output = generateJsonSchemas();
		expect(output).toHaveProperty("version");
		expect(output).toHaveProperty("schemas");
		expect(typeof output.schemas).toBe("object");
	});

	it("version matches PROTOCOL_VERSION", () => {
		const output = generateJsonSchemas();
		expect(output.version).toBe(PROTOCOL_VERSION);
	});

	it("schemas contains entries for handshake, envelopes, and methods", () => {
		const output = generateJsonSchemas();

		expect(output.schemas).toHaveProperty("handshake.connect");
		expect(output.schemas).toHaveProperty("handshake.connect_ok");
		expect(output.schemas).toHaveProperty("handshake.error");
		expect(output.schemas).toHaveProperty("envelope.request");
		expect(output.schemas).toHaveProperty("envelope.response");
		expect(output.schemas).toHaveProperty("envelope.event");
		expect(output.schemas).toHaveProperty("method.session.resolve.params");
		expect(output.schemas).toHaveProperty("method.session.resolve.result");
	});

	it("each schema entry is a valid JSON Schema object shape", () => {
		const output = generateJsonSchemas();

		for (const schemaValue of Object.values(output.schemas)) {
			expect(typeof schemaValue).toBe("object");
			expect(schemaValue).not.toBeNull();

			const schema = schemaValue as Record<string, unknown>;
			const hasJsonSchemaShape =
				"properties" in schema ||
				"$schema" in schema ||
				"definitions" in schema ||
				"$defs" in schema;
			expect(hasJsonSchemaShape).toBe(true);
		}
	});

	it("method schemas cover all RPC_METHODS", () => {
		const output = generateJsonSchemas();

		for (const method of RPC_METHODS) {
			expect(output.schemas).toHaveProperty(`method.${method}.params`);
			expect(output.schemas).toHaveProperty(`method.${method}.result`);
		}
	});
});
