# CLI: Onboarding Wizard & Core Commands

## Overview
Implement the command-line interface for HomeAgent using Commander. The CLI provides the operator interface for initial setup (onboarding wizard), agent management, message sending, and runtime control. This is the primary way operators interact with HomeAgent outside of messaging providers.

## Scope

**Included:**
- CLI powered by Commander with TypeScript strict typing
- **Onboarding wizard:**
  - Create first agent (name, model, provider)
  - Configure LLM credentials (stored via secrets manager)
  - Configure Telegram provider credentials
  - Generate TLS certificates (self-signed)
  - Pair first device (create shared secret, output QR/code)
- **Core commands:**
  - `homeagent start` — start the gateway server
  - `homeagent stop` — stop the gateway (if daemonized)
  - `homeagent status` — show server status, connected devices, active sessions
  - `homeagent send <message>` — send a message to an agent as if from CLI
  - `homeagent agent create <name>` — create a new agent
  - `homeagent agent list` — list all agents
  - `homeagent agent run <agentId> <input>` — run the agent loop directly
  - `homeagent sessions list` — list active sessions
  - `homeagent device pair` — pair a new device
  - `homeagent device list` — list paired devices
  - `homeagent device approve <deviceId>` — approve a pending device
  - `homeagent approvals list` — list pending approvals
  - `homeagent config show` — display current configuration
  - `homeagent config set <key> <value>` — update configuration

**Excluded:**
- Incident response commands (see #025)
- GUI/web interface (future)

## Technical Requirements

### CLI Structure
```typescript
import { Command } from 'commander';

const program = new Command()
  .name('homeagent')
  .version('0.1.0')
  .description('Self-hosted personal AI assistant');

// Sub-commands
program.addCommand(startCommand());
program.addCommand(stopCommand());
program.addCommand(statusCommand());
program.addCommand(sendCommand());
program.addCommand(agentCommands());    // agent create, list, run
program.addCommand(sessionCommands());  // sessions list
program.addCommand(deviceCommands());   // device pair, list, approve
program.addCommand(configCommands());   // config show, set
```

### Onboarding Wizard
```typescript
import inquirer from 'inquirer';

async function onboardingWizard(): Promise<void> {
  console.log('Welcome to HomeAgent! Let\'s set you up.\n');
  
  // 1. Create data directory (~/.homeagent/)
  // 2. Generate TLS certificates
  // 3. Configure LLM provider
  const { llmProvider } = await inquirer.prompt([
    { type: 'list', name: 'llmProvider', message: 'Choose LLM provider:', choices: ['openai', 'anthropic'] },
  ]);
  // 4. Store API key via secrets manager
  // 5. Create first agent
  // 6. Configure messaging provider (optional)
  // 7. Generate shared secret for first device
  // 8. Display connection info
}
```

### `homeagent start`
```typescript
async function startCommand(): Command {
  return new Command('start')
    .description('Start the HomeAgent gateway')
    .option('--port <port>', 'Port to listen on', '8420')
    .option('--host <host>', 'Host to bind to', '0.0.0.0')
    .option('--insecure', 'Disable TLS (local development only)')
    .action(async (opts) => {
      // Import and start the gateway
      // Log startup info
      // Handle SIGINT/SIGTERM for clean shutdown
    });
}
```

### Device Pairing Flow
```typescript
async function pairDevice(): Promise<void> {
  // 1. Generate random shared secret
  // 2. Hash and store in SQLite
  // 3. Display secret (show once, never again)
  // 4. Device status: pending approval
  // 5. Admin must run `homeagent device approve <deviceId>`
}
```

## Implementation Plan

1. Create `packages/cli/src/index.ts` — main entry point with Commander
2. Create `packages/cli/src/commands/start.ts` — server start command
3. Create `packages/cli/src/commands/status.ts` — status display
4. Create `packages/cli/src/commands/send.ts` — message send
5. Create `packages/cli/src/commands/agent.ts` — agent CRUD commands
6. Create `packages/cli/src/commands/session.ts` — session management
7. Create `packages/cli/src/commands/device.ts` — device pairing and management
8. Create `packages/cli/src/commands/config.ts` — configuration management
9. Create `packages/cli/src/wizard/onboarding.ts` — onboarding wizard
10. Add `commander` and `inquirer` as dependencies
11. Create `bin/homeagent` entry script
12. Wire CLI commands to gateway/runtime via local WebSocket or direct import
13. Write tests:
    - `start` binds to correct port
    - `status` displays running info
    - `agent create` creates agent in registry
    - `device pair` generates and stores shared secret
    - `device approve` updates device status
    - Onboarding wizard creates necessary config files
    - Invalid commands show help

## Acceptance Criteria
- [ ] `homeagent` CLI is executable from project root
- [ ] Onboarding wizard walks through initial setup
- [ ] `homeagent start` starts the gateway with configurable port/host
- [ ] `homeagent status` shows server status and connected info
- [ ] `homeagent send` sends a message to an agent
- [ ] `homeagent agent create/list/run` manage agents
- [ ] `homeagent device pair/list/approve` manage devices
- [ ] `homeagent config show/set` manage configuration
- [ ] LLM credentials stored via secrets manager (not on disk)
- [ ] TLS certificates generated during onboarding
- [ ] All tests pass

## Priority
**High** — the CLI is the primary operator interface.

**Scoring:**
- User Impact: 5 (operators need this to manage the system)
- Strategic Alignment: 5 (core UX)
- Implementation Feasibility: 4 (Commander is well-documented)
- Resource Requirements: 3 (many commands)
- Risk Level: 1 (low)
- **Score: 8.3**

## Dependencies
- **Blocks:** #025
- **Blocked by:** #004, #006, #011, #012, #018

## Implementation Size
- **Estimated effort:** Large (4-5 days)
- **Labels:** `enhancement`, `high-priority`, `phase-9`, `cli`
