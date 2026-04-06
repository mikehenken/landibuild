/**
 * Monotonic revision for platform model catalog / bundle policy.
 * Clients can compare with the last seen revision to refetch user model config.
 */

import { BaseService } from '../../database/services/BaseService';
import { eq, sql } from 'drizzle-orm';
import { modelConfigGlobalRevision } from '../../database/schema';

const MIGRATE_LOCAL_HINT = 'npm run db:migrate:local';

function isMissingModelCatalogRevisionTable(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; depth < 8 && current != null; depth++) {
		const text =
			typeof current === 'object' &&
			current !== null &&
			'message' in current &&
			typeof (current as { message: unknown }).message === 'string'
				? (current as { message: string }).message
				: String(current);
		if (/no such table/i.test(text) && text.includes('model_config_global_revision')) {
			return true;
		}
		const cause =
			typeof current === 'object' && current !== null && 'cause' in current
				? (current as { cause?: unknown }).cause
				: undefined;
		current = cause;
	}
	return false;
}

export class ModelCatalogRevisionService extends BaseService {
	async getRevision(): Promise<number> {
		try {
			const row = await this.database
				.select()
				.from(modelConfigGlobalRevision)
				.where(eq(modelConfigGlobalRevision.id, 'global'))
				.get();
			if (!row) {
				try {
					await this.database
						.insert(modelConfigGlobalRevision)
						.values({ id: 'global', revision: 0, updatedAt: new Date() });
				} catch (insertErr) {
					if (isMissingModelCatalogRevisionTable(insertErr)) {
						this.logger.warn(
							`model_config_global_revision missing; revision pinned to 0. Run: ${MIGRATE_LOCAL_HINT}`,
						);
						return 0;
					}
					throw insertErr;
				}
				return 0;
			}
			return row.revision;
		} catch (e) {
			if (isMissingModelCatalogRevisionTable(e)) {
				this.logger.warn(
					`model_config_global_revision missing; revision pinned to 0. Run: ${MIGRATE_LOCAL_HINT}`,
				);
				return 0;
			}
			throw e;
		}
	}

	/** Call after admin or platform changes that should refresh chat sessions. */
	async bumpRevision(): Promise<number> {
		try {
			await this.getRevision();
			await this.database
				.update(modelConfigGlobalRevision)
				.set({
					revision: sql`${modelConfigGlobalRevision.revision} + 1`,
					updatedAt: new Date(),
				})
				.where(eq(modelConfigGlobalRevision.id, 'global'));
			return this.getRevision();
		} catch (e) {
			if (isMissingModelCatalogRevisionTable(e)) {
				const msg = `model_config_global_revision table missing; apply D1 migrations (${MIGRATE_LOCAL_HINT}).`;
				this.logger.error(msg);
				throw new Error(msg);
			}
			throw e;
		}
	}
}
