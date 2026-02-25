import { type HomeAgentConfig, HomeAgentConfigSchema } from "./schema.js";
import { deepFreeze } from "./utils.js";

/**
 * Immutable default configuration aligned with docs/plan.combined.md.
 * Derived from the schema so there is a single source of truth for defaults.
 */
export const DEFAULT_CONFIG: Readonly<HomeAgentConfig> = deepFreeze(
	HomeAgentConfigSchema.parse({}),
);
