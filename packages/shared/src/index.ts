export const packageName = "@homeagent/shared";

/** System capabilities a tool or plugin may require */
export type Capability =
	| "fs.read"
	| "fs.write"
	| "fs.exec"
	| "net.outbound"
	| "net.listen"
	| "shell.exec"
	| "browser"
	| "secrets.read"
	| "admin";

/** Permission policy controlling which capabilities are allowed or denied */
export interface PermissionPolicy {
	/** Explicitly allowed capabilities; when set, all others are denied */
	allow?: Capability[];
	/** Explicitly denied capabilities; takes precedence over allow */
	deny?: Capability[];
}

/** Security context attached to every agent execution request */
export interface SecurityContext {
	/** ID of the requesting device */
	deviceId: string;
	/** Role bound to the device at pairing time */
	role: "client" | "node" | "admin";
	/** Active permission policy for this session */
	policy: PermissionPolicy;
}

/**
 * Returns true if all required capabilities are permitted under the given policy.
 * Deny list takes precedence over allow list.
 */
export function isPermitted(
	policy: PermissionPolicy,
	capabilities: Capability[],
): boolean {
	for (const cap of capabilities) {
		if (policy.deny?.includes(cap)) {
			return false;
		}
		if (policy.allow !== undefined && !policy.allow.includes(cap)) {
			return false;
		}
	}
	return true;
}
