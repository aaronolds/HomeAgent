/**
 * Recursively freeze an object and all its nested object/array properties.
 */
export function deepFreeze<T>(value: T): T {
	if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const key of Object.keys(value)) {
			deepFreeze((value as Record<string, unknown>)[key]);
		}
	}
	return value;
}
