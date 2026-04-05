import { WebSocketMessageResponses } from "../constants";
import { AGENT_UI_PROTOCOL_VERSION, AgentUiEventName } from "../../api/websocketTypes";
import type { ICodingAgent } from "../services/interfaces/ICodingAgent";

/**
 * Helper to emit standardized Agent-UI events over the WebSocket.
 * These run parallel to the legacy `conversation_response` events,
 * allowing newer clients to consume a cleaner, versioned event stream.
 */
export function emitAgentUiEvent(
	agent: ICodingAgent,
	eventName: AgentUiEventName,
	payload: Record<string, unknown>,
	runId?: string
): void {
	agent.broadcast(WebSocketMessageResponses.AGENT_UI_EVENT, {
		protocolVersion: AGENT_UI_PROTOCOL_VERSION,
		eventName,
		runId,
		payload
	});
}
