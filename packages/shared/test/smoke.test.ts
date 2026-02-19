import { describe, expect, it } from "vitest";
import {
	isPermitted,
	type PermissionPolicy,
	packageName,
} from "../src/index.js";

describe("@homeagent/shared", () => {
	it("exports package name", () => {
		expect(packageName).toBe("@homeagent/shared");
	});

	describe("isPermitted", () => {
		it("allows all capabilities when no policy restrictions are set", () => {
			const policy: PermissionPolicy = {};
			expect(isPermitted(policy, ["fs.read", "net.outbound"])).toBe(true);
		});

		it("allows capabilities in the allow list", () => {
			const policy: PermissionPolicy = { allow: ["fs.read"] };
			expect(isPermitted(policy, ["fs.read"])).toBe(true);
		});

		it("denies capabilities not in the allow list", () => {
			const policy: PermissionPolicy = { allow: ["fs.read"] };
			expect(isPermitted(policy, ["shell.exec"])).toBe(false);
		});

		it("denies capabilities in the deny list", () => {
			const policy: PermissionPolicy = { deny: ["shell.exec"] };
			expect(isPermitted(policy, ["shell.exec"])).toBe(false);
		});

		it("deny list takes precedence over allow list", () => {
			const policy: PermissionPolicy = {
				allow: ["shell.exec"],
				deny: ["shell.exec"],
			};
			expect(isPermitted(policy, ["shell.exec"])).toBe(false);
		});

		it("returns true for an empty capabilities array", () => {
			const policy: PermissionPolicy = { allow: ["fs.read"] };
			expect(isPermitted(policy, [])).toBe(true);
		});

		it("denies when any required capability is missing from allow list", () => {
			const policy: PermissionPolicy = { allow: ["fs.read", "net.outbound"] };
			expect(isPermitted(policy, ["fs.read", "shell.exec"])).toBe(false);
		});

		it("allows when all required capabilities are in the allow list", () => {
			const policy: PermissionPolicy = { allow: ["fs.read", "net.outbound"] };
			expect(isPermitted(policy, ["fs.read", "net.outbound"])).toBe(true);
		});
	});
});
