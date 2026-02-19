/**
 * Protocol version for all envelopes.
 */
export const PROTOCOL_VERSION = "1.0" as const;

/**
 * RBAC roles supported by the protocol.
 */
export const ROLES = ["client", "node", "admin"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Methods that require an idempotency key.
 */
export const IDEMPOTENT_METHODS = [
	"message.send",
	"agent.run",
	"node.exec.request",
	"node.exec.approve",
] as const;
export type IdempotentMethod = (typeof IDEMPOTENT_METHODS)[number];

/**
 * All supported RPC method names.
 */
export const RPC_METHODS = [
	"session.resolve",
	"message.send",
	"agent.run",
	"agent.cancel",
	"status.get",
	"node.exec.request",
	"node.exec.approve",
	"device.revoke",
	"plugin.disable",
] as const;
export type RpcMethod = (typeof RPC_METHODS)[number];
