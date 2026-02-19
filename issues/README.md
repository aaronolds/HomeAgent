# HomeAgent v1 Issue Backlog

Generated from `docs/plan.combined.md`.

## How to use

- Create GitHub issues from these files in numeric order.
- Keep dependency references as links between created GitHub issue numbers.
- Use labels suggested in each file.
- Issues within the same wave can be worked on **in parallel**.

## Backlog order

1. `001-monorepo-scaffold-and-tooling.md`
2. `002-shared-protocol-schemas-and-contracts.md`
3. `003-gateway-tls-auth-handshake-and-session-token.md`
4. `004-gateway-rbac-rpc-router-and-idempotency.md`
5. `005-gateway-network-hardening-rate-limits-and-frame-limits.md`
6. `006-persistence-jsonl-sqlite-secrets-and-audit-log.md`
7. `007-runtime-session-lock-context-assembly-and-compaction.md`
8. `008-runtime-streaming-tool-execution-and-run-lifecycle.md`
9. `009-multi-agent-registry-bindings-and-isolation.md`
10. `010-plugin-sdk-skills-and-loop-hooks.md`
11. `011-plugin-sandbox-permissions-egress-and-signing-policy.md`
12. `012-provider-telegram-v1.md`
13. `013-node-host-secure-connect-capabilities-and-browser-proxy.md`
14. `014-node-exec-approval-allowlist-and-command-safety.md`
15. `015-cli-onboarding-and-operator-workflows.md`
16. `016-config-package-defaults-and-json-schema.md`
17. `017-test-suite-protocol-runtime-persistence-and-e2e.md`
18. `018-security-test-suite-authz-sandboxing-and-incident-controls.md`

## Parallelization schedule

Issues within the same wave have no cross-dependencies and can be worked on simultaneously. All dependencies from prior waves must be complete before starting a wave.

**Critical path:** #001 → #002 → #003 → #004 → #006 → #007 → #008 → #010 → #011 → #018

| Wave | Issues | Dependencies |
| ------ | -------- | -------------- |
| **1** | #001 Monorepo scaffold & tooling | — |
| **2** | #002 Protocol schemas & contracts | #001 |
| **3** | #003 Gateway TLS/auth, #016 Config package defaults | #001, #002 |
| **4** | #004 RBAC/RPC router & idempotency | #002, #003 |
| **5** | #005 Network hardening, #006 Persistence layer, #013 Node host secure connect | #003, #004 |
| **6** | #007 Runtime session/context, #014 Exec approval & command safety | #002, #006, #013 |
| **7** | #008 Streaming & tool execution, #009 Multi-agent registry | #004, #006, #007 |
| **8** | #010 Plugin SDK & skills, #012 Telegram provider | #007, #008, #009, #016 |
| **9** | #011 Plugin sandbox & signing, #015 CLI onboarding | #004, #006, #010, #012, #013 |
| **10** | #017 Core test suite, #018 Security test suite | #003–#005, #008, #009, #011, #012, #014, #015 |

### Dependency graph

```text
#001
 ├─► #002
 │    ├─► #003 ──┬─► #004 ──┬─► #005
 │    │          │           ├─► #006 ──┬─► #007 ──┬─► #008 ──► #010 ──► #011
 │    │          │           │          │          │           │
 │    │          │           │          │          ├─► #009 ──► #012
 │    │          │           │          ├─► #014   │
 │    │          │           ├─► #013 ──┘          │
 │    ├─► #016 ─────────────────────────────────────────► #012
 │    │                                            │
 │    └──────────────────────► #007                │
 │                                                 │
 └─► #015 (needs #004, #006, #012, #013)
      │
      └──────────────────────────────────► #018 (needs #003–#005, #011, #014, #015)
                                           #017 (needs #004, #006, #008, #009, #012)
```
