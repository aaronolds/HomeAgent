const DEFAULT_REDACT_FIELDS = [
	"sharedSecret",
	"token",
	"apiKey",
	"passphrase",
	"password",
	"secret",
];

export function redactSecret(value: string): string {
	if (value.length > 4) {
		return `****${value.slice(-4)}`;
	}
	return "****";
}

export function redactFields<T extends Record<string, unknown>>(
	obj: T,
	fields?: string[],
): T {
	const redactSet = new Set(fields ?? DEFAULT_REDACT_FIELDS);
	return redactDeep(obj, redactSet) as T;
}

function redactDeep(value: unknown, fields: Set<string>): unknown {
	if (value === null || value === undefined) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => redactDeep(item, fields));
	}
	if (typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			if (fields.has(key) && typeof val === "string") {
				result[key] = redactSecret(val);
			} else if (typeof val === "object" && val !== null) {
				result[key] = redactDeep(val, fields);
			} else {
				result[key] = val;
			}
		}
		return result;
	}
	return value;
}
