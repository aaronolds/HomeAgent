export const packageName = "@homeagent/config";

export { CONFIG_SCHEMA_VERSION } from "./constants.js";

export {
	HomeAgentConfigSchema,
	GatewayConfigSchema,
	GatewayRateLimitsSchema,
	GatewayFrameLimitsSchema,
	GatewaySessionSchema,
	GatewayNetworkSchema,
	RuntimeConfigSchema,
	RuntimeCompactionSchema,
	RuntimeExecutionSchema,
	SecurityConfigSchema,
} from "./schema.js";

export type {
	HomeAgentConfig,
	GatewayConfig,
	GatewayRateLimits,
	GatewayFrameLimits,
	GatewaySession,
	GatewayNetwork,
	RuntimeConfig,
	RuntimeCompaction,
	RuntimeExecution,
	SecurityConfig,
} from "./schema.js";

export { DEFAULT_CONFIG } from "./defaults.js";

export { ConfigValidationError } from "./errors.js";
export type { ConfigIssue } from "./errors.js";

export { parseConfig, safeParseConfig, createConfig } from "./parse.js";

export {
	getGatewayRateLimits,
	getGatewayFrameLimits,
	getGatewaySession,
	getGatewayNetwork,
	getRuntimeCompaction,
	getRuntimeExecution,
	getSecurityToggles,
} from "./accessors.js";

export { generateConfigJsonSchema } from "./json-schema.js";
export type { ConfigJsonSchema } from "./json-schema.js";
