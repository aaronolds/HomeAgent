import { describe, expect, it } from "vitest";
import { packageName } from "../src/index.js";

describe("@homeagent/provider-whatsapp", () => {
	it("exports package name", () => {
		expect(packageName).toBe("@homeagent/provider-whatsapp");
	});
});
