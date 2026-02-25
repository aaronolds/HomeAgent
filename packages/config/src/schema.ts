import { z } from "zod/v4";

const GATEWAY_RATE_LIMITS_DEFAULT = {
	perIpConnectionsPerMinute: 10,
	perDeviceRpcPerMinute: 60,
	perDeviceAgentRunPerMinute: 10,
} as const;

const GATEWAY_FRAME_LIMITS_DEFAULT = {
	maxFrameBytes: 1_048_576,
} as const;

const GATEWAY_SESSION_DEFAULT = {
	heartbeatIntervalSeconds: 30,
	sessionTokenTtlSeconds: 3600,
	nonceReplayWindowSeconds: 300,
} as const;

const GATEWAY_NETWORK_DEFAULT = {
	originAllowlist: [] as string[],
	strictOrigin: true,
	strictCors: true,
} as const;

const RUNTIME_COMPACTION_DEFAULT = {
	thresholdRatio: 0.75,
	recencyTurns: 20,
} as const;

const RUNTIME_EXECUTION_DEFAULT = {
	toolTimeoutMs: 30_000,
} as const;

const SECURITY_DEFAULT = {
	tlsEnabled: true,
	allowInsecure: false,
	enforceAuth: true,
	enforceRbac: true,
} as const;

const GATEWAY_DEFAULT = {
	limits: GATEWAY_RATE_LIMITS_DEFAULT,
	frameLimits: GATEWAY_FRAME_LIMITS_DEFAULT,
	session: GATEWAY_SESSION_DEFAULT,
	network: GATEWAY_NETWORK_DEFAULT,
} as const;

const RUNTIME_DEFAULT = {
	compaction: RUNTIME_COMPACTION_DEFAULT,
	execution: RUNTIME_EXECUTION_DEFAULT,
} as const;

const HOME_AGENT_DEFAULT = {
	gateway: GATEWAY_DEFAULT,
	runtime: RUNTIME_DEFAULT,
	security: SECURITY_DEFAULT,
} as const;

// --- Gateway Rate Limits ---
export const GatewayRateLimitsSchema = z.object({
	/** Max connections per IP per minute */
	perIpConnectionsPerMinute: z.number().int().positive().default(10),
	/** Max RPCs per device per minute */
	perDeviceRpcPerMinute: z.number().int().positive().default(60),
	/** Max agent.run calls per device per minute */
	perDeviceAgentRunPerMinute: z.number().int().positive().default(10),
});

// --- Gateway Frame Limits ---
export const GatewayFrameLimitsSchema = z.object({
	/** Max WebSocket frame size in bytes (default 1MB) */
	maxFrameBytes: z.number().int().positive().default(1_048_576),
});

// --- Gateway Session ---
export const GatewaySessionSchema = z.object({
	/** Heartbeat interval in seconds */
	heartbeatIntervalSeconds: z.number().int().positive().default(30),
	/** Session token TTL in seconds */
	sessionTokenTtlSeconds: z.number().int().positive().default(3600),
	/** Nonce replay window in seconds */
	nonceReplayWindowSeconds: z.number().int().positive().default(300),
});

// --- Gateway Network ---
export const GatewayNetworkSchema = z.object({
	/** Allowed origins for WebSocket connections (empty = allow all when strict is false) */
	originAllowlist: z.array(z.string()).default([]),
	/** Whether to enforce strict origin checking */
	strictOrigin: z.boolean().default(true),
	/** Whether to enforce strict CORS */
	strictCors: z.boolean().default(true),
});

// --- Gateway Config ---
export const GatewayConfigSchema = z.object({
	limits: GatewayRateLimitsSchema.default(GATEWAY_RATE_LIMITS_DEFAULT),
	frameLimits: GatewayFrameLimitsSchema.default(GATEWAY_FRAME_LIMITS_DEFAULT),
	session: GatewaySessionSchema.default(GATEWAY_SESSION_DEFAULT),
	network: GatewayNetworkSchema.default(GATEWAY_NETWORK_DEFAULT),
});

// --- Runtime Compaction ---
export const RuntimeCompactionSchema = z.object({
	/** Token threshold ratio (0-1) at which compaction triggers */
	thresholdRatio: z.number().min(0).max(1).default(0.75),
	/** Number of most recent turns to always keep verbatim */
	recencyTurns: z.number().int().nonnegative().default(20),
});

// --- Runtime Execution ---
export const RuntimeExecutionSchema = z.object({
	/** Default tool execution timeout in milliseconds */
	toolTimeoutMs: z.number().int().positive().default(30_000),
});

// --- Runtime Config ---
export const RuntimeConfigSchema = z.object({
	compaction: RuntimeCompactionSchema.default(RUNTIME_COMPACTION_DEFAULT),
	execution: RuntimeExecutionSchema.default(RUNTIME_EXECUTION_DEFAULT),
});

// --- Security ---
export const SecurityConfigSchema = z.object({
	/** Whether TLS is enabled by default */
	tlsEnabled: z.boolean().default(true),
	/** Whether to allow insecure (plaintext) connections */
	allowInsecure: z.boolean().default(false),
	/** Whether to enforce authentication */
	enforceAuth: z.boolean().default(true),
	/** Whether to enforce RBAC permissions */
	enforceRbac: z.boolean().default(true),
});

// --- Root Config ---
export const HomeAgentConfigSchema = z.object({
	gateway: GatewayConfigSchema.default(GATEWAY_DEFAULT),
	runtime: RuntimeConfigSchema.default(RUNTIME_DEFAULT),
	security: SecurityConfigSchema.default(SECURITY_DEFAULT),
});

// --- Inferred Types ---
export type GatewayRateLimits = z.infer<typeof GatewayRateLimitsSchema>;
export type GatewayFrameLimits = z.infer<typeof GatewayFrameLimitsSchema>;
export type GatewaySession = z.infer<typeof GatewaySessionSchema>;
export type GatewayNetwork = z.infer<typeof GatewayNetworkSchema>;
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
export type RuntimeCompaction = z.infer<typeof RuntimeCompactionSchema>;
export type RuntimeExecution = z.infer<typeof RuntimeExecutionSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type HomeAgentConfig = z.infer<typeof HomeAgentConfigSchema>;