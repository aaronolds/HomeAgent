# HomeAgent Design

## Purpose

HomeAgent is a self‑hosted personal AI assistant designed to replicate the key features of OpenClaw while keeping all data and execution under your control. It connects to multiple messaging platforms, persists context locally and interacts with large‑language models via tools and plugins.

## Requirements

Local control and privacy: all state (sessions, memory, files) lives on your machine. One server instance per host controls messaging sessions.

Multi‑channel messaging: support multiple providers (WhatsApp, Telegram, Slack, Discord, etc.) through modular drivers.

Agent runtime with memory: run an LLM loop that assembles context, calls tools and streams replies while reading and writing persistent context files.

Extensible tools and plugins: allow new RPC methods, tools and services to be registered via a plugin system.

Remote command execution: enable headless nodes to run commands and browser automation on remote machines with explicit approvals.

Multi‑agent: allow multiple isolated agents with separate workspaces and bindings so different personas or users share the server securely.

## Architecture Overview

HomeAgent follows a modular architecture inspired by OpenClaw. A central Gateway daemon manages connections to messaging channels and exposes a WebSocket API. Clients (CLI or GUI) and nodes connect to the gateway to send requests and expose device capabilities. The gateway routes messages to the Agent Runtime, which runs an agentic loop, invokes an LLM via tools and plugins, updates session transcripts and emits streamed replies to clients. All persistent data lives on disk in per‑agent directories.

## Components

### Gateway

Maintains provider connections and exposes a typed WebSocket API for RPC requests and server events. The protocol uses JSON frames with a mandatory connect handshake and idempotency keys for side‑effecting calls.

Enforces pairing and device approval; new devices must be approved before they can connect.

Runs on a single host; exactly one instance controls all messaging sessions.

### Messaging Providers

Each messaging platform is implemented as a provider module. Providers handle authentication, incoming message parsing and outbound message formatting. The gateway dispatches inbound messages from providers to the agent runtime and sends outbound replies back via the same provider.

### Clients

Command‑line and GUI clients connect over WebSocket to send requests (send, agent, status) and subscribe to events such as agent or chat. Clients never store state; they query the gateway for sessions and token usage.

### Node Hosts

Headless nodes provide remote execution and browser automation. Nodes connect with role: node and advertise capabilities (command execution, canvas, camera, location). They can publish a browser proxy to run browsing tasks without extra setup. Each node requires pairing approval and an exec‑approval file for system.run to prevent unauthorized commands.

### Agent Runtime and Loop

The embedded agent runtime uses a dedicated workspace directory per agent. On the first turn it injects bootstrap files (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md) into the prompt. The agentic loop consists of:

Intake and session resolution: validate parameters and resolve or create a session, returning a run ID.

Context assembly: load session history and workspace files into the prompt; apply memory and compaction as needed.

Model inference: call the configured LLM with the assembled prompt and stream assistant deltas back to clients.

Tool execution: execute requested tools and stream their results; use idempotency keys to avoid duplicate actions.

Persistence: append the turn to the session transcript (JSONL file) for future context.

The loop runs serially per session key to avoid race conditions and exposes hook points for custom logic.

### Memory and Sessions

Sessions and their transcripts are stored in ~/.homeagent/agents/<agentId>/sessions/<sessionId>.jsonl. Direct messages share the main session by default but can be isolated per sender to avoid context leakage. Memory persists through workspace files and the session transcripts.

### Multi‑Agent Support

HomeAgent can host multiple isolated agents simultaneously. Each agent has its own workspace, state directory and skill set. Bindings route inbound messages to the appropriate agent. Separate per‑agent sessions ensure data isolation.

### Tools and Plugins

Tools are functions that the agent can call to perform external actions (e.g. reading files, executing commands, browsing). Skills bundle prompts and tool definitions. A plugin system allows dynamic loading of new RPC methods, tools, CLI commands and background services. Official plugins can provide additional messaging channels or memory back‑ends.

### Security and Access Control

Enforce pairing and device approval for every client and node.

Use idempotency keys for side‑effecting RPCs.

Require exec approvals for any remote command execution.

Limit file access and use sandboxing when executing code to prevent arbitrary system access.

Consider TLS and VPN tunnels for remote connections.

## Implementation Outline

1. Choose a language and framework: Node.js with TypeScript mirrors OpenClaw and simplifies WebSocket and plugin support, but a Python or Rust implementation is possible.

2. Implement the gateway: Write a WebSocket server that validates a connect handshake, supports RPC calls and event streams and manages provider modules.

3. Define the protocol: Use JSON Schema to define request and event types; generate client models for type safety.

4. Develop provider modules: Start with one or two messaging platforms; implement authentication, inbound message polling and outbound sending.

5. Build the agent runtime: Wrap your preferred LLM API (e.g. OpenAI, Anthropic) and implement the agentic loop with context assembly, tool execution and streaming.

6. Create the plugin SDK: Provide hooks to register tools, RPC methods and CLI commands.

7. Implement nodes: Write a lightweight node program that connects to the gateway and exposes capabilities; implement pairing and exec approvals.

8. Provide configuration and CLI: Offer an onboarding flow to set up provider credentials, agent workspaces and node pairing; provide commands to send messages, run agents and manage sessions.

## Directory Structure Example

```text
homeagent/
├── gateway/           # WebSocket server, protocol definitions, RPC handlers
├── providers/         # Messaging provider modules (whatsapp, telegram, slack)
├── runtime/           # Agent runtime and loop implementation
├── tools/             # Core tool implementations (read, exec, browse, etc.)
├── plugins/           # Plugin loader and official plugins
├── cli/               # Command-line interface and onboarding wizard
├── node/              # Headless node implementation for remote exec and browser proxy
├── skills/            # Built‑in skills (prompts and tool definitions)
└── config/            # JSON schema and default configuration files
```

## Conclusion

This design provides a roadmap for building HomeAgent, a self‑hosted AI assistant inspired by OpenClaw. By implementing a central gateway, modular providers, an agent runtime with memory, a plugin system and secure remote nodes, you can create a local assistant that respects privacy while remaining extensible and powerful.
