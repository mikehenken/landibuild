import { describe, it, expect } from 'vitest';
import { AGENT_WIRE_MANIFEST } from './agentWireManifest';

describe('AGENT_WIRE_MANIFEST', () => {
	it('has editor and internal profiles with non-empty tool lists', () => {
		expect(AGENT_WIRE_MANIFEST.version).toBeTruthy();
		expect(AGENT_WIRE_MANIFEST.profiles.editor.tools.length).toBeGreaterThan(0);
		expect(AGENT_WIRE_MANIFEST.profiles.internal.tools.length).toBeGreaterThan(0);
	});
});
