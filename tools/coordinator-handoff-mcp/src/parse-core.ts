import { handoffCoreSchema, type HandoffCore } from './schema.js';

export function parseCoreFromCanonical(canonical: string): HandoffCore {
	const parsed: unknown = JSON.parse(canonical);
	return handoffCoreSchema.parse(parsed);
}
