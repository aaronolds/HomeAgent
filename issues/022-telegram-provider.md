# Telegram Messaging Provider

## Overview
Implement Telegram as the first messaging provider for HomeAgent. Telegram was chosen for v1 due to low friction (no business account needed), excellent Bot API, and straightforward webhook/polling setup. This provider bridges Telegram messages to the agent runtime and sends responses back.

## Scope

**Included:**
- Telegram Bot API integration using `telegraf` or the raw Telegram Bot API
- Two ingestion modes:
  - **Long polling** (default for development): simple, no public endpoint needed
  - **Webhook** (production): Fastify route receives updates from Telegram
- Inbound message parsing: text, images, documents, voice, replies
- Outbound message formatting: text (Markdown), images, documents, buttons
- Provider module interface implementation: matches the `ProviderModule` contract
- Bot token stored via secrets manager (#012)
- Message routing through binding system (#018) to correct agent
- Session isolation: DMs create per-sender sessions by default

**Excluded:**
- Other providers (WhatsApp, Slack, Discord — future issues)
- Inline bots, payments, or Telegram-specific advanced features
- Message editing/deletion sync (future)

## Technical Requirements

### Provider Module Interface
```typescript
interface ProviderModule {
  name: string;
  
  // Initialize the provider with credentials
  init(config: ProviderConfig, secrets: SecretsManager): Promise<void>;
  
  // Start receiving messages
  start(onMessage: (msg: InboundMessage) => Promise<void>): Promise<void>;
  
  // Stop receiving messages
  stop(): Promise<void>;
  
  // Send a message
  send(outbound: OutboundMessage): Promise<SendResult>;
  
  // Health check
  healthCheck(): Promise<boolean>;
}

interface InboundMessage {
  provider: string;
  channelId: string;     // Telegram chat ID
  senderId: string;      // Telegram user ID
  senderName?: string;
  content: string;
  attachments?: Attachment[];
  replyToMessageId?: string;
  raw: unknown;          // Original Telegram message object
  ts: number;
}

interface OutboundMessage {
  provider: string;
  channelId: string;
  content: string;
  format?: 'text' | 'markdown' | 'html';
  attachments?: Attachment[];
  replyToMessageId?: string;
}
```

### Telegram Implementation
```typescript
import { Telegraf } from 'telegraf';

class TelegramProvider implements ProviderModule {
  name = 'telegram';
  private bot: Telegraf;

  async init(config: ProviderConfig, secrets: SecretsManager): Promise<void> {
    const token = await secrets.retrieve('telegram-bot-token');
    if (!token) throw new Error('Telegram bot token not configured');
    this.bot = new Telegraf(token);
  }

  async start(onMessage: (msg: InboundMessage) => Promise<void>): Promise<void> {
    this.bot.on('message', async (ctx) => {
      const inbound = this.parseMessage(ctx.message);
      await onMessage(inbound);
    });
    
    if (this.config.webhook) {
      await this.bot.telegram.setWebhook(this.config.webhookUrl);
      // Register Fastify route for webhook
    } else {
      await this.bot.launch(); // Long polling
    }
  }

  async send(outbound: OutboundMessage): Promise<SendResult> {
    const result = await this.bot.telegram.sendMessage(
      outbound.channelId,
      outbound.content,
      { parse_mode: outbound.format === 'markdown' ? 'MarkdownV2' : undefined }
    );
    return { messageId: result.message_id.toString(), ts: Date.now() };
  }
}
```

### Integration Flow
```
Telegram → TelegramProvider.onMessage()
  → BindingRouter.resolve(provider, channelId, senderId)
  → AgentRuntime.run(agentId, sessionId, input)
  → Stream events (agent.delta) → accumulated response
  → TelegramProvider.send(response)
  → Telegram
```

## Implementation Plan

1. Create `packages/providers/telegram/src/provider.ts` — TelegramProvider implementation
2. Create `packages/providers/telegram/src/parser.ts` — inbound message parsing
3. Create `packages/providers/telegram/src/formatter.ts` — outbound message formatting
4. Create `packages/providers/telegram/src/types.ts` — Telegram-specific types
5. Add `telegraf` as a dependency
6. Implement long polling mode (default)
7. Implement webhook mode with Fastify route integration
8. Integrate with secrets manager for bot token
9. Integrate with binding router for agent resolution
10. Wire provider into gateway lifecycle (start/stop)
11. Write tests:
    - Parse text message correctly
    - Parse message with attachments
    - Format outbound text with Markdown
    - Send message via bot API (mocked)
    - Health check verifies bot token
    - Long polling starts and processes messages
    - Webhook receives and processes Telegram updates
    - Unknown chat ID routes to default agent

## Acceptance Criteria
- [ ] Telegram provider implements `ProviderModule` interface
- [ ] Long polling mode works for development
- [ ] Webhook mode works with Fastify route
- [ ] Inbound messages are parsed (text, images, documents, voice)
- [ ] Outbound messages support text, Markdown, and attachments
- [ ] Bot token retrieved from secrets manager (never hardcoded)
- [ ] Messages routed through binding system to correct agent
- [ ] DM sessions are per-sender isolated by default
- [ ] Health check validates bot token
- [ ] Provider starts/stops cleanly with gateway lifecycle
- [ ] All tests pass

## Priority
**High** — this is the first user-facing channel.

**Scoring:**
- User Impact: 5 (users need a way to interact)
- Strategic Alignment: 5 (messaging is the core use case)
- Implementation Feasibility: 4 (Telegram API is well-documented)
- Resource Requirements: 3 (moderate integration work)
- Risk Level: 2 (external API dependency)
- **Score: 4.2**

## Dependencies
- **Blocks:** End-to-end testing milestone
- **Blocked by:** #012, #016, #018, #019, #020

## Implementation Size
- **Estimated effort:** Medium–Large (3-4 days)
- **Labels:** `enhancement`, `high-priority`, `phase-8`, `provider`, `telegram`
