# Skills Package: Prompt Bundles & Tool Definitions

## Overview
Implement the skills package that bundles prompts with tool definitions into reusable, composable skill sets. Skills are higher-level abstractions than raw tools — they include system prompt fragments, curated tool selections, and usage guidelines that give agents specific capabilities.

## Scope

**Included:**
- Skill definition format: name, description, prompts (system fragments), tool references, configuration
- Skill loader: discover and load skills from `packages/skills/src/builtins/` and `~/.homeagent/skills/`
- Built-in skills to ship with v1:
  - `coding` — code generation, review, and debugging with file tools
  - `research` — web browsing, information gathering, summarization
  - `system-admin` — system commands, file management, diagnostics
  - `conversation` — general chat, no special tools
- Skill composition: agents can enable multiple skills simultaneously
- Per-agent skill configuration in agent config
- Skill → tool mapping: skills declare which tools they need
- Skill prompt injection into context assembly

**Excluded:**
- Custom user-created skills (loader supports it, but authoring guide is future)
- Marketplace/sharing (future)

## Technical Requirements

### Skill Definition
```typescript
export const SkillDefinition = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  systemPromptFragment: z.string(),  // Added to system prompt when skill is active
  requiredTools: z.array(z.string()),  // Tool names this skill needs
  optionalTools: z.array(z.string()).default([]),
  configuration: z.record(z.unknown()).optional(),
});

type Skill = z.infer<typeof SkillDefinition>;
```

### Skill Loader
```typescript
class SkillLoader {
  private skills = new Map<string, Skill>();

  async loadBuiltins(): Promise<void>;
  async loadFromDirectory(dir: string): Promise<void>;
  
  get(name: string): Skill | undefined;
  list(): Skill[];
  
  getPromptFragments(skillNames: string[]): string[];
  getRequiredTools(skillNames: string[]): string[];
}
```

### Built-in Skill Example
```typescript
// packages/skills/src/builtins/coding.ts
export const codingSkill: Skill = {
  name: 'coding',
  version: '1.0.0',
  description: 'Code generation, review, and debugging',
  systemPromptFragment: `You are an expert programmer. When asked to write or modify code:
- Read existing files before making changes
- Write clean, well-documented code
- Run tests after making changes
- Explain your reasoning`,
  requiredTools: ['file.read', 'file.write', 'file.list', 'system.run'],
  optionalTools: ['file.search', 'web.browse'],
};
```

### Integration with Context Assembly
```typescript
// In context assembler:
function buildSystemPrompt(agent: Agent, skills: Skill[]): string {
  const base = agent.config.systemPromptOverride ?? DEFAULT_SYSTEM_PROMPT;
  const fragments = skills.map(s => s.systemPromptFragment);
  return [base, ...fragments].join('\n\n');
}
```

## Implementation Plan

1. Create `packages/skills/src/types.ts` — skill definition schema
2. Create `packages/skills/src/loader.ts` — skill discovery and loading
3. Create `packages/skills/src/builtins/coding.ts` — coding skill
4. Create `packages/skills/src/builtins/research.ts` — research skill
5. Create `packages/skills/src/builtins/system-admin.ts` — system admin skill
6. Create `packages/skills/src/builtins/conversation.ts` — conversation skill
7. Create `packages/skills/src/index.ts` — barrel export + loader initialization
8. Integrate with context assembly (#015): inject skill prompt fragments into system prompt
9. Integrate with tool executor (#016): filter available tools based on active skills
10. Write tests:
    - Skill definition validates correctly
    - Built-in skills load from `builtins/`
    - Custom skills load from directory
    - Prompt fragments are injected into system prompt
    - Required tools are resolved for active skills
    - Unknown skill name handled gracefully

## Acceptance Criteria
- [ ] Skill definition schema validates name, prompts, tools
- [ ] Built-in skills (coding, research, system-admin, conversation) are bundled
- [ ] Skill loader discovers and loads from built-in and custom directories
- [ ] Agents can enable multiple skills simultaneously
- [ ] Skill prompt fragments are injected into the system prompt during context assembly
- [ ] Required tools for active skills are made available to the model
- [ ] Per-agent skill configuration works
- [ ] All tests pass

## Priority
**Medium** — skills are a differentiating feature but not blocking the core loop.

**Scoring:**
- User Impact: 4 (better agent behavior)
- Strategic Alignment: 4 (in the architecture)
- Implementation Feasibility: 5 (straightforward)
- Resource Requirements: 2 (moderate)
- Risk Level: 1 (low)
- **Score: 8.0**

## Dependencies
- **Blocks:** #022 (agents with skills can chat meaningfully)
- **Blocked by:** #004, #015, #016, #019

## Implementation Size
- **Estimated effort:** Medium (2-3 days)
- **Labels:** `enhancement`, `medium-priority`, `phase-7`, `skills`, `runtime`
