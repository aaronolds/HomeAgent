import { createDefaultConfig, type GatewayConfig } from "./gateway-config.js";

function parseIntegerFlag(flagName: string, value: string): number {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`Invalid value for ${flagName}: ${value}`);
	}
	return parsed;
}

function parseArgs(
	args: string[],
): Partial<GatewayConfig> & { portProvided?: boolean } {
	const parsed: Partial<GatewayConfig> & { portProvided?: boolean } = {};

	for (let i = 0; i < args.length; i += 1) {
		const current = args[i];
		if (current === undefined) {
			continue;
		}

		if (!current.startsWith("--")) {
			continue;
		}

		const [rawFlag, inlineValue] = current.split("=", 2);
		const needsValue = rawFlag !== "--insecure";
		let value = inlineValue;
		if (needsValue && value === undefined) {
			const next = args[i + 1];
			if (next !== undefined) {
				value = next;
			}
			i += 1;
		}

		switch (rawFlag) {
			case "--insecure": {
				parsed.insecure = true;
				break;
			}
			case "--port": {
				if (value === undefined) {
					throw new Error("Missing value for --port");
				}
				parsed.port = parseIntegerFlag("--port", value);
				parsed.portProvided = true;
				break;
			}
			case "--host": {
				if (value === undefined) {
					throw new Error("Missing value for --host");
				}
				parsed.host = value;
				break;
			}
			case "--cert": {
				if (value === undefined) {
					throw new Error("Missing value for --cert");
				}
				parsed.certPath = value;
				break;
			}
			case "--key": {
				if (value === undefined) {
					throw new Error("Missing value for --key");
				}
				parsed.keyPath = value;
				break;
			}
			case "--data-dir": {
				if (value === undefined) {
					throw new Error("Missing value for --data-dir");
				}
				parsed.dataDir = value;
				break;
			}
			case "--nonce-window": {
				if (value === undefined) {
					throw new Error("Missing value for --nonce-window");
				}
				parsed.nonceWindowMs = parseIntegerFlag("--nonce-window", value);
				break;
			}
			case "--timestamp-skew": {
				if (value === undefined) {
					throw new Error("Missing value for --timestamp-skew");
				}
				parsed.timestampSkewMs = parseIntegerFlag("--timestamp-skew", value);
				break;
			}
			case "--session-ttl": {
				if (value === undefined) {
					throw new Error("Missing value for --session-ttl");
				}
				parsed.sessionTokenTtlMs = parseIntegerFlag("--session-ttl", value);
				break;
			}
			case "--idempotency-ttl": {
				if (value === undefined) {
					throw new Error("Missing value for --idempotency-ttl");
				}
				parsed.idempotencyTtlMs = parseIntegerFlag("--idempotency-ttl", value);
				break;
			}
			case "--idempotency-cleanup-interval": {
				if (value === undefined) {
					throw new Error("Missing value for --idempotency-cleanup-interval");
				}
				parsed.idempotencyCleanupIntervalMs = parseIntegerFlag(
					"--idempotency-cleanup-interval",
					value,
				);
				break;
			}
			case "--sqlite-path": {
				if (value === undefined) {
					throw new Error("Missing value for --sqlite-path");
				}
				parsed.sqlitePath = value;
				break;
			}
			default: {
				throw new Error(`Unknown flag: ${rawFlag}`);
			}
		}
	}

	return parsed;
}

export function parseCli(
	argv: string[] = process.argv.slice(2),
): GatewayConfig {
	const defaults = createDefaultConfig();
	const parsed = parseArgs(argv);

	if ((parsed.certPath !== undefined) !== (parsed.keyPath !== undefined)) {
		throw new Error("--cert and --key must be provided together");
	}

	const merged: GatewayConfig = {
		...defaults,
		...parsed,
	};

	if (parsed.insecure === true && parsed.portProvided !== true) {
		merged.port = 8080;
	}

	return merged;
}
