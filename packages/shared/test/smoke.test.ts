import { describe, expect, it } from "vitest";
import { packageName } from "../src/index.js";

describe("@homeagent/shared", () => {
	it("exports package name", () => {
		expect(packageName).toBe("@homeagent/shared");
	});
});
