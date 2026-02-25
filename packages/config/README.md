# @homeagent/config

Centralized configuration package for HomeAgent. Provides typed config schemas, default values, validation with clear error messages, accessor helpers, and JSON Schema export.

## Installation

```bash
pnpm add @homeagent/config
```

Workspace dependency:

```json
"@homeagent/config": "workspace:*"
```

## Quick Start

```typescript
import { createConfig, parseConfig } from "@homeagent/config";

// Get default config
const defaultConfig = createConfig();

// Parse and validate custom config (merges with defaults)
const customConfig = parseConfig({
	gateway: {
		limits: { perIpConnectionsPerMinute: 20 },
	},
});
```

## Schema Overview

| Section | Path | Defaults |
| --- | --- | --- |
| Gateway Rate Limits | `gateway.limits` | `perIpConnectionsPerMinute: 10`<br>`perDeviceRpcPerMinute: 60`<br>`perDeviceAgentRunPerMinute: 10` |
| Gateway Frame Limits | `gateway.frameLimits` | `maxFrameBytes: 1048576` (1MB) |
| Gateway Session | `gateway.session` | `heartbeatIntervalSeconds: 30`<br>`sessionTokenTtlSeconds: 3600`<br>`nonceReplayWindowSeconds: 300` |
| Gateway Network | `gateway.network` | `originAllowlist: []`<br>`strictOrigin: true`<br>`strictCors: true` |
| Runtime Compaction | `runtime.compaction` | `thresholdRatio: 0.75`<br>`recencyTurns: 20` |
| Runtime Execution | `runtime.execution` | `toolTimeoutMs: 30000` |
| Security | `security` | `tlsEnabled: true`<br>`allowInsecure: false`<br>`enforceAuth: true`<br>`enforceRbac: true` |

## API Reference

- `parseConfig(raw)` - Parse and validate, throws `ConfigValidationError`
- `safeParseConfig(raw)` - Non-throwing version returning result object
- `createConfig(overrides?)` - Create frozen config with defaults
- `DEFAULT_CONFIG` - Immutable default config object
- Accessor functions: `getGatewayRateLimits(config)`, `getGatewayFrameLimits(config)`, `getGatewaySession(config)`, `getGatewayNetwork(config)`, `getRuntimeCompaction(config)`, `getRuntimeExecution(config)`, `getSecurityToggles(config)`
- `generateConfigJsonSchema()` - Generate JSON Schema (draft-7)
- `CONFIG_SCHEMA_VERSION` - Current schema version (`"1.0"`)

## Error Handling

```typescript
import { parseConfig, ConfigValidationError } from "@homeagent/config";

try {
	parseConfig({ gateway: { limits: { perIpConnectionsPerMinute: -1 } } });
} catch (err) {
	if (err instanceof ConfigValidationError) {
		console.error(err.formatIssues());
	}
}
```

## JSON Schema Export

```bash
pnpm --filter @homeagent/config build
pnpm --filter @homeagent/config schema:generate
```

Outputs `homeagent-config.v1.0.json` in `packages/config/src/generated` for operator tooling and documentation.

## Schema Version

Current version: `1.0`
