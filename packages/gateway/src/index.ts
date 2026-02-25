export const packageName = "@homeagent/gateway";

export type {
	GatewayConfig,
	GatewayRateLimits,
	GatewayFrameLimits,
	GatewaySession,
	GatewayNetwork,
} from "@homeagent/config";

export {
	getGatewayRateLimits,
	getGatewayFrameLimits,
	getGatewaySession,
	getGatewayNetwork,
} from "@homeagent/config";
