#!/usr/bin/env node

import { parseCli } from "./config/parse-cli.js";
import { startGateway } from "./server/create-gateway-server.js";

function maskValue(value: string | undefined): string | undefined {
	if (value === undefined || value.length === 0) {
		return undefined;
	}
	return "[redacted]";
}

async function main(): Promise<void> {
	const config = parseCli();
	const safeConfig = {
		...config,
		jwtSecret: maskValue(config.jwtSecret),
	};

	console.log("[gateway] parsed startup config", safeConfig);

	await startGateway(config);
}

main().catch((error: unknown) => {
	console.error("[gateway] failed to start", {
		error: error instanceof Error ? error.message : String(error),
	});
	process.exitCode = 1;
});
