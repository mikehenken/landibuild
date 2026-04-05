import { describe, it, expect } from 'vitest';
import { AGENT_UI_PROTOCOL_VERSION } from './websocketTypes';

describe('websocketTypes', () => {
    it('should have a stable AGENT_UI_PROTOCOL_VERSION', () => {
        expect(AGENT_UI_PROTOCOL_VERSION).toBe(1);
    });
});
