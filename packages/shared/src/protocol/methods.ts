import { z } from "zod/v4";
import { Identifier, NonEmptyString, Timestamp } from "./types.js";

// --- session.resolve ---
export const SessionResolveParamsSchema = z.object({
	deviceId: NonEmptyString,
	agentId: NonEmptyString.optional(),
});
export type SessionResolveParams = z.infer<typeof SessionResolveParamsSchema>;

export const SessionResolveResultSchema = z.object({
	sessionId: Identifier,
	agentId: Identifier,
	createdAt: Timestamp,
});
export type SessionResolveResult = z.infer<typeof SessionResolveResultSchema>;

// --- message.send ---
export const MessageSendParamsSchema = z.object({
	sessionId: Identifier,
	content: NonEmptyString,
	metadata: z.record(z.string(), z.unknown()).optional(),
});
export type MessageSendParams = z.infer<typeof MessageSendParamsSchema>;

export const MessageSendResultSchema = z.object({
	messageId: Identifier,
	ts: Timestamp,
});
export type MessageSendResult = z.infer<typeof MessageSendResultSchema>;

// --- agent.run ---
export const AgentRunParamsSchema = z.object({
	sessionId: Identifier,
	agentId: Identifier,
	input: z.unknown().optional(),
});
export type AgentRunParams = z.infer<typeof AgentRunParamsSchema>;

export const AgentRunResultSchema = z.object({
	runId: Identifier,
	status: z.enum(["queued", "running"]),
});
export type AgentRunResult = z.infer<typeof AgentRunResultSchema>;

// --- agent.cancel ---
export const AgentCancelParamsSchema = z.object({
	runId: Identifier,
});
export type AgentCancelParams = z.infer<typeof AgentCancelParamsSchema>;

export const AgentCancelResultSchema = z.object({
	cancelled: z.boolean(),
});
export type AgentCancelResult = z.infer<typeof AgentCancelResultSchema>;

// --- status.get ---
export const StatusGetParamsSchema = z.object({
	runId: Identifier.optional(),
	sessionId: Identifier.optional(),
});
export type StatusGetParams = z.infer<typeof StatusGetParamsSchema>;

export const StatusGetResultSchema = z.object({
	status: z.enum([
		"idle",
		"queued",
		"running",
		"completed",
		"failed",
		"cancelled",
	]),
	updatedAt: Timestamp,
});
export type StatusGetResult = z.infer<typeof StatusGetResultSchema>;

// --- node.exec.request ---
export const NodeExecRequestParamsSchema = z.object({
	nodeId: Identifier,
	command: NonEmptyString,
	args: z.array(z.string()).optional(),
	timeout: z.number().int().positive().optional(),
});
export type NodeExecRequestParams = z.infer<typeof NodeExecRequestParamsSchema>;

export const NodeExecRequestResultSchema = z.object({
	execId: Identifier,
	status: z.enum(["pending_approval", "queued"]),
});
export type NodeExecRequestResult = z.infer<typeof NodeExecRequestResultSchema>;

// --- node.exec.approve ---
export const NodeExecApproveParamsSchema = z.object({
	execId: Identifier,
	approved: z.boolean(),
});
export type NodeExecApproveParams = z.infer<typeof NodeExecApproveParamsSchema>;

export const NodeExecApproveResultSchema = z.object({
	execId: Identifier,
	status: z.enum(["approved", "rejected"]),
});
export type NodeExecApproveResult = z.infer<typeof NodeExecApproveResultSchema>;

// --- device.revoke ---
export const DeviceRevokeParamsSchema = z.object({
	deviceId: NonEmptyString,
	reason: z.string().optional(),
});
export type DeviceRevokeParams = z.infer<typeof DeviceRevokeParamsSchema>;

export const DeviceRevokeResultSchema = z.object({
	revoked: z.boolean(),
});
export type DeviceRevokeResult = z.infer<typeof DeviceRevokeResultSchema>;

// --- plugin.disable ---
export const PluginDisableParamsSchema = z.object({
	pluginId: Identifier,
	reason: z.string().optional(),
});
export type PluginDisableParams = z.infer<typeof PluginDisableParamsSchema>;

export const PluginDisableResultSchema = z.object({
	disabled: z.boolean(),
});
export type PluginDisableResult = z.infer<typeof PluginDisableResultSchema>;

/**
 * Maps method names to their param/result schema pairs.
 */
export const MethodSchemas = {
	"session.resolve": {
		params: SessionResolveParamsSchema,
		result: SessionResolveResultSchema,
	},
	"message.send": {
		params: MessageSendParamsSchema,
		result: MessageSendResultSchema,
	},
	"agent.run": { params: AgentRunParamsSchema, result: AgentRunResultSchema },
	"agent.cancel": {
		params: AgentCancelParamsSchema,
		result: AgentCancelResultSchema,
	},
	"status.get": {
		params: StatusGetParamsSchema,
		result: StatusGetResultSchema,
	},
	"node.exec.request": {
		params: NodeExecRequestParamsSchema,
		result: NodeExecRequestResultSchema,
	},
	"node.exec.approve": {
		params: NodeExecApproveParamsSchema,
		result: NodeExecApproveResultSchema,
	},
	"device.revoke": {
		params: DeviceRevokeParamsSchema,
		result: DeviceRevokeResultSchema,
	},
	"plugin.disable": {
		params: PluginDisableParamsSchema,
		result: PluginDisableResultSchema,
	},
} as const;
