import { describe, expect, it } from "vitest";
import { RPC_METHODS } from "../protocol/constants.js";
import { MethodSchemas } from "../protocol/methods.js";

describe("method schemas", () => {
	const validParams: Record<string, unknown> = {
		"session.resolve": { deviceId: "device-1", agentId: "agent-1" },
		"message.send": { sessionId: "session-1", content: "hello" },
		"agent.run": {
			sessionId: "session-1",
			agentId: "agent-1",
			input: { text: "hi" },
		},
		"agent.cancel": { runId: "run-1" },
		"status.get": { runId: "run-1" },
		"node.exec.request": {
			nodeId: "node-1",
			command: "echo",
			args: ["hi"],
			timeout: 1000,
		},
		"node.exec.approve": { execId: "exec-1", approved: true },
		"device.revoke": { deviceId: "device-1", reason: "rotated" },
		"plugin.disable": { pluginId: "plugin-1", reason: "policy" },
	};

	const invalidParams: Record<string, unknown> = {
		"session.resolve": { deviceId: 1 },
		"message.send": { sessionId: "session-1" },
		"agent.run": { sessionId: "session-1" },
		"agent.cancel": {},
		"status.get": { runId: 1 },
		"node.exec.request": { nodeId: "node-1", command: "" },
		"node.exec.approve": { execId: "exec-1", approved: "yes" },
		"device.revoke": { deviceId: "" },
		"plugin.disable": { pluginId: 1 },
	};

	const validResults: Record<string, unknown> = {
		"session.resolve": {
			sessionId: "session-1",
			agentId: "agent-1",
			createdAt: Date.now(),
		},
		"message.send": { messageId: "message-1", ts: Date.now() },
		"agent.run": { runId: "run-1", status: "queued" },
		"agent.cancel": { cancelled: true },
		"status.get": { status: "running", updatedAt: Date.now() },
		"node.exec.request": { execId: "exec-1", status: "queued" },
		"node.exec.approve": { execId: "exec-1", status: "approved" },
		"device.revoke": { revoked: true },
		"plugin.disable": { disabled: true },
	};

	it("Each method's params schema accepts valid data", () => {
		for (const method of RPC_METHODS) {
			const schema = MethodSchemas[method].params;
			expect(schema.safeParse(validParams[method]).success).toBe(true);
		}
	});

	it("Each method's params schema rejects invalid data", () => {
		for (const method of RPC_METHODS) {
			const schema = MethodSchemas[method].params;
			expect(schema.safeParse(invalidParams[method]).success).toBe(false);
		}
	});

	it("MethodSchemas has entries for all RPC_METHODS", () => {
		for (const method of RPC_METHODS) {
			expect(MethodSchemas).toHaveProperty(method);
			expect(MethodSchemas[method]).toHaveProperty("params");
			expect(MethodSchemas[method]).toHaveProperty("result");
		}
	});

	it("Each result schema accepts valid data", () => {
		for (const method of RPC_METHODS) {
			const schema = MethodSchemas[method].result;
			expect(schema.safeParse(validResults[method]).success).toBe(true);
		}
	});
});
