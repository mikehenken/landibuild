import { describe, it, expect } from 'vitest';
import { AgentConfig } from '../../worker/agents/inferutils/config.types';
import { AGENT_CONFIG } from '../../worker/agents/inferutils/config';

describe('AgentConfig extension tests', () => {
    it('should have new NAS keys in AGENT_CONFIG', () => {
        expect(AGENT_CONFIG).toHaveProperty('nasPlan');
        expect(AGENT_CONFIG).toHaveProperty('nasEdit');
        expect(AGENT_CONFIG).toHaveProperty('nasResearch');
        expect(AGENT_CONFIG).toHaveProperty('nasGenerate');
        expect(AGENT_CONFIG).toHaveProperty('nasCritic');
        expect(AGENT_CONFIG).toHaveProperty('nasRespond');
        expect(AGENT_CONFIG).toHaveProperty('nasVision');
    });

    it('should correctly set landi-2.5-pro for nasEdit', () => {
        expect(AGENT_CONFIG.nasEdit.name).toBe('landi-2.5-pro');
    });
});
