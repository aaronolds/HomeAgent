import { describe, expect, it } from "vitest";
import type { GatewayServerConfig } from "../src/index.js";
import {
	computeHmac,
	createDefaultConfig,
	createGatewayServer,
	issueSessionToken,
	packageName,
	verifyHmac,
	verifySessionToken,
} from "../src/index.js";

describe("@homeagent/gateway", () => {
	it("exports package name", () => {
		expect(packageName).toBe("@homeagent/gateway");
	});

	it("exports key gateway APIs", () => {
		expect(createGatewayServer).toBeTypeOf("function");
		expect(createDefaultConfig).toBeTypeOf("function");
		expect(computeHmac).toBeTypeOf("function");
		expect(verifyHmac).toBeTypeOf("function");
		expect(issueSessionToken).toBeTypeOf("function");
		expect(verifySessionToken).toBeTypeOf("function");

		const config: GatewayServerConfig = createDefaultConfig();
		expect(config).toBeDefined();
	});
});
