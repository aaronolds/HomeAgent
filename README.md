# HomeAgent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node >=22](https://img.shields.io/badge/node-%3E%3D22.0.0-339933?logo=node.js&logoColor=white)
![pnpm workspace](https://img.shields.io/badge/package%20manager-pnpm-F69220?logo=pnpm&logoColor=white)

HomeAgent is a self-hosted personal AI assistant platform with a modular, monorepo architecture. It is designed for local control, privacy, and extensibility across messaging providers, runtime tools, and agent capabilities.

This repository contains the v1 implementation workspace and backlog artifacts.

## What HomeAgent Includes

- Gateway service with typed RPC/event protocol and auth handshakes
- Agent runtime for session handling, context assembly, streaming, and tool execution
- Provider modules (for example Telegram and future channels)
- Node host support for secure remote capabilities and browser proxying
- Plugin and skills packages for extensibility
- CLI and config packages for operator workflows
- Test and security hardening milestones tracked in issue specs

## Repository Structure

```text
.
├── docs/                  # Architecture and planning documents
├── issues/                # Numbered implementation backlog (001-018)
├── packages/
│   ├── cli/
│   ├── config/
│   ├── gateway/
│   ├── node/
│   ├── plugins/
│   ├── providers/
│   ├── runtime/
│   ├── shared/
│   ├── skills/
│   └── tools/
├── package.json           # Workspace scripts
├── pnpm-workspace.yaml    # Monorepo package mapping
└── tsconfig.json
```

## Prerequisites

- Node.js `>=22.0.0`
- `pnpm`

## Getting Started

```bash
pnpm install
```

## Workspace Commands

Run these from the repository root:

```bash
pnpm dev     # Starts gateway dev flow (@homeagent/gateway)
pnpm build   # Builds all packages with a build script
pnpm test    # Runs Vitest suite
pnpm lint    # Runs Biome checks
```

## Planning and Backlog

- Architecture: `docs/architecture.md`
- Combined plan: `docs/plan.combined.md`
- Implementation backlog: `issues/README.md`

The backlog includes dependency-aware execution waves and identifies which issues can be worked in parallel.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
