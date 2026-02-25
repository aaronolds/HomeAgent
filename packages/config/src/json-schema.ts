import { z } from "zod/v4";
import { CONFIG_SCHEMA_VERSION } from "./constants.js";
import { HomeAgentConfigSchema } from "./schema.js";

export interface ConfigJsonSchema {
	readonly version: string;
	readonly schema: unknown;
}

/**
 * Generate the HomeAgent config JSON Schema (draft-7).
 */
export function generateConfigJsonSchema(): ConfigJsonSchema {
	const jsonSchema = z.toJSONSchema(HomeAgentConfigSchema, {
		target: "draft-7",
	});

	const schema =
		jsonSchema && typeof jsonSchema === "object"
			? { ...jsonSchema, title: "HomeAgentConfig" }
			: jsonSchema;

	return {
		version: CONFIG_SCHEMA_VERSION,
		schema,
	};
}