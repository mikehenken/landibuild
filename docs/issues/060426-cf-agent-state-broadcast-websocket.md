# CF Agent state WebSocket payload (06 Apr 2026)

## Symptom

Browser console showed `Unhandled message` for payloads that looked like `cf_agent_state`, with `type` containing a full JSON string instead of the literal `cf_agent_state`.

## Root cause

The Cloudflare `agents` SDK calls `broadcast(JSON.stringify({ state, type: 'cf_agent_state' }), excludeIds)` (PartyKit wire contract: pre-serialized string + optional connection exclude list).

`CodeGeneratorAgent` overrode `broadcast` with a typed `(type, data)` shape that always did `JSON.stringify({ type, ...data })`. The SDK’s first argument was therefore treated as the **message type**, producing wire messages like `{ type: '{"state":...,"type":"cf_agent_state"}' }` and breaking the client `switch`.

## Fix

`CodeGeneratorAgent.broadcast` is overloaded to:

- Detect JSON object strings and delegate to `super.broadcast(JSON.stringify(parsed), exclude)` so the client receives a normal `{ type: 'cf_agent_state', state: ... }` frame.
- Pass through non-JSON string + `string[]` (exclude) to `super.broadcast` (PartyKit).
- Keep existing `broadcastToConnections(this, type, data)` for app protocol messages.

## Code

`worker/agents/core/codingAgent.ts` (`broadcast` implementation).

## Verification

Connect to chat WebSocket, trigger agent state updates; client should handle `cf_agent_state` without falling through to `default` / `Unhandled message`.
