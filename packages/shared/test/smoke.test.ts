import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "../src/index.js";

describe("@homeagent/shared", () => {
	it("exports protocol constants", () => {
		expect(PROTOCOL_VERSION).toBe("1.0");
	});
});
