import type { z } from "zod/v4";
import type { ConfigIssue } from "./errors.js";
import { ConfigValidationError } from "./errors.js";
import type { HomeAgentConfig } from "./schema.js";
import { HomeAgentConfigSchema } from "./schema.js";
import { deepFreeze } from "./utils.js";

function toConfigPath(
	path: readonly PropertyKey[],
): readonly (string | number)[] {
	return path.filter(
		(segment): segment is string | number => typeof segment !== "symbol",
	);
}

function toConfigIssues(error: z.core.$ZodError): readonly ConfigIssue[] {
	return error.issues.map((issue) => ({
		path: toConfigPath(issue.path),
		message: issue.message,
	}));
}

/**
 * Parse and validate raw config input. Throws on invalid input.
 *
 * @throws {ConfigValidationError} if validation fails
 */
export function parseConfig(raw: unknown): HomeAgentConfig {
	const result = HomeAgentConfigSchema.safeParse(raw);
	if (!result.success) {
		throw new ConfigValidationError(
			"Invalid configuration",
			toConfigIssues(result.error),
		);
	}
	return result.data;
}

/**
 * Safe version of parseConfig that returns a result object instead of throwing.
 */
export function safeParseConfig(
	raw: unknown,
):
	| { success: true; data: HomeAgentConfig }
	| { success: false; error: ConfigValidationError } {
	const result = HomeAgentConfigSchema.safeParse(raw);
	if (!result.success) {
		return {
			success: false,
			error: new ConfigValidationError(
				"Invalid configuration",
				toConfigIssues(result.error),
			),
		};
	}
	return { success: true, data: result.data };
}

/**
 * Create a validated, frozen config by merging overrides with defaults.
 * Pass an empty object or partial config to get defaults for all unspecified fields.
 */
export function createConfig(
	overrides: unknown = {},
): Readonly<HomeAgentConfig> {
	const config = parseConfig(overrides);
	return deepFreeze(config);
}