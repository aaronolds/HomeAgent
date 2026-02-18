import { describe, expect, it } from "vitest";
import { packageName } from "../src/index.js";

describe("@homeagent/provider-slack", () => {
	it("exports package name", () => {
		expect(packageName).toBe("@homeagent/provider-slack");
	});
});
