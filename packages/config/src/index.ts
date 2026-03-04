export const packageName = "@homeagent/config";

export {
	getGatewayFrameLimits,
	getGatewayNetwork,
	getGatewayRateLimits,
	getGatewaySession,
	getRuntimeCompaction,
	getRuntimeExecution,
	getSecurityToggles,
} from "./accessors.js";
export { CONFIG_SCHEMA_VERSION } from "./constants.js";
export { DEFAULT_CONFIG } from "./defaults.js";
export type { ConfigIssue } from "./errors.js";

export { ConfigValidationError } from "./errors.js";
export type { ConfigJsonSchema } from "./json-schema.js";
export { generateConfigJsonSchema } from "./json-schema.js";
export { createConfig, parseConfig, safeParseConfig } from "./parse.js";
export type {
	GatewayConfig,
	GatewayFrameLimits,
	GatewayNetwork,
	GatewayRateLimits,
	GatewaySession,
	HomeAgentConfig,
	RuntimeCompaction,
	RuntimeConfig,
	RuntimeExecution,
	SecurityConfig,
} from "./schema.js";
export {
	GatewayConfigSchema,
	GatewayFrameLimitsSchema,
	GatewayNetworkSchema,
	GatewayRateLimitsSchema,
	GatewaySessionSchema,
	HomeAgentConfigSchema,
	RuntimeCompactionSchema,
	RuntimeConfigSchema,
	RuntimeExecutionSchema,
	SecurityConfigSchema,
} from "./schema.js";
