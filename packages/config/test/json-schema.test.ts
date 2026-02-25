import { describe, expect, it } from "vitest";
import {
	CONFIG_SCHEMA_VERSION,
	generateConfigJsonSchema,
} from "../src/index.js";

describe("generateConfigJsonSchema", () => {
	it("returns object with version and schema", () => {
		const result = generateConfigJsonSchema();

		expect(result).toHaveProperty("version");
		expect(result).toHaveProperty("schema");
	});

	it("uses CONFIG_SCHEMA_VERSION", () => {
		const result = generateConfigJsonSchema();
		expect(result.version).toBe(CONFIG_SCHEMA_VERSION);
	});

	it("returns object schema with properties", () => {
		const { schema } = generateConfigJsonSchema();
		const schemaObject = schema as Record<string, unknown>;

		expect(schemaObject.type).toBe("object");
		expect(schemaObject.properties).toBeTypeOf("object");
	});

	it("sets schema title to HomeAgentConfig", () => {
		const { schema } = generateConfigJsonSchema();
		const schemaObject = schema as Record<string, unknown>;

		expect(schemaObject.title).toBe("HomeAgentConfig");
	});

	it("includes gateway, runtime, and security top-level properties", () => {
		const { schema } = generateConfigJsonSchema();
		const schemaObject = schema as Record<string, unknown>;
		const properties = schemaObject.properties as Record<string, unknown>;

		expect(properties).toHaveProperty("gateway");
		expect(properties).toHaveProperty("runtime");
		expect(properties).toHaveProperty("security");
	});
});