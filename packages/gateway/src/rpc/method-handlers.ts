import { randomUUID } from "node:crypto";

import { MethodSchemas } from "@homeagent/shared";

import type { AuditLog } from "../audit/audit-log.js";
import type { OperationalStore } from "../persistence/operational-store.js";
import type { ConnectionManager } from "../server/connection-context.js";
import { forbidden, invalidParams } from "./errors.js";
import type { MethodRegistry } from "./method-registry.js";
import type { RpcContext, RpcHandler } from "./types.js";

export interface HandlerDependencies {
	operationalStore: OperationalStore;
	connectionManager: ConnectionManager;
	auditLog: AuditLog;
}

type SupportedMethod = keyof typeof MethodSchemas;
type MethodParams<M extends SupportedMethod> = ReturnType<
	(typeof MethodSchemas)[M]["params"]["parse"]
>;

function parseParams<M extends SupportedMethod>(
	method: M,
	params: Record<string, unknown>,
): MethodParams<M> {
	const parsed = MethodSchemas[method].params.safeParse(params);
	if (!parsed.success) {
		throw invalidParams(parsed.error.message);
	}

	return parsed.data as MethodParams<M>;
}

function requireAdmin(
	context: RpcContext,
	method: "device.revoke" | "plugin.disable",
): void {
	if (context.role !== "admin") {
		throw forbidden(context.role, method);
	}
}

async function handleSessionResolve(
	params: Record<string, unknown>,
	_context: RpcContext,
): Promise<Record<string, unknown>> {
	const parsed = parseParams("session.resolve", params);
	return {
		sessionId: randomUUID(),
		agentId: parsed.agentId ?? "default-agent",
		createdAt: Date.now(),
	};
}

async function handleMessageSend(
	params: Record<string, unknown>,
	_context: RpcContext,
): Promise<Record<string, unknown>> {
	parseParams("message.send", params);
	return {
		messageId: randomUUID(),
		ts: Date.now(),
	};
}

async function handleAgentRun(
	params: Record<string, unknown>,
	_context: RpcContext,
): Promise<Record<string, unknown>> {
	parseParams("agent.run", params);
	return {
		runId: randomUUID(),
		status: "queued",
	};
}

async function handleAgentCancel(
	params: Record<string, unknown>,
	_context: RpcContext,
): Promise<Record<string, unknown>> {
	parseParams("agent.cancel", params);
	return { cancelled: true };
}

async function handleStatusGet(
	params: Record<string, unknown>,
	_context: RpcContext,
): Promise<Record<string, unknown>> {
	parseParams("status.get", params);
	return {
		status: "idle",
		updatedAt: Date.now(),
	};
}

async function handleNodeExecRequest(
	params: Record<string, unknown>,
	_context: RpcContext,
): Promise<Record<string, unknown>> {
	parseParams("node.exec.request", params);
	return {
		execId: randomUUID(),
		status: "pending_approval",
	};
}

async function handleNodeExecApprove(
	params: Record<string, unknown>,
	_context: RpcContext,
): Promise<Record<string, unknown>> {
	const parsed = parseParams("node.exec.approve", params);
	return {
		execId: parsed.execId,
		status: parsed.approved ? "approved" : "rejected",
	};
}

function createDeviceRevokeHandler(deps: HandlerDependencies): RpcHandler {
	return async (
		params: Record<string, unknown>,
		context: RpcContext,
	): Promise<Record<string, unknown>> => {
		requireAdmin(context, "device.revoke");
		const parsed = parseParams("device.revoke", params);

		const revoked = deps.operationalStore.revokeDevice(parsed.deviceId);
		if (revoked === undefined) {
			return { revoked: false };
		}

		deps.connectionManager.removeByDeviceId(parsed.deviceId);
		await deps.auditLog.log({
			timestamp: Date.now(),
			event: "device_revoked",
			outcome: "success",
			deviceId: parsed.deviceId,
			details: {
				reason: parsed.reason,
				revokedBy: context.deviceId,
			},
		});

		return { revoked: true };
	};
}

function createPluginDisableHandler(deps: HandlerDependencies): RpcHandler {
	return async (
		params: Record<string, unknown>,
		context: RpcContext,
	): Promise<Record<string, unknown>> => {
		requireAdmin(context, "plugin.disable");
		const parsed = parseParams("plugin.disable", params);

		await deps.auditLog.log({
			timestamp: Date.now(),
			event: "plugin_disabled",
			outcome: "success",
			details: {
				pluginId: parsed.pluginId,
				reason: parsed.reason,
				disabledBy: context.deviceId,
			},
		});

		return { disabled: true };
	};
}

export function registerV1Handlers(
	registry: MethodRegistry,
	deps: HandlerDependencies,
): void {
	registry.register("session.resolve", handleSessionResolve);
	registry.register("message.send", handleMessageSend);
	registry.register("agent.run", handleAgentRun);
	registry.register("agent.cancel", handleAgentCancel);
	registry.register("status.get", handleStatusGet);
	registry.register("node.exec.request", handleNodeExecRequest);
	registry.register("node.exec.approve", handleNodeExecApprove);
	registry.register("device.revoke", createDeviceRevokeHandler(deps));
	registry.register("plugin.disable", createPluginDisableHandler(deps));
}
