# Phase 1B: Chat, WebSocket, ask vs agent — code trace

**Task:** `p1b-codebase-chat-ask-agent-ws`  
**Scope:** Trace client and worker WebSocket handling, connection lifecycle, per-thread mode insertion points, and how a platform assistant could add tools without replacing the codegen Durable Object.

---

## 1. Naming: two different “WebSocket message handlers”

The codebase uses the same conceptual name in two places. Both handle **inbound** messages on their respective sides of the socket.

| Location | Symbol | Role |
|----------|--------|------|
| Frontend | `createWebSocketMessageHandler` in `src/routes/chat/utils/handle-websocket-message.ts` | Parses **server → client** `WebSocketMessage` JSON and updates React state |
| Worker | `handleWebSocketMessage` in `worker/agents/core/websocket.ts` | Parses **client → server** JSON and drives `CodeGeneratorAgent` |

This note avoids conflating them when reading docs or `CLAUDE.md`.

---

## 2. Connection lifecycle (what it does today)

### 2.1 Session creation and URL

1. **New chat:** `CodingAgentController.startCodeGeneration` creates `agentId`, persists app row, returns NDJSON stream including `websocketUrl` (`/api/agent/${agentId}/ws`).

```163:164:worker/api/controllers/agent/controller.ts
            const websocketUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/api/agent/${agentId}/ws`;
            const httpStatusUrl = `${url.origin}/api/agent/${agentId}`;
```

2. **Existing chat:** `connectToExistingAgent` returns the same URL shape.

```327:334:worker/api/controllers/agent/controller.ts
                const url = new URL(request.url);
                const websocketUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/api/agent/${agentId}/ws`;

                const responseData: AgentConnectionData = {
                    websocketUrl,
                    agentId,
                };
```

### 2.2 WebSocket upgrade → Durable Object

Authorized requests call `getAgentStub` then `agentInstance.fetch(request)` so the **Cloudflare Agents SDK** binds the socket to `CodeGeneratorAgent`.

```271:276:worker/api/controllers/agent/controller.ts
            try {
                // Get the agent instance to handle the WebSocket connection
                const agentInstance = await getAgentStub(env, agentId);

                // Let the agent handle the WebSocket connection directly
                return agentInstance.fetch(request);
```

Stub resolution (one DO per `agentId`):

```21:28:worker/agents/index.ts
export async function getAgentStub(
    env: Env, 
    agentId: string,
    props?: AgentStubProps
) : Promise<DurableObjectStub<CodeGeneratorAgent>> {
    const options = props ? { props } : undefined;
    return getAgentByName<Env, CodeGeneratorAgent>(env.CodeGenObject, agentId, options);
}
```

### 2.3 Server-side connect and first push

On connect, the DO sends `agent_connected` with full `state`, template metadata, and optional preview URL.

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

Incoming client frames are delegated to the worker `handleWebSocketMessage`:

```545:547:worker/agents/core/codingAgent.ts
    async onMessage(connection: Connection, message: string): Promise<void> {
        handleWebSocketMessage(this, connection, message);
    }
```

On close, vault session is cleared:

```242:246:worker/agents/core/websocket.ts
export function handleWebSocketClose(agent: CodeGeneratorAgent, connection: Connection): void {
    logger.info(`WebSocket connection closed: ${connection.id}`);
    // Clear vault session on disconnect for security
    agent.handleVaultLocked();
}
```

### 2.4 Client: `use-chat` connect, open, message, retry, teardown

- **Connect:** `connectWithRetry` constructs `partysocket` `WebSocket`, tracks `connectAttemptIdRef` to ignore stale events, 30s connect timeout.

```272:341:src/routes/chat/hooks/use-chat.ts
	const connectWithRetry = useCallback(
		(
			wsUrl: string,
			{ disableGenerate = false, isRetry = false }: { disableGenerate?: boolean; isRetry?: boolean } = {},
		) => {
			// ...
				const ws = new WebSocket(wsUrl);
				setWebsocket(ws);
				const myAttemptId = ++connectAttemptIdRef.current;
				// ...
				ws.addEventListener('open', () => {
					// ...
					sendWebSocketMessage(ws, 'get_conversation_state');
					if (!disableGenerate && urlChatId === 'new') {
						setIsGenerating(true);
						sendWebSocketMessage(ws, 'generate_all');
					}
				});
```

- **Inbound messages:** JSON parse → `handleWebSocketMessage(ws, message)` (the **client** handler from `createWebSocketMessageHandler`).

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

- **Failure:** exponential backoff retries; permanent failure surfaces UI + debug callback.

```387:418:src/routes/chat/hooks/use-chat.ts
	const handleConnectionFailure = useCallback(
		(wsUrl: string, disableGenerate: boolean, reason: string) => {
			connectionStatus.current = 'failed';
			if (retryCount.current >= maxRetries) {
				// ...
				return;
			}
			retryCount.current++;
			const retryDelay = Math.pow(2, retryCount.current) * 1000;
			// ...
			const timeoutId = setTimeout(() => {
				connectWithRetryRef.current?.(wsUrl, { disableGenerate, isRetry: true });
			}, actualDelay);
```

- **Unmount:** stop reconnects; close socket when `websocket` identity changes.

```618:638:src/routes/chat/hooks/use-chat.ts
    useEffect(() => {
        shouldReconnectRef.current = true;
        return () => {
            shouldReconnectRef.current = false;
            retryTimeouts.current.forEach(clearTimeout);
            // ...
        };
    }, []);

    useEffect(() => {
        return () => {
            websocket?.close();
        };
    }, [websocket]);
```

- **Init paths:** new chat streams blueprint then `connectWithRetry(result.websocketUrl)`; existing chat uses `connectWithRetry(..., { disableGenerate: true })` and relies on `agent_connected` / `shouldBeGenerating` to resume.

```554:593:src/routes/chat/hooks/use-chat.ts
					connectWithRetry(result.websocketUrl);
					// ...
					connectWithRetry(response.data.websocketUrl, {
						disableGenerate: true,
					});
```

### 2.5 Client handler: `agent_connected` and resume

First connection triggers restoration from `message.state` (behavior, blueprint, files, phases, queued inputs). If `shouldBeGenerating` and UI not generating, it sends `generate_all`.

```184:327:src/routes/chat/utils/handle-websocket-message.ts
            case 'agent_connected': {
                const { state, templateDetails, previewUrl } = message;
                if (!isInitialStateRestored) {
                    // ... setBehaviorType, setBlueprint, setFiles, phase timeline, pendingUserInputs ...
                    setIsInitialStateRestored(true);
                    if (state.shouldBeGenerating && !isGenerating) {
                        setIsGenerating(true);
                        updateStage('code', { status: 'active' });
                        sendWebSocketMessage(websocket, 'generate_all');
                    }
                }
                break;
            }
```

---

## 3. User messages: path from UI → codegen + conversation

### 3.1 Client send

Chat submit uses raw `websocket.send` with type `user_suggestion` (not `sendWebSocketMessage` helper).

```574:590:src/routes/chat/chat.tsx
	const onNewMessage = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			if (isChatDisabled || !newMessage.trim()) {
				return;
			}
			websocket?.send(
				JSON.stringify({
					type: 'user_suggestion',
					message: newMessage,
					images: images.length > 0 ? images : undefined,
				}),
			);
```

### 3.2 Worker routing

`WebSocketMessageRequests.USER_SUGGESTION` → `agent.handleUserInput`.

```139:171:worker/agents/core/websocket.ts
            case WebSocketMessageRequests.USER_SUGGESTION:
                // ...
                agent.handleUserInput(parsedMessage.message, parsedMessage.images).catch((error: unknown) => {
                    logger.error('Error handling user suggestion:', error);
                    sendError(connection, `Error processing user suggestion: ${error instanceof Error ? error.message : String(error)}`);
                });
                break;
```

### 3.3 Agent: idle triggers generation (phasic path)

After behavior handles input, if not generating, **generation is started**:

```508:524:worker/agents/core/codingAgent.ts
    async handleUserInput(userMessage: string, images?: ImageAttachment[]): Promise<void> {
        try {
            // ...
            await this.behavior.handleUserInput(userMessage, images);
            if (!this.behavior.isCodeGenerating()) {
                this.logger().info('User input during IDLE state, starting generation');
                this.behavior.generateAllFiles().catch(error => {
                    this.logger().error('Error starting generation from user input:', error);
                });
            }
```

### 3.4 Behavior: conversation LLM + tools

`BaseCodingBehavior.handleUserInput` runs `UserConversationProcessor` with streaming/tool callbacks over WebSocket (`conversation_response`).

```1645:1702:worker/agents/core/behaviors/base.ts
    async handleUserInput(userMessage: string, images?: ImageAttachment[]): Promise<void> {
        // ...
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
                        this.broadcast(WebSocketMessageResponses.CONVERSATION_RESPONSE, {
                            message,
                            conversationId,
                            isStreaming,
                            tool,
                        });
                    },
                    // ...
                }, 
                this.getOperationOptions()
            );
```

Tools are built inside `UserConversationProcessor.execute`:

```351:365:worker/agents/operations/UserConversationProcessor.ts
            const tools = buildTools(
                agent,
                logger,
                toolCallRenderer,
                (chunk: string) => inputs.conversationResponseCallback(chunk, aiConversationId, true)
            ).map(td => ({
                ...td,
                onStart: (_tc: ChatCompletionMessageFunctionToolCall, args: Record<string, unknown>) => Promise.resolve(toolCallRenderer({ name: td.name, status: 'start', args })),
                onComplete: (_tc: ChatCompletionMessageFunctionToolCall, args: Record<string, unknown>, result: unknown) => Promise.resolve(toolCallRenderer({
                    name: td.name,
                    status: 'success',
                    args,
                    result: typeof result === 'string' ? result : JSON.stringify(result)
                }))
            }));
```

### 3.5 Agentic behavior: queue-only user input

For `behaviorType === 'agentic'`, `handleUserInput` does **not** run the conversational processor on the hot path; it queues for later injection.

```134:175:worker/agents/core/behaviors/agentic.ts
    async handleUserInput(userMessage: string, images?: ImageAttachment[]): Promise<void> {
        // ...
        await this.queueUserRequest(userMessage, processedImages);
        if (this.isCodeGenerating()) {
            this.broadcast(WebSocketMessageResponses.CONVERSATION_RESPONSE, {
                message: '',
                conversationId: IdGenerator.generateConversationId(),
                isStreaming: false,
                tool: {
                    name: 'Message Queued',
                    status: 'success',
                    // ...
                }
            });
        }
```

### 3.6 Client: render streaming and tools

`conversation_response` updates messages, tool events, and streaming text.

```885:933:src/routes/chat/utils/handle-websocket-message.ts
            case 'conversation_response': {
                let conversationId = message.conversationId ?? 'conversation_response';
                // ...
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
                // ...
            }
```

---

## 4. Where a per-thread “ask vs agent” mode would plug in

**What exists today**

- **Thread identity:** `agentId` (chat id) maps 1:1 to `CodeGeneratorAgent` DO state (`worker/agents/index.ts`).
- **Behavior split:** `phasic` vs `agentic` is chosen at stub creation / `onStart` from `projectType`, not a user toggle per thread (`worker/api/controllers/agent/controller.ts` `resolveBehaviorType`, `codingAgent.ts` `onStart`).
- **No ask-mode flag:** `user_suggestion` has no `mode` field; `CodeGeneratorAgent.handleUserInput` always considers starting `generateAllFiles` when idle.

**What is missing**

- A **durable per-thread mode** (e.g. `conversationMode: 'ask' | 'agent'`) in `AgentState` or SQL, plus migration.
- **Client UI + payload:** e.g. `user_suggestion: { mode, message, images }` from `chat.tsx`.
- **Server gating:** branch in `worker/agents/core/websocket.ts` (early) or `CodeGeneratorAgent.handleUserInput` to:
  - skip `generateAllFiles()` when mode is `ask`;
  - optionally swap system prompt / tool list for ask-only (see section 5).
- **Client handler awareness:** optional UI state synced from `agent_connected` / `cf_agent_state` if mode is server-authoritative.

**Recommended plug-in order (minimal churn)**

1. Extend `AgentState` + persist via existing `setState` / migration pattern.
2. Include mode in `agent_connected.state` so `handle-websocket-message.ts` can set local UI state.
3. Branch `CodeGeneratorAgent.handleUserInput` (single choke point) for `generateAllFiles` and processor options.
4. Optionally extend `get_conversation_state` / `conversation_state` payload if the client must hydrate mode before first send.

---

## 5. Platform assistant: registering tools without replacing the codegen DO

**What it does today**

- Tools are **statically composed** in `buildTools` in `customTools.ts`; `UserConversationProcessor` always calls that list.

```42:62:worker/agents/tools/customTools.ts
export function buildTools(
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void,
): ToolDefinition<any, any>[] {
    return [
        toolWebSearchDefinition,
        toolFeedbackDefinition,
        createQueueRequestTool(agent, logger),
        // ...
    ];
}
```

**Architectural fact:** The “platform assistant” in production **is** the `UserConversationProcessor` + `executeInference` path inside the same DO that owns git, files, and codegen. Replacing the DO is not required to add capabilities.

**Ways to add platform tools (same `CodeGeneratorAgent`)**

1. **Registry merge at build time (in-DO):** Change `buildTools` to `buildTools(agent, logger, renderer, streamCb, context)` where `context` includes `extraDefinitions: ToolDefinition[]` loaded from D1/env/cache in `onStart` or lazily. `UserConversationProcessor` passes resolved tools. No second DO; optional tools can be feature-flagged per tenant.

2. **Mode-specific bundles:** For ask-mode, call `buildAskTools(...)` that omits `createQueueRequestTool` / `createGenerateFilesTool` analogs or replaces them with read-only platform tools. Still one DO; only the array passed to `executeInference` changes.

3. **Plugin hook on `OperationOptions` / `GenerationContext`:** If platform metadata already flows through `getOperationOptions()`, attach `platformToolProviders: () => ToolDefinition[]` so `UserConversationProcessor` stays generic.

4. **Out-of-band assistant (not preferred for “same thread”):** A separate Worker route could run a standalone LLM session; that **splits** conversation history unless synchronized back into `full_conversations` / `compact_conversations`. Possible for prototypes; weaker fit for “ask mode in any thread” without shared state.

**Security note:** New tools run with the same `ICodingAgent` capabilities as today; policy (which tools, which args) should be enforced when registering from a platform catalog, not only in the prompt.

---

## 6. Request/response type inventory (quick reference)

**Client → server** (non-exhaustive; see `WebSocketMessageRequests` in `worker/agents/constants.ts`): `generate_all`, `get_conversation_state`, `user_suggestion`, `preview`, `stop_generation`, `resume_generation`, `deploy`, `clear_conversation`, vault messages, `get_model_configs`, etc.

**Server → client:** Large set including `agent_connected`, `cf_agent_state`, `conversation_state`, `conversation_response`, generation/deployment phases, `error`, `rate_limit_error` — handled in the big `switch` in `handle-websocket-message.ts` (lines 175–1035).

---

## 7. Self-review: Definition of Done and quality gates

| Criterion | Status |
|-----------|--------|
| Trace `handle-websocket-message` (client) | Done: `createWebSocketMessageHandler`, factory return, major `switch` cases cited |
| Trace connection lifecycle | Done: controller upgrade, DO `onConnect` / `onMessage` / `onClose`, `use-chat` connect/retry/teardown |
| Per-thread mode plug-in | Done: explicit gaps + ordered insertion points |
| Platform assistant tools without replacing DO | Done: `buildTools` / `UserConversationProcessor` extension patterns |
| Path:line citations | Done throughout |
| “Today” vs “missing” separated | Sections 4–5 use labeled subsections |
| Align with plan workflow (on-disk artifact under `journal_root`) | This file |

**Quality gate (plan):** Repo claims anchored to paths/lines; hypothetical integration labeled as recommendation, not current behavior.

**Gap fixed during review:** Clarified the **two** different handlers named similarly (client vs worker) to prevent trace ambiguity.
