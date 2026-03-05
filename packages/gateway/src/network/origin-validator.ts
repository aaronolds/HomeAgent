/**
 * Validate a WebSocket connection's Origin header against an allowlist.
 *
 * Rules:
 * - If strictOrigin=false and allowlist is empty → allow all origins (including missing)
 * - If strictOrigin=true and origin is missing → reject
 * - If allowlist is non-empty, origin must match one entry (case-insensitive)
 * - If strictOrigin=false and origin is missing but allowlist is non-empty → reject
 *   (allowlist takes precedence when provided)
 */
export function validateOrigin(
	origin: string | undefined,
	allowlist: string[],
	strictOrigin: boolean,
): boolean {
	// Non-strict mode with empty allowlist = allow everything
	if (!strictOrigin && allowlist.length === 0) {
		return true;
	}

	// No origin header present
	if (origin === undefined || origin === "") {
		return false;
	}

	// If allowlist is empty but strictOrigin is true, any origin is accepted
	// (strict just means origin header must be present)
	if (allowlist.length === 0) {
		return true;
	}

	// Check against allowlist (case-insensitive)
	const normalizedOrigin = origin.toLowerCase();
	return allowlist.some(
		(allowed) => allowed.toLowerCase() === normalizedOrigin,
	);
}
