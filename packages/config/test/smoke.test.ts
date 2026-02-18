import { describe, expect, it } from "vitest";
import { packageName } from "../src/index.js";

describe("@homeagent/config", () => {
	it("exports package name", () => {
		expect(packageName).toBe("@homeagent/config");
	});
});
