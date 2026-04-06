# Chat WebSocket noise reduction and disconnect token guard (06 Apr 2026)

## Goals

- Reduce main-thread work and console noise from high-volume WebSocket types.
- Limit runaway LLM/token use after the last client disconnects, **without** clearing `shouldBeGenerating` (so refresh/reconnect can auto-resume).

## Frontend

Files: `src/routes/chat/utils/handle-websocket-message.ts`, `src/routes/chat/hooks/use-chat.ts`, `src/routes/chat/chat.tsx`

- Skip verbose logging for noisy types (e.g. `cf_agent_state`, `file_chunk_generated`, streaming `conversation_response`, `agent_ui_event`).
- `updateStage` no-ops when status/title/metadata are unchanged.
- Heavy DEV logging in `chat.tsx` moved behind a `useEffect` with primitive dependencies instead of logging every render/WS tick.

## Worker

| Area | File(s) | Behavior |
|------|---------|----------|
| Disconnect detection | `worker/agents/core/websocket.ts` | Last active socket closed schedules guard (does not immediately flip halt). |
| Grace + halt | `worker/agents/core/codingAgent.ts` | Debounced (~8s) `scheduleDisconnectTokenGuardIfNoViewers`; timer cleared on connect; sets `disconnectedHaltActive`, cancels inference. |
| Infrastructure | `worker/agents/core/AgentCore.ts` | `isDisconnectedHaltActive()` exposed. |
| Inference / generation | `worker/agents/core/behaviors/base.ts`, `agentic.ts`, `phasic.ts` | Abort/halt respected; completion DB update / `GENERATION_COMPLETE` skipped when halt active after disconnect. |

## Verification

- Disconnect all tabs for longer than the grace period: in-flight inference should stop; reconnect with `shouldBeGenerating` can still resume via existing client flow.
- Console should show fewer redundant WebSocket debug lines in DEV.
