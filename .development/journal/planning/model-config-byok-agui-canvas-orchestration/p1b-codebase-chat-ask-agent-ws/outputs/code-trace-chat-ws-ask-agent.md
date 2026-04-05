# Phase 1B: Chat, WebSocket, ask vs agent — code trace

**Task:** `p1b-codebase-chat-ask-agent-ws`  
**Scope:** Trace client and worker WebSocket handling, PartySocket lifecycle, per-thread **ask** vs **codegen agent** integration points, Worker/DO message mapping, and how this relates to a future **AG-UI** projection layer.

---

## 1. Naming: two different “WebSocket message handlers”

The codebase uses the same conceptual name in two places. Both handle **inbound** messages on their respective sides of the socket.

| Location | Symbol | Role |
|----------|--------|------|
| Frontend | `createWebSocketMessageHandler` in `src/routes/chat/utils/handle-websocket-message.ts` | Parses **server → client** `WebSocketMessage` JSON and updates React state |
| Worker | `handleWebSocketMessage` in `worker/agents/core/websocket.ts` | Parses **client → server** JSON and drives `CodeGeneratorAgent` |

This note avoids conflating them when reading docs or `CLAUDE.md`.

---

## 2. PartySocket lifecycle (library + app policy)

### 2.1 What `partysocket` provides here

The chat hook imports **`WebSocket` from `partysocket`**, not the browser global (`use-chat.ts` line 1). That class is documented as a **WebSocket-compatible** implementation (forked from reconnecting-websocket) with optional **auto-reconnect**, **send buffering** while disconnected, and timeout handling (`node_modules/partysocket/README.md`).

**How Landi uses it:** `connectWithRetry` does `const ws = new WebSocket(wsUrl)` with a plain URL string (`use-chat.ts` ~288). No `PartySocket({ host, room })` factory appears in the chat route—transport is the **Workers Agents WebSocket** on `/api/agent/:id/ws`, not a PartyKit room id.

**Interaction with custom retry:** `use-chat` **also** implements its own exponential backoff on `close` / `error` via `handleConnectionFailure`, which schedules a **new** `connectWithRetry` call (`use-chat.ts` ~361–372, ~387–418). Net effect: **application-level** reconnect policy (max 5, capped delay, `connectAttemptIdRef` to ignore stale events) is the primary resilience story; PartySocket’s internal behavior still applies to each instance until the hook replaces the socket on unmount or URL change.

### 2.2 Connection lifecycle (end-to-end)

1. **Session creation / URL** — same as §2.1 in prior revision (`CodingAgentController`, `websocketUrl` → `wss:`/`ws:` + `/api/agent/${agentId}/ws`).
2. **Upgrade → DO** — `getAgentStub` + `agentInstance.fetch(request)` binds the socket to `CodeGeneratorAgent`.
3. **Server `onConnect`** — pushes `agent_connected` with `state`, `templateDetails`, optional `previewUrl` (`codingAgent.ts` ~212–226).
4. **Client `open`** — always `get_conversation_state`; if new chat and not `disableGenerate`, `generate_all` (`use-chat.ts` ~332–339).
5. **Client `message`** — JSON parse → `createWebSocketMessageHandler` closure (`use-chat.ts` ~343–350).
6. **Client `close` / `error`** — `handleConnectionFailure` retries or surfaces permanent failure (`use-chat.ts` ~352–372, ~387–418).
7. **Unmount** — `shouldReconnectRef = false`, clear timeouts, `websocket?.close()` on dependency change (`use-chat.ts` ~618–638).
8. **Server `onClose`** — `handleWebSocketClose` → `handleVaultLocked` (`websocket.ts` ~242–246).

---

## 3. Client handler: `handle-websocket-message.ts` — factory and full `switch` inventory

**Entry:** `createWebSocketMessageHandler(deps)` returns `(websocket, message) => { ... }` (`handle-websocket-message.ts` ~104–120). The returned function closes over `blueprintParser` for `blueprint_chunk` streaming (~117–118, ~942–960).

**Debug logging:** Most types log via `logger.info` / `onDebugMessage`; `file_chunk_generated`, `cf_agent_state`, and long type strings are throttled/skipped (~164–174).

### 3.1 `switch (message.type)` — path:line map

| `message.type` | Approx. lines | Primary effect |
|----------------|---------------|----------------|
| `conversation_cleared` | 177–183 | Reset messages with tool event |
| `agent_connected` | 185–330 | Initial restore: `behaviorType`, blueprint, files, phases, `pendingUserInputs`, optional `preview` / `generate_all` resume |
| `template_updated` | 332–351 | `setTemplateDetails`, bootstrap files |
| `cf_agent_state` | 353–380 | Sync `projectType`, generation UI vs `shouldBeGenerating`, optional `preview` |
| `conversation_state` | 383–528 | Rebuild chat from `runningHistory`, merge assistant/tool, `deepDebugSession` UI |
| `file_generating` | 531–535 | File list + presentation hook |
| `file_chunk_generated` | 537–541 | Streaming file content |
| `file_generated` | 543–553 | Complete file + phase timeline |
| `file_regenerated` | 555–565 | Redeploy readiness |
| `file_regenerating` | 567–571 | Generating state |
| `generation_started` | 573–577 | Stages + `isGenerating` |
| `generation_complete` | 580–591 | Complete stages, AI system message |
| `deployment_started` | 594–596 | Preview deploying flag |
| `deployment_completed` | 599–603 | `previewUrl` |
| `deployment_failed` | 606–608 | Toast |
| `code_reviewed` | 611–624 | AI message |
| `runtime_error_found` | 627–638 | Error count + debug |
| `code_reviewing` | 641–667 | Counts + AI message |
| `phase_generating` | 670–674 | AI message, thinking flags |
| `phase_generated` | 677–681 | AI message |
| `phase_implementing` | 684–713 | Timeline + stage |
| `phase_validating` | 716–730 | Timeline + flags |
| `phase_validated` | 733–735 | AI message |
| `phase_implemented` | 738–773 | Complete phase, preview refresh timer |
| `preview_force_refresh` | 776–781 | Iframe refresh pulse |
| `generation_stopped` | 784–816 | Pause UI, cancel phases, toast |
| `generation_resumed` | 819–823 | Resume flags |
| `cloudflare_deployment_*` | 826–865 | Deploy UI + messages |
| `github_export_*` | 868–888 | AI messages / toast |
| `conversation_response` | 891–939 | **Ask/conversation path:** stream text, tool events, dedupe |
| `blueprint_chunk` | 942–960 | NDJSON repair parser → `setBlueprint` |
| `terminal_output` | 963–975 | `onTerminalMessage` |
| `server_log` | 977–990 | `onTerminalMessage` |
| `vault_required` | 992–1007 | Unlock modal / toast |
| `error` | 1010–1025 | AI error bubble |
| `rate_limit_error` | 1028–1036 | Rate limit helper |
| `default` | 1039–1040 | `logger.warn` unhandled |

---

## 4. “Ask mode” vs codegen agent — what exists vs product intent

**Product / plan language (“ask mode in any chat”):** A durable per-thread mode that **does not** start or drive codegen unless the user chooses “agent” is **not** implemented as a flag today (see §4.3 in prior structure—still valid).

**Closest current split: `BehaviorType` (`phasic` | `agentic`)**

Resolution at session creation (`resolveBehaviorType`):

```33:38:worker/api/controllers/agent/controller.ts
const resolveBehaviorType = (body: CodeGenArgs): BehaviorType => {
    if (body.behaviorType) return body.behaviorType;
    const pt = body.projectType;
    if (pt === 'presentation' || pt === 'workflow' || pt === 'general') return 'agentic';
    // default (including 'app' and when projectType omitted)
    return 'phasic';
};
```

**Phasic (`PhasicCodingBehavior`):** `handleUserInput` → `super.handleUserInput` → **`UserConversationProcessor`** runs immediately with tools and streams **`conversation_response`** (`phasic.ts` ~724–726; `base.ts` ~1645–1712).

**Agentic (`AgenticCodingBehavior`):** `handleUserInput` **queues** via `queueUserRequest`; while `isCodeGenerating()`, UI gets a synthetic **`conversation_response`** with tool name `Message Queued` (`agentic.ts` ~134–175). Conversation is fed later around tool completion (same file, private `handleMessageCompletion` ~180+).

**Codegen choke point (all behaviors):** After `behavior.handleUserInput`, if **not** `isCodeGenerating()`, **`CodeGeneratorAgent.handleUserInput` starts `generateAllFiles()`** (`codingAgent.ts` ~508–524). That means a user message in **idle** can still kick off codegen unless a future **ask** flag gates this line.

**UI send path (unchanged):** `chat.tsx` `onNewMessage` → `websocket.send(JSON.stringify({ type: 'user_suggestion', ... }))` (~658–674) plus optimistic `sendUserMessage` (~675–682). **No `mode` field** on the payload today.

**Restored “queued” UX:** `agent_connected` maps `state.pendingUserInputs` to user rows with `status: 'queued'` (`handle-websocket-message.ts` ~307–318)—aligns with agentic queue semantics on reconnect.

---

## 5. Connection lifecycle (URLs, DO, citations) — condensed

### 5.1 Session creation and URL

```163:164:worker/api/controllers/agent/controller.ts
            const websocketUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/api/agent/${agentId}/ws`;
```

### 5.2 WebSocket upgrade → Durable Object

```271:276:worker/api/controllers/agent/controller.ts
            try {
                // Get the agent instance to handle the WebSocket connection
                const agentInstance = await getAgentStub(env, agentId);

                // Let the agent handle the WebSocket connection directly
                return agentInstance.fetch(request);
```

```21:28:worker/agents/index.ts
export async function getAgentStub(
    env: Env, 
    agentId: string,
    props?: { behaviorType?: BehaviorType; projectType?: ProjectType }
) : Promise<DurableObjectStub<CodeGeneratorAgent>> {
    const options = props ? { props } : undefined;
    return getAgentByName<Env, CodeGeneratorAgent>(env.CodeGenObject, agentId, options);
}
```

### 5.3 Server connect and message dispatch

```212:226:worker/agents/core/codingAgent.ts
    onConnect(connection: Connection, ctx: ConnectionContext) {
        this.logger().info(`Agent connected for agent ${this.getAgentId()}`, { connection, ctx });
        let previewUrl = '';
        try {
            if (this.behavior.getTemplateDetails().renderMode === 'browser') {
                previewUrl = this.behavior.getBrowserPreviewURL();
            }
        } catch (error) {
            this.logger().error('Error getting preview URL:', error);
        }
        sendToConnection(connection, WebSocketMessageResponses.AGENT_CONNECTED, {
            state: this.state,
            templateDetails: this.behavior.getTemplateDetails(),
            previewUrl: previewUrl
        });
    }
```

```545:547:worker/agents/core/codingAgent.ts
    async onMessage(connection: Connection, message: string): Promise<void> {
        handleWebSocketMessage(this, connection, message);
    }
```

### 5.4 Client: open / message / retry

```305:341:src/routes/chat/hooks/use-chat.ts
				ws.addEventListener('open', () => {
					// ...
					sendWebSocketMessage(ws, 'get_conversation_state');

					// Request file generation for new chats only
					if (!disableGenerate && urlChatId === 'new') {
						logger.debug('🔄 Starting code generation for new chat');
						setIsGenerating(true);
						sendWebSocketMessage(ws, 'generate_all');
					}
				});
```

```343:350:src/routes/chat/hooks/use-chat.ts
				ws.addEventListener('message', (event) => {
					try {
						const message: WebSocketMessage = JSON.parse(event.data);
						handleWebSocketMessage(ws, message);
					} catch (parseError) {
						logger.error('❌ Error parsing WebSocket message:', parseError, event.data);
					}
				});
```

### 5.5 `agent_connected` restore + resume

```323:328:src/routes/chat/utils/handle-websocket-message.ts
                    if (state.shouldBeGenerating && !isGenerating) {
                        logger.debug('🔄 Reconnected with shouldBeGenerating=true, auto-resuming generation');
                        setIsGenerating(true); 
                        updateStage('code', { status: 'active' });
                        sendWebSocketMessage(websocket, 'generate_all');
                    }
```

---

## 6. User messages: UI → Worker → DO

### 6.1 Client send

```658:674:src/routes/chat/chat.tsx
	const onNewMessage = useCallback(
		(e: FormEvent) => {
			e.preventDefault();

			// Don't submit if chat is disabled or message is empty
			if (isChatDisabled || !newMessage.trim()) {
				return;
			}

			// When generation is active, send as conversational AI suggestion
			websocket?.send(
				JSON.stringify({
					type: 'user_suggestion',
					message: newMessage,
					images: images.length > 0 ? images : undefined,
				}),
			);
```

Note: comment says “when generation is active” but the **same** payload is used whenever chat is enabled; server decides behavior by **behavior + state**, not by a client mode flag.

### 6.2 Worker routing

```139:171:worker/agents/core/websocket.ts
            case WebSocketMessageRequests.USER_SUGGESTION:
                // Handle user suggestion for conversational AI
                logger.info('Received user suggestion', {
                    messageLength: parsedMessage.message?.length || 0,
                    hasImages: !!parsedMessage.images && parsedMessage.images.length > 0,
                    imageCount: parsedMessage.images?.length || 0
                });
                
                if (!parsedMessage.message) {
                    sendError(connection, 'No message provided in user suggestion');
                    return;
                }
                // ... image validation ...
                agent.handleUserInput(parsedMessage.message, parsedMessage.images).catch((error: unknown) => {
                    logger.error('Error handling user suggestion:', error);
                    sendError(connection, `Error processing user suggestion: ${error instanceof Error ? error.message : String(error)}`);
                });
                break;
```

### 6.3 Agent + conversation broadcast

```508:524:worker/agents/core/codingAgent.ts
    async handleUserInput(userMessage: string, images?: ImageAttachment[]): Promise<void> {
        try {
            this.logger().info('Processing user input message', { 
                messageLength: userMessage.length,
                pendingInputsCount: this.state.pendingUserInputs.length,
                hasImages: !!images && images.length > 0,
                imageCount: images?.length || 0
            });

            await this.behavior.handleUserInput(userMessage, images);
            if (!this.behavior.isCodeGenerating()) {
                // If idle, start generation process
                this.logger().info('User input during IDLE state, starting generation');
                this.behavior.generateAllFiles().catch(error => {
                    this.logger().error('Error starting generation from user input:', error);
                });
            }
```

```1674:1696:worker/agents/core/behaviors/base.ts
            const conversationalResponse = await this.operations.processUserMessage.execute(
                { 
                    userMessage, 
                    conversationState,
                    conversationResponseCallback: (
                        message: string,
                        conversationId: string,
                        isStreaming: boolean,
                        tool?: { name: string; status: 'start' | 'success' | 'error'; args?: Record<string, unknown> }
                    ) => {
                        // Track conversationId when deep_debug starts
                        if (tool?.name === 'deep_debug' && tool.status === 'start') {
                            this.deepDebugConversationId = conversationId;
                        }
                        
                        this.broadcast(WebSocketMessageResponses.CONVERSATION_RESPONSE, {
                            message,
                            conversationId,
                            isStreaming,
                            tool,
                        });
                    },
```

### 6.4 Client render of `conversation_response`

```891:939:src/routes/chat/utils/handle-websocket-message.ts
            case 'conversation_response': {
                // Use concrete conversationId when available; otherwise use placeholder id
                let conversationId = message.conversationId ?? 'conversation_response';
                // ... placeholder upgrade ...
                if (message.tool) {
                    const tool = message.tool;
                    setMessages(prev => appendToolEvent(prev, conversationId, { 
                        name: tool.name, 
                        status: tool.status,
                        result: tool.result 
                    }));
                    break;
                }

                if (message.isStreaming) {
                    setMessages(prev => handleStreamingMessage(prev, conversationId, isArchive ? placeholder : message.message, false));
                    break;
                }
                // ... final content / dedupe ...
            }
```

**Conversational bubble gating:** `sendMessage` in `use-chat` only applies IDs listed in `isConversationalMessage` (`message-helpers.ts` ~29–44). Streaming assistant text often uses ids like `conv-*` from the server; tool/system lines use `appendToolEvent` / `createAIMessage` with specific ids—worth remembering when adding new server message shapes.

---

## 7. AG-UI / PartySocket mapping (deeper paragraph)

**Authoritative transport today:** A single JSON line protocol over one WebSocket per `agentId`, typed in `worker/api/websocketTypes.ts` and routed on the client by a large `switch` in `handle-websocket-message.ts` (§3.1). **PartySocket** supplies a resilient `WebSocket` implementation for the browser; **semantic** routing is entirely application code, not PartyKit rooms.

**Conceptual map to AG-UI-style layers (future adapter, not present in repo):**

| Landi today | AG-UI-oriented role |
|-------------|---------------------|
| `agent_connected` + `conversation_state` | **Snapshot / run state** after connect or explicit fetch—equivalent to hydrating agent-run metadata + message list + pending work |
| `cf_agent_state` | **Incremental state patch** for generation flags and coarse `AgentState` (high frequency; client already throttles logging) |
| `conversation_response` (`message`, `conversationId`, `isStreaming`, `tool`) | **Assistant stream + tool lifecycle events**—closest analog to AG-UI “messages / tool calls / status” sequences |
| `conversation_cleared` | **Run reset** signal for UI transcript |
| Phase / file / deployment message types | **Domain-specific side channels** (artifacts, environment)—could become AG-UI “attachments” or parallel event namespaces rather than overloading chat |
| `get_conversation_state`, `user_suggestion`, `generate_all`, … | **Client → agent commands**—map to AG-UI input / action messages |

**Why DO + PartySocket fits an AG-UI adapter:** The Durable Object already **serializes** access to `CodeGenState`, conversation SQL, and generation. An adapter could **wrap** `broadcast()` / `sendToConnection()` to emit a second envelope (e.g. `type: 'agui_event', payload: ...`) **alongside** legacy types during migration, then collapse to native AG-UI once the client renderer consumes the new stream. **Reconnect:** `get_conversation_state` + `agent_connected.state` provide the same information AG-UI snapshots would need after disconnect; compaction (`archive-*` ids in `conversation_response`) is already a form of history truncation the adapter must preserve.

**CopilotKit / `ag-ui-cloudflare` (external):** Mentioned in planning docs as optional; this codebase does **not** embed those packages—the mapping above is **protocol-shape** guidance only.

---

## 8. Where a per-thread “ask vs agent” mode would plug in

**What exists today**

- **Thread identity:** `agentId` maps 1:1 to `CodeGeneratorAgent` DO state.
- **Behavior split:** `phasic` vs `agentic` from `projectType` / body (`controller.ts` ~33–38), restored in `agent_connected` (`handle-websocket-message.ts` ~190–193).
- **No ask flag:** `user_suggestion` has no `mode`; `handleUserInput` always may start `generateAllFiles` when idle (`codingAgent.ts` ~517–523).

**What is missing**

- Durable `conversationMode: 'ask' | 'agent'` (or similar) in `AgentState` + migration.
- Client payload + UI toggle (`chat.tsx` ~658+).
- Branch in `CodeGeneratorAgent.handleUserInput` (or early in `websocket.ts`) to skip `generateAllFiles` and optionally swap tool bundles.
- Optional sync via `agent_connected` / `cf_agent_state` for server-authoritative mode.

**Recommended plug-in order (minimal churn)**

1. Extend `AgentState` + migration.
2. Include mode in `agent_connected.state` for `setBehaviorType`-style restoration.
3. Single choke point: `CodeGeneratorAgent.handleUserInput` for codegen gating + processor options.
4. Extend `get_conversation_state` / client handler if mode must show before first send.

---

## 9. Platform assistant: tools without replacing the codegen DO

Unchanged from prior revision: tools are composed in `buildTools` (`worker/agents/tools/customTools.ts`); `UserConversationProcessor` executes `processUserMessage` with that set. Extension points: merge extra `ToolDefinition`s from config, mode-specific `buildAskTools`, or providers on `OperationOptions`.

---

## 10. Request/response type inventory (quick reference)

**Client → server:** `WebSocketMessageRequests` in `worker/agents/constants.ts` (~88–118): `generate_all`, `get_conversation_state`, `user_suggestion`, `preview`, `stop_generation`, `resume_generation`, `deploy`, `clear_conversation`, vault, `get_model_configs`, etc.

**Server → client:** `WebSocketMessageResponses` + `websocketTypes.ts`; client `switch` §3.1.

---

## 11. Self-review: Definition of Done and quality gates

| Criterion | Status |
|-----------|--------|
| Trace `handle-websocket-message` (client) | Done: factory, full §3.1 line map, `conversation_response` cited |
| PartySocket lifecycle | Done: §2 library vs app retry, open/message/close |
| Ask vs codegen / agentic vs phasic | Done: §4 + `handleUserInput` idle codegen |
| Worker/DO message mapping | Done: §5–6 + §10 |
| AG-UI / PartySocket paragraph | Done: §7 projection table + adapter notes |
| Path:line citations | Done; `chat.tsx` send block corrected to ~658–674 |
| Today vs missing | §8 |

**Quality gate:** Repo claims anchored to paths/lines; AG-UI section explicitly **future adapter**. **Detrimental effects:** None—documentation only.

**Gap fixed in this refresh:** Added §3.1 switch inventory; §2 PartySocket; §7 AG-UI mapping; corrected `chat.tsx` line numbers; clarified phasic vs agentic as current stand-in for “live chat vs queued” relative to product “ask mode.”
