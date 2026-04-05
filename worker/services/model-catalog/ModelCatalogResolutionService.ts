/**
 * Bridges build-time AGENT_CONFIG with D1-backed catalog revision until full D1 catalog rows ship.
 */

import type { AgentActionKey } from '../../agents/inferutils/config.types';
import { AGENT_CONFIG } from '../../agents/inferutils/config';
import { ModelCatalogRevisionService } from './ModelCatalogRevisionService';

export type ResolvedModelCatalogContext = {
	revision: number;
	/** True until D1 rows drive per-action defaults; then becomes false. */
	fallbackToBuildTimeConfig: boolean;
	defaultAgentActionKeys: AgentActionKey[];
};

export class ModelCatalogResolutionService {
	constructor(private readonly env: Env) {}

	async resolveForUser(_userId: string): Promise<ResolvedModelCatalogContext> {
		const revSvc = new ModelCatalogRevisionService(this.env);
		const revision = await revSvc.getRevision();
		const defaultAgentActionKeys = Object.keys(AGENT_CONFIG) as AgentActionKey[];
		return {
			revision,
			fallbackToBuildTimeConfig: true,
			defaultAgentActionKeys,
		};
	}
}
