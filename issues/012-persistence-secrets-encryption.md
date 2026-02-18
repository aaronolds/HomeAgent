# Persistence: Secrets Storage & Encryption

## Overview
Implement secure secrets storage for provider tokens, LLM API keys, and device shared secrets. Secrets must never be stored in plaintext on disk. Support OS keychain integration (`keytar`) as the primary method, with AES-256 encryption using a master passphrase as a fallback.

## Scope

**Included:**
- Secrets storage directory at `~/.homeagent/secrets/` with `0700` permissions
- OS keychain integration via `keytar` (macOS Keychain, Linux libsecret, Windows Credential Vault)
- Fallback: AES-256-GCM encryption with a master passphrase (for headless/Docker environments)
- Secret types: provider credentials, LLM API keys, device shared secrets
- CRUD operations: store, retrieve, delete, list (names only), rotate
- Key derivation from master passphrase using PBKDF2 or scrypt
- File permissions hardened to `0600` for encrypted files
- Pino log redaction: never log secret values

**Excluded:**
- Audit logging of secret access (see #013)
- CLI `secrets rotate` command (see #025)
- Provider-specific credential format (see #022)

## Technical Requirements

### Secrets Manager API
```typescript
interface SecretsManager {
  store(name: string, value: string): Promise<void>;
  retrieve(name: string): Promise<string | undefined>;
  delete(name: string): Promise<boolean>;
  list(): Promise<string[]>;  // names only
  rotate(name: string, newValue: string): Promise<void>;
}
```

### Keytar (Primary)
```typescript
import keytar from 'keytar';

const SERVICE = 'homeagent';

class KeytarSecretsManager implements SecretsManager {
  async store(name: string, value: string): Promise<void> {
    await keytar.setPassword(SERVICE, name, value);
  }
  async retrieve(name: string): Promise<string | undefined> {
    return (await keytar.getPassword(SERVICE, name)) ?? undefined;
  }
  // ...
}
```

### AES-256-GCM Fallback
```typescript
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

class EncryptedFileSecretsManager implements SecretsManager {
  private key: Buffer;

  constructor(passphrase: string, salt: Buffer) {
    this.key = scryptSync(passphrase, salt, 32);
  }

  async store(name: string, value: string): Promise<void> {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Write { iv, tag, encrypted } to ~/.homeagent/secrets/<name>.enc
    // Set file permissions to 0600
  }
  // ...
}
```

### Auto-detection
```typescript
async function createSecretsManager(config: SecretsConfig): Promise<SecretsManager> {
  if (config.backend === 'keytar' || (!config.backend && isKeytarAvailable())) {
    return new KeytarSecretsManager();
  }
  if (!config.masterPassphrase) {
    throw new Error('Master passphrase required for file-based secrets');
  }
  return new EncryptedFileSecretsManager(config.masterPassphrase, config.salt);
}
```

## Implementation Plan

1. Create `packages/gateway/src/secrets/types.ts` — SecretsManager interface
2. Create `packages/gateway/src/secrets/keytar.ts` — OS keychain backend
3. Create `packages/gateway/src/secrets/encrypted-file.ts` — AES-256-GCM backend
4. Create `packages/gateway/src/secrets/factory.ts` — auto-detection and construction
5. Ensure `~/.homeagent/secrets/` is created with `0700` permissions
6. Ensure individual secret files use `0600` permissions
7. Add pino redaction paths for secret-related fields
8. Write tests:
   - Store and retrieve a secret via keytar (mock in CI)
   - Store and retrieve a secret via encrypted file
   - Encrypted file has correct file permissions
   - Rotation replaces old value
   - List returns names only, never values
   - Secrets never appear in pino logs

## Acceptance Criteria
- [ ] Secrets are stored via OS keychain when available
- [ ] Fallback to AES-256-GCM encrypted files when keychain is unavailable
- [ ] Master passphrase key derivation uses scrypt
- [ ] `~/.homeagent/secrets/` directory has `0700` permissions
- [ ] Individual secret files have `0600` permissions
- [ ] Plaintext secrets are never written to disk
- [ ] CRUD operations work for both backends
- [ ] Rotation atomically replaces the old value
- [ ] `list()` returns names only
- [ ] Pino logs redact secret values (verified by test)
- [ ] All tests pass

## Priority
**High** — secrets must be secured before any provider or LLM integration.

**Scoring:**
- User Impact: 5 (API keys and credentials)
- Strategic Alignment: 5 (security is core)
- Implementation Feasibility: 3 (crypto requires care)
- Resource Requirements: 3 (two backends + testing)
- Risk Level: 3 (security-critical code)
- **Score: 2.8**

## Dependencies
- **Blocks:** #022 (provider credentials), #016 (LLM API keys), #024 (onboarding)
- **Blocked by:** #004, #011

## Implementation Size
- **Estimated effort:** Medium (2-3 days)
- **Labels:** `enhancement`, `high-priority`, `phase-4`, `persistence`, `security`
