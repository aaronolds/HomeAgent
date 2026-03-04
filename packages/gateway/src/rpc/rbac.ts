import type { Role, RpcMethod } from "@homeagent/shared";

/**
 * RBAC access matrix: maps each RPC method to the roles that may call it.
 */
export const RBAC_MATRIX: Record<RpcMethod, readonly Role[]> = {
	"session.resolve": ["client", "node", "admin"],
	"message.send": ["client", "admin"],
	"agent.run": ["client", "admin"],
	"agent.cancel": ["client", "admin"],
	"status.get": ["client", "node", "admin"],
	"node.exec.request": ["client", "admin"],
	"node.exec.approve": ["admin"],
	"device.revoke": ["admin"],
	"plugin.disable": ["admin"],
};

export function isAuthorized(role: Role, method: RpcMethod): boolean {
	return RBAC_MATRIX[method].includes(role);
}

export function getMethodsForRole(role: Role): readonly RpcMethod[] {
	const methods: RpcMethod[] = [];

	for (const method of Object.keys(RBAC_MATRIX) as RpcMethod[]) {
		if (RBAC_MATRIX[method].includes(role)) {
			methods.push(method);
		}
	}

	return methods;
}
