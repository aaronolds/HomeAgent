# Core Tools: File I/O, Command Execution & Web Browsing

## Overview
Implement the three core tool categories that the agent runtime can invoke: file read/write, command execution, and web browsing. These tools are the agent's hands — without them, the LLM can only generate text but cannot act on the world.

## Scope

**Included:**
- **File tools:** `file.read`, `file.write`, `file.list`, `file.search`
  - Path validation: `fs.realpath()` + prefix check within agent workspace
  - Symlink escape protection
  - File permissions enforcement
- **Exec tools:** `system.run` (command execution)
  - `execFile` (not `exec`) with arguments as arrays — no shell interpolation
  - `cwd` restricted to agent workspace
  - Environment variables stripped (only allowlisted vars passed)
  - Configurable timeout (default: 30s)
  - Memory caps via `--max-old-space-size` on child processes
- **Browse tools:** `web.browse`, `web.screenshot`
  - Playwright-based headless browser automation
  - Page content extraction (text, HTML)
  - Screenshot capture
  - Navigation, click, type actions
- All tools follow the `ToolHandler` interface from #016
- All tool results sanitized and length-capped before returning to the model

**Excluded:**
- Node-based remote execution (see #023)
- Plugin-provided tools (see #020)
- Exec approval system (see #023)

## Technical Requirements

### File Tools
```typescript
const fileReadTool: ToolHandler = {
  name: 'file.read',
  description: 'Read the contents of a file in the agent workspace',
  parameters: z.object({
    path: z.string(),
    encoding: z.enum(['utf8', 'base64']).default('utf8'),
  }),
  async execute(args, context) {
    const resolved = await resolveSafePath(context.workspacePath, args.path);
    return fs.readFile(resolved, args.encoding);
  },
};

async function resolveSafePath(base: string, relative: string): Promise<string> {
  const resolved = path.resolve(base, relative);
  const real = await fs.realpath(resolved);
  if (!real.startsWith(await fs.realpath(base))) {
    throw new Error('Path traversal detected');
  }
  return real;
}
```

### Exec Tool
```typescript
import { execFile } from 'node:child_process';

const systemRunTool: ToolHandler = {
  name: 'system.run',
  description: 'Execute a command in the agent workspace',
  parameters: z.object({
    command: z.string(),
    args: z.array(z.string()).default([]),
    cwd: z.string().optional(),
    timeout: z.number().default(30_000),
  }),
  async execute(args, context) {
    const safeCwd = await resolveSafePath(context.workspacePath, args.cwd ?? '.');
    return new Promise((resolve, reject) => {
      execFile(args.command, args.args, {
        cwd: safeCwd,
        timeout: args.timeout,
        env: filterEnv(process.env),
        maxBuffer: 1024 * 1024, // 1MB
      }, (error, stdout, stderr) => {
        resolve({ exitCode: error?.code ?? 0, stdout, stderr });
      });
    });
  },
};
```

### Browse Tools
```typescript
import { chromium } from 'playwright';

const webBrowseTool: ToolHandler = {
  name: 'web.browse',
  description: 'Navigate to a URL and extract page content',
  parameters: z.object({
    url: z.string().url(),
    extractText: z.boolean().default(true),
    waitForSelector: z.string().optional(),
  }),
  async execute(args, context) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(args.url, { waitUntil: 'domcontentloaded' });
    if (args.waitForSelector) await page.waitForSelector(args.waitForSelector);
    const content = args.extractText ? await page.textContent('body') : await page.content();
    await browser.close();
    return { url: args.url, content };
  },
};
```

## Implementation Plan

1. Create `packages/tools/src/utils/safe-path.ts` — path validation utility
2. Create `packages/tools/src/utils/env-filter.ts` — environment variable allowlist
3. Create `packages/tools/src/file/read.ts`, `write.ts`, `list.ts`, `search.ts`
4. Create `packages/tools/src/exec/run.ts` — command execution with `execFile`
5. Create `packages/tools/src/browse/browse.ts` — Playwright web browsing
6. Create `packages/tools/src/browse/screenshot.ts` — page screenshot
7. Create `packages/tools/src/index.ts` — register all tools with the ToolExecutor
8. Add Playwright as a dependency
9. Write tests:
   - `file.read` reads file within workspace
   - `file.read` rejects path traversal (`../../etc/passwd`)
   - `file.read` rejects symlink escape
   - `file.write` creates/overwrites within workspace only
   - `system.run` executes command and returns stdout/stderr
   - `system.run` rejects commands outside workspace cwd
   - `system.run` uses `execFile` (no shell)
   - `system.run` respects timeout
   - `web.browse` fetches page content (mocked)
   - `web.screenshot` captures screenshot (mocked)
   - Tool results are sanitized and length-capped

## Acceptance Criteria
- [ ] File tools read/write/list/search within agent workspace only
- [ ] Path traversal (`..`, symlinks) is blocked with error
- [ ] `system.run` uses `execFile` with array arguments (no shell injection)
- [ ] `system.run` restricts `cwd` to agent workspace
- [ ] `system.run` strips unauthorized environment variables
- [ ] `system.run` enforces timeout (default 30s)
- [ ] `web.browse` extracts text content from URLs
- [ ] `web.screenshot` captures page screenshots
- [ ] All tools follow the `ToolHandler` interface
- [ ] All tool results are sanitized and length-capped
- [ ] Security tests pass (traversal, injection, escape)
- [ ] All tests pass

## Priority
**High** — agents are useless without tools.

**Scoring:**
- User Impact: 5 (core agent capability)
- Strategic Alignment: 5 (core product)
- Implementation Feasibility: 4 (well-understood patterns)
- Resource Requirements: 3 (three tool categories)
- Risk Level: 3 (security-sensitive: file access, exec)
- **Score: 2.8**

## Dependencies
- **Blocks:** #021, #022 (agents need tools to be useful)
- **Blocked by:** #004, #016, #018

## Implementation Size
- **Estimated effort:** Large (4-5 days)
- **Labels:** `enhancement`, `high-priority`, `phase-7`, `tools`, `security`
