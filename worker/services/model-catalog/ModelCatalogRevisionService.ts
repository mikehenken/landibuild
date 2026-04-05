/**
 * Monotonic revision for platform model catalog / bundle policy.
 * Clients can compare with the last seen revision to refetch user model config.
 */

import { BaseService } from '../../database/services/BaseService';
import { eq, sql } from 'drizzle-orm';
import { modelConfigGlobalRevision } from '../../database/schema';

export class ModelCatalogRevisionService extends BaseService {
	async getRevision(): Promise<number> {
		const row = await this.database
			.select()
			.from(modelConfigGlobalRevision)
			.where(eq(modelConfigGlobalRevision.id, 'global'))
			.get();
		if (!row) {
			await this.database
				.insert(modelConfigGlobalRevision)
				.values({ id: 'global', revision: 0, updatedAt: new Date() });
			return 0;
		}
		return row.revision;
	}

	/** Call after admin or platform changes that should refresh chat sessions. */
	async bumpRevision(): Promise<number> {
		await this.getRevision();
		await this.database
			.update(modelConfigGlobalRevision)
			.set({
				revision: sql`${modelConfigGlobalRevision.revision} + 1`,
				updatedAt: new Date(),
			})
			.where(eq(modelConfigGlobalRevision.id, 'global'));
		return this.getRevision();
	}
}
