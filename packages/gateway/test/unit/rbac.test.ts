import type { RpcMethod } from "@homeagent/shared";
import { describe, expect, it } from "vitest";
import {
	getMethodsForRole,
	isAuthorized,
	RBAC_MATRIX,
} from "../../src/rpc/rbac.js";

describe("RBAC", () => {
	describe("isAuthorized", () => {
		it("allows client to call session.resolve", () => {
			expect(isAuthorized("client", "session.resolve")).toBe(true);
		});

		it("allows client to call message.send", () => {
			expect(isAuthorized("client", "message.send")).toBe(true);
		});

		it("denies client from calling device.revoke", () => {
			expect(isAuthorized("client", "device.revoke")).toBe(false);
		});

		it("denies client from calling plugin.disable", () => {
			expect(isAuthorized("client", "plugin.disable")).toBe(false);
		});

		it("denies client from calling node.exec.approve", () => {
			expect(isAuthorized("client", "node.exec.approve")).toBe(false);
		});

		it("denies node from calling message.send", () => {
			expect(isAuthorized("node", "message.send")).toBe(false);
		});

		it("allows node to call session.resolve", () => {
			expect(isAuthorized("node", "session.resolve")).toBe(true);
		});

		it("allows node to call status.get", () => {
			expect(isAuthorized("node", "status.get")).toBe(true);
		});

		it("denies node from calling device.revoke", () => {
			expect(isAuthorized("node", "device.revoke")).toBe(false);
		});

		it("allows admin to call all methods", () => {
			for (const method of Object.keys(RBAC_MATRIX)) {
				expect(isAuthorized("admin", method as RpcMethod)).toBe(true);
			}
		});
	});

	describe("getMethodsForRole", () => {
		it("returns correct methods for client", () => {
			const methods = getMethodsForRole("client");
			expect(methods).toContain("session.resolve");
			expect(methods).toContain("message.send");
			expect(methods).not.toContain("device.revoke");
		});

		it("returns all methods for admin", () => {
			const methods = getMethodsForRole("admin");
			expect(methods).toHaveLength(Object.keys(RBAC_MATRIX).length);
		});

		it("returns limited methods for node", () => {
			const methods = getMethodsForRole("node");
			expect(methods).toContain("session.resolve");
			expect(methods).toContain("status.get");
			expect(methods).not.toContain("message.send");
		});
	});
});
