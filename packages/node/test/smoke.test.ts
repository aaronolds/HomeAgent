import { describe, expect, it } from "vitest";
import { packageName } from "../src/index.js";

describe("@homeagent/node", () => {
	it("exports package name", () => {
		expect(packageName).toBe("@homeagent/node");
	});
});
