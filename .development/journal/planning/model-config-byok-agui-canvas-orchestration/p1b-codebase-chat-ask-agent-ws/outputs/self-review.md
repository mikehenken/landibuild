# Self-review: p1b-codebase-chat-ask-agent-ws

**Primary artifact:** `code-trace-chat-ws-ask-agent.md`

## Definition of Done (task checklist)

| Item | Evidence |
|------|----------|
| Trace client message handler | `code-trace-chat-ws-ask-agent.md` §1–2, §3.6; `handle-websocket-message.ts` citations |
| Trace connection lifecycle | §2.1–2.5; `use-chat.ts`, `controller.ts`, `codingAgent.ts` |
| Per-thread mode plug-in points | §4; state, payload, `handleUserInput`, optional `agent_connected` |
| Platform assistant tools without replacing DO | §5; `customTools.ts` + `UserConversationProcessor.ts` |
| path:line citations | Throughout primary doc |
| Today vs missing | §4–5 explicit subsections |

## Plan quality gates (Phase 1 research)

- **Inspectability:** Deliverable is on disk under `journal_root/p1b-codebase-chat-ask-agent-ws/outputs/`.
- **Evidence for repo claims:** Citations use `start:end:path` blocks; recommendations in §4–5 are labeled as proposed integration, not as existing code.

## Fixes applied before submit

- Documented **two** distinct handlers (client `createWebSocketMessageHandler` vs worker `handleWebSocketMessage`) to avoid a common trace mistake.

## Proof table (coordinator-friendly)

| Claim | Proof location |
|-------|----------------|
| WS upgrade goes to DO stub | `controller.ts` ~271–276 |
| Client parses inbound JSON in one switch | `handle-websocket-message.ts` ~175–1035 |
| `user_suggestion` drives conversation + optional codegen | `websocket.ts` ~139–171; `codingAgent.ts` ~508–524 |
| Tools assembled for conversation LLM | `UserConversationProcessor.ts` ~351–365; `customTools.ts` ~42–62 |
