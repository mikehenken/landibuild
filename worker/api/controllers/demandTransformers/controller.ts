import { BaseController } from '../baseController';
import { RouteContext } from '../../types/route-context';
import { ApiResponse, ControllerResponse } from '../types';
import { createLogger } from '../../../logger';

interface DemandTransformerPayload {
    id: string;
    scope_kind: 'platform' | 'agency' | 'account' | 'user' | 'run';
    scope_id?: string | null;
    priority?: number;
    locked?: boolean;
    transformers: unknown;
    applies_when?: unknown;
    ttl_expires_at?: number | null;
    status?: string;
}

function jsonErrorResponse(message: string, status: number): ControllerResponse<ApiResponse<never>> {
    const resp = new Response(JSON.stringify({ ok: false, message }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
    return resp as unknown as ControllerResponse<ApiResponse<never>>;
}

function isDemandTransformerPayload(value: unknown): value is DemandTransformerPayload {
    if (value === null || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.id === 'string' &&
        typeof v.scope_kind === 'string' &&
        v.transformers !== undefined
    );
}

export class DemandTransformersController extends BaseController {
    static logger = createLogger('DemandTransformersController');

    static async upsertTransformer(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        _context: RouteContext,
    ): Promise<ControllerResponse<ApiResponse<{ transformer: DemandTransformerPayload; message: string }>>> {
        try {
            const bodyResult = await DemandTransformersController.parseJsonBody<unknown>(request);
            if (!bodyResult.success || bodyResult.data === undefined) {
                return (bodyResult.response ??
                    DemandTransformersController.createErrorResponse('Missing body', 400)) as any;
            }

            if (!isDemandTransformerPayload(bodyResult.data)) {
                return jsonErrorResponse('Missing required fields: id, scope_kind, transformers', 400);
            }

            const data = bodyResult.data;
            const db = env.DB;

            const statements = [
                db.prepare(
                    `INSERT INTO demand_transformers (
                        id, scope_kind, scope_id, priority, locked, transformers, applies_when, ttl_expires_at, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
                    ON CONFLICT(id) DO UPDATE SET
                        scope_kind = excluded.scope_kind,
                        scope_id = excluded.scope_id,
                        priority = excluded.priority,
                        locked = excluded.locked,
                        transformers = excluded.transformers,
                        applies_when = excluded.applies_when,
                        ttl_expires_at = excluded.ttl_expires_at,
                        status = excluded.status`
                ).bind(
                    data.id,
                    data.scope_kind,
                    data.scope_id ?? null,
                    data.priority ?? 0,
                    data.locked ? 1 : 0,
                    JSON.stringify(data.transformers),
                    data.applies_when ? JSON.stringify(data.applies_when) : null,
                    data.ttl_expires_at ?? null,
                    data.status ?? 'active'
                ),
                db.prepare(
                    `INSERT INTO model_config_global_revision (id, revision, updated_at)
                    VALUES ('global', 1, unixepoch())
                    ON CONFLICT(id) DO UPDATE SET
                        revision = model_config_global_revision.revision + 1,
                        updated_at = unixepoch()`
                )
            ];

            await db.batch(statements);

            return DemandTransformersController.createSuccessResponse({
                transformer: data,
                message: 'Demand transformer processed successfully',
            });
        } catch (error) {
            this.logger.error('Error upserting demand transformer:', error);
            return DemandTransformersController.createErrorResponse('Failed to upsert demand transformer', 500);
        }
    }
}
