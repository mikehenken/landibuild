# Self-review: p1b-codebase-chat-ask-agent-ws

**Primary artifact:** `code-trace-chat-ws-ask-agent.md`

## Definition of Done (task checklist)

| Item | Evidence |
|------|----------|
| Trace client message handler | Primary doc §3 (`handle-websocket-message.ts` full `switch` line map), §6.4 |
| PartySocket lifecycle | Primary doc §2 (partysocket `WebSocket` vs app `connectWithRetry` / `connectAttemptIdRef`) |
| Ask vs codegen integration | Primary doc §4 (`phasic` live `UserConversationProcessor` vs `agentic` queue; `handleUserInput` idle `generateAllFiles`) |
| Worker/DO mapping | Primary doc §5–6, §10 |
| AG-UI / PartySocket mapping | Primary doc §7 (projection table, adapter-on-`broadcast` note, reconnect/snapshot) |
| path:line citations | §3.1 table + fenced blocks throughout |
| Today vs missing | Primary doc §8 |

## Plan quality gates (Phase 1 research)

- **Inspectability:** Deliverable under `journal_root/p1b-codebase-chat-ask-agent-ws/outputs/`.
- **Evidence for repo claims:** Citations use `start:end:path` blocks; §7–8 label future vs current behavior.

## Fixes applied (refresh)

- **§3.1:** Complete inventory of `handle-websocket-message.ts` `switch` branches with approximate line ranges.
- **§2:** PartySocket package behavior vs Landi URL usage and duplicate retry concern.
- **§4:** Explicit mapping from product “ask mode” to **`BehaviorType` + queue vs immediate conversation + idle codegen**—no `mode` on `user_suggestion` today.
- **§7:** Deeper AG-UI mapping paragraph (snapshot/stream/commands, DO fit, dual-envelope migration).
- **Citation fix:** `chat.tsx` user send block lines corrected to **~658–674** (was outdated).

## Proof table (coordinator-friendly)

| Claim | Proof location |
|-------|----------------|
| WS upgrade goes to DO stub | `controller.ts` ~271–276 |
| Client inbound routing | `handle-websocket-message.ts` §3.1 table |
| `user_suggestion` → DO | `websocket.ts` ~139–171 |
| Idle message can start codegen | `codingAgent.ts` ~517–523 |
| Phasic vs agentic user path | `phasic.ts` ~724–726; `agentic.ts` ~134–175 |
| Tools for conversation LLM | `UserConversationProcessor` + `customTools.ts` (primary doc §9) |
