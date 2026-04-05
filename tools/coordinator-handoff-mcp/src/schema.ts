import { z } from 'zod';

export const actorTypeSchema = z.enum(['coordinator', 'subagent', 'system', 'reviewer']);

export const handoffCoreSchema = z.object({
	schema_version: z.literal(1),
	study_id: z.string().min(1),
	phase_id: z.string().min(1),
	actor_type: actorTypeSchema,
	timestamp: z.string().min(1),
	task_id: z.string().optional(),
	body: z.record(z.unknown()),
});

export type HandoffCore = z.infer<typeof handoffCoreSchema>;

const chainTipHex = z.string().regex(/^[a-f0-9]{64}$/, 'prev_chain_tip must be 64 hex chars');

export const appendInputSchema = z.object({
	study_id: z.string().min(1),
	phase_id: z.string().min(1),
	actor_type: actorTypeSchema,
	task_id: z.string().optional(),
	timestamp: z.string().optional(),
	/** Must match current log tip when strict or COORDINATOR_HANDOFF_REQUIRE_CHAIN_TIP */
	prev_chain_tip: chainTipHex.optional(),
	/** Server reads each file under COORDINATOR_HANDOFF_WORKSPACE_ROOT and injects body.artifacts */
	artifact_paths: z.array(z.string().min(1)).optional(),
	body: z.record(z.unknown()).default({}),
});

export const commitHandoffInputSchema = appendInputSchema.extend({
	prev_chain_tip: chainTipHex,
	artifact_paths: z.array(z.string().min(1)).min(1),
});

export const verifyGateInputSchema = z.object({
	study_id: z.string().min(1),
	phase_id: z.string().min(1),
	artifact_paths: z.array(z.string().min(1)).min(1),
	/** If set, must equal the matched record fingerprint */
	expected_fingerprint: chainTipHex.optional(),
	actor_type: actorTypeSchema.optional(),
});
