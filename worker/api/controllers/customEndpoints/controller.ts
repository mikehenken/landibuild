import { BaseController } from '../baseController';
import { RouteContext } from '../../types/route-context';
import { ApiResponse, ControllerResponse } from '../types';
import { createLogger } from '../../../logger';

interface CustomEndpointPayload {
    id: string;
    scope_kind: 'platform' | 'agency' | 'account' | 'user';
    scope_id?: string | null;
    name: string;
    provider_kind: string;
    base_url: string;
    headers?: unknown;
    auth_ref?: string | null;
}

function jsonErrorResponse(message: string, status: number): ControllerResponse<ApiResponse<never>> {
    const resp = new Response(JSON.stringify({ ok: false, message }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
    return resp as unknown as ControllerResponse<ApiResponse<never>>;
}

function isCustomEndpointPayload(value: unknown): value is CustomEndpointPayload {
    if (value === null || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.id === 'string' &&
        typeof v.scope_kind === 'string' &&
        typeof v.name === 'string' &&
        typeof v.provider_kind === 'string' &&
        typeof v.base_url === 'string'
    );
}

export class CustomEndpointsController extends BaseController {
    static logger = createLogger('CustomEndpointsController');

    static async upsertEndpoint(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        _context: RouteContext,
    ): Promise<ControllerResponse<ApiResponse<{ endpoint: CustomEndpointPayload; message: string }>>> {
        try {
            const bodyResult = await CustomEndpointsController.parseJsonBody<unknown>(request);
            if (!bodyResult.success || bodyResult.data === undefined) {
                return (bodyResult.response ??
                    CustomEndpointsController.createErrorResponse('Missing body', 400)) as any;
            }

            if (!isCustomEndpointPayload(bodyResult.data)) {
                return jsonErrorResponse('Missing required fields: id, scope_kind, name, provider_kind, base_url', 400);
            }

            const data = bodyResult.data;
            const db = env.DB;

            const statements = [
                db.prepare(
                    `INSERT INTO custom_endpoints (
                        id, scope_kind, scope_id, name, provider_kind, base_url, headers, auth_ref, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
                    ON CONFLICT(id) DO UPDATE SET
                        scope_kind = excluded.scope_kind,
                        scope_id = excluded.scope_id,
                        name = excluded.name,
                        provider_kind = excluded.provider_kind,
                        base_url = excluded.base_url,
                        headers = excluded.headers,
                        auth_ref = excluded.auth_ref`
                ).bind(
                    data.id,
                    data.scope_kind,
                    data.scope_id ?? null,
                    data.name,
                    data.provider_kind,
                    data.base_url,
                    data.headers ? JSON.stringify(data.headers) : null,
                    data.auth_ref ?? null
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

            return CustomEndpointsController.createSuccessResponse({
                endpoint: data,
                message: 'Custom endpoint processed successfully',
            });
        } catch (error) {
            this.logger.error('Error upserting custom endpoint:', error);
            return CustomEndpointsController.createErrorResponse('Failed to upsert custom endpoint', 500);
        }
    }
}
