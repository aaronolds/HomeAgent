/**
 * A single config validation issue with path info.
 */
export interface ConfigIssue {
	readonly path: readonly (string | number)[];
	readonly message: string;
}

/**
 * Error thrown when config validation fails at startup.
 */
export class ConfigValidationError extends Error {
	public readonly issues: readonly ConfigIssue[];

	constructor(message: string, issues: readonly ConfigIssue[]) {
		super(message);
		this.name = "ConfigValidationError";
		this.issues = issues;
	}

	/**
	 * Format all issues as a human-readable string for CLI/log output.
	 */
	formatIssues(): string {
		return this.issues
			.map((issue) => {
				const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
				return `  - ${path}: ${issue.message}`;
			})
			.join("\n");
	}
}