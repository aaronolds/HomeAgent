import type {
	GatewayFrameLimits,
	GatewayNetwork,
	GatewayRateLimits,
	GatewaySession,
	HomeAgentConfig,
	RuntimeCompaction,
	RuntimeExecution,
	SecurityConfig,
} from "./schema.js";

/** Extract gateway rate limit settings from a config. */
export function getGatewayRateLimits(config: HomeAgentConfig): GatewayRateLimits {
	return config.gateway.limits;
}

/** Extract gateway frame limit settings from a config. */
export function getGatewayFrameLimits(config: HomeAgentConfig): GatewayFrameLimits {
	return config.gateway.frameLimits;
}

/** Extract gateway session settings from a config. */
export function getGatewaySession(config: HomeAgentConfig): GatewaySession {
	return config.gateway.session;
}

/** Extract gateway network settings from a config. */
export function getGatewayNetwork(config: HomeAgentConfig): GatewayNetwork {
	return config.gateway.network;
}

/** Extract runtime compaction settings from a config. */
export function getRuntimeCompaction(config: HomeAgentConfig): RuntimeCompaction {
	return config.runtime.compaction;
}

/** Extract runtime execution settings from a config. */
export function getRuntimeExecution(config: HomeAgentConfig): RuntimeExecution {
	return config.runtime.execution;
}

/** Extract security toggle settings from a config. */
export function getSecurityToggles(config: HomeAgentConfig): SecurityConfig {
	return config.security;
}