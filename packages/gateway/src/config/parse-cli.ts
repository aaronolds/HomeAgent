import {
	createDefaultConfig,
	type GatewayServerConfig,
} from "./gateway-config.js";

function parseIntegerFlag(flagName: string, value: string): number {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`Invalid value for ${flagName}: ${value}`);
	}
	return parsed;
}

interface ParsedArgs {
	config: Partial<GatewayServerConfig> & { portProvided?: boolean };
	originAllowlist?: string[] | undefined;
	strictOrigin?: boolean | undefined;
	strictCors?: boolean | undefined;
	maxFrameBytes?: number | undefined;
	perIpConnectionsPerMinute?: number | undefined;
	perDeviceRpcPerMinute?: number | undefined;
	perDeviceAgentRunPerMinute?: number | undefined;
}

function parseArgs(args: string[]): ParsedArgs {
	const parsed: Partial<GatewayServerConfig> & { portProvided?: boolean } = {};
	let originAllowlist: string[] | undefined;
	let strictOrigin: boolean | undefined;
	let strictCors: boolean | undefined;
	let maxFrameBytes: number | undefined;
	let perIpConnectionsPerMinute: number | undefined;
	let perDeviceRpcPerMinute: number | undefined;
	let perDeviceAgentRunPerMinute: number | undefined;

	for (let i = 0; i < args.length; i += 1) {
		const current = args[i];
		if (current === undefined) {
			continue;
		}

		if (!current.startsWith("--")) {
			continue;
		}

		const [rawFlag, inlineValue] = current.split("=", 2);
		const booleanFlags = new Set([
			"--insecure",
			"--no-strict-origin",
			"--no-strict-cors",
		]);
		const needsValue = !booleanFlags.has(rawFlag!);
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
			case "--origin-allowlist": {
				if (value === undefined) {
					throw new Error("Missing value for --origin-allowlist");
				}
				originAllowlist = value
					.split(",")
					.map((s) => s.trim())
					.filter((s) => s.length > 0);
				break;
			}
			case "--no-strict-origin": {
				strictOrigin = false;
				break;
			}
			case "--no-strict-cors": {
				strictCors = false;
				break;
			}
			case "--max-frame-bytes": {
				if (value === undefined) {
					throw new Error("Missing value for --max-frame-bytes");
				}
				maxFrameBytes = parseIntegerFlag("--max-frame-bytes", value);
				break;
			}
			case "--rate-limit-ip": {
				if (value === undefined) {
					throw new Error("Missing value for --rate-limit-ip");
				}
				perIpConnectionsPerMinute = parseIntegerFlag("--rate-limit-ip", value);
				break;
			}
			case "--rate-limit-rpc": {
				if (value === undefined) {
					throw new Error("Missing value for --rate-limit-rpc");
				}
				perDeviceRpcPerMinute = parseIntegerFlag("--rate-limit-rpc", value);
				break;
			}
			case "--rate-limit-agent-run": {
				if (value === undefined) {
					throw new Error("Missing value for --rate-limit-agent-run");
				}
				perDeviceAgentRunPerMinute = parseIntegerFlag(
					"--rate-limit-agent-run",
					value,
				);
				break;
			}
			default: {
				throw new Error(`Unknown flag: ${rawFlag}`);
			}
		}
	}

	return {
		config: parsed,
		originAllowlist,
		strictOrigin,
		strictCors,
		maxFrameBytes,
		perIpConnectionsPerMinute,
		perDeviceRpcPerMinute,
		perDeviceAgentRunPerMinute,
	};
}

export function parseCli(
	argv: string[] = process.argv.slice(2),
): GatewayServerConfig {
	const defaults = createDefaultConfig();
	const {
		config: parsed,
		originAllowlist,
		strictOrigin,
		strictCors,
		maxFrameBytes,
		perIpConnectionsPerMinute,
		perDeviceRpcPerMinute,
		perDeviceAgentRunPerMinute,
	} = parseArgs(argv);

	if ((parsed.certPath !== undefined) !== (parsed.keyPath !== undefined)) {
		throw new Error("--cert and --key must be provided together");
	}

	const merged: GatewayServerConfig = {
		...defaults,
		...parsed,
		rateLimits: {
			...defaults.rateLimits,
			...(perIpConnectionsPerMinute !== undefined && {
				perIpConnectionsPerMinute,
			}),
			...(perDeviceRpcPerMinute !== undefined && { perDeviceRpcPerMinute }),
			...(perDeviceAgentRunPerMinute !== undefined && {
				perDeviceAgentRunPerMinute,
			}),
		},
		frameLimits: {
			...defaults.frameLimits,
			...(maxFrameBytes !== undefined && { maxFrameBytes }),
		},
		network: {
			...defaults.network,
			...(originAllowlist !== undefined && { originAllowlist }),
			...(strictOrigin !== undefined && { strictOrigin }),
			...(strictCors !== undefined && { strictCors }),
		},
	};

	if (parsed.insecure === true && parsed.portProvided !== true) {
		merged.port = 8080;
	}

	return merged;
}
