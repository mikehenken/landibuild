type ToolUseEvent = {
	source: 'assistant' | 'user' | 'unknown';
	toolName: string;
	inputSummary: string;
};

function summarizeInput(input: unknown, maxLen: number): string {
	try {
		const s = JSON.stringify(input);
		if (s.length <= maxLen) {
			return s;
		}
		return `${s.slice(0, maxLen)}…`;
	} catch {
		return '[unserializable]';
	}
}

function extractContentToolUses(
	role: string | undefined,
	content: unknown,
): ToolUseEvent[] {
	if (!Array.isArray(content)) {
		return [];
	}
	const out: ToolUseEvent[] = [];
	const source: ToolUseEvent['source'] =
		role === 'assistant' ? 'assistant' : role === 'user' ? 'user' : 'unknown';
	for (const block of content) {
		if (!block || typeof block !== 'object') {
			continue;
		}
		const b = block as Record<string, unknown>;
		if (b.type !== 'tool_use') {
			continue;
		}
		const name = typeof b.name === 'string' ? b.name : 'unknown_tool';
		out.push({
			source,
			toolName: name,
			inputSummary: summarizeInput(b.input, 400),
		});
	}
	return out;
}

/**
 * Parse one JSONL line from Cursor agent-transcripts. Format varies; we only surface tool_use blocks.
 */
export function scanTranscriptLine(line: string): ToolUseEvent[] {
	const trimmed = line.trim();
	if (!trimmed) {
		return [];
	}
	let row: unknown;
	try {
		row = JSON.parse(trimmed) as unknown;
	} catch {
		return [];
	}
	if (!row || typeof row !== 'object') {
		return [];
	}
	const o = row as Record<string, unknown>;
	const role = typeof o.role === 'string' ? o.role : undefined;
	const message = o.message;
	if (!message || typeof message !== 'object') {
		return [];
	}
	const msg = message as Record<string, unknown>;
	return extractContentToolUses(role, msg.content);
}

export function isLikelyHandoffMcpCall(ev: ToolUseEvent): boolean {
	const n = ev.toolName.toLowerCase();
	const s = ev.inputSummary.toLowerCase();
	return (
		n.includes('mcp') ||
		s.includes('coordinator-handoff') ||
		s.includes('verify_phase_gate') ||
		s.includes('commit_handoff') ||
		s.includes('"append_handoff"')
	);
}
