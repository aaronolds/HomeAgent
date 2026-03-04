import type { Role, RpcMethod } from "@homeagent/shared";

/**
 * Context passed to each RPC handler.
 */
export interface RpcContext {
	connectionId: string;
	deviceId: string;
	role: Role;
	sessionToken: string;
}

/**
 * Handler function type for RPC methods.
 */
export type RpcHandler = (
	params: Record<string, unknown>,
	context: RpcContext,
) => Promise<Record<string, unknown>>;

/**
 * Method registration entry.
 */
export interface MethodRegistration {
	method: RpcMethod;
	handler: RpcHandler;
}
