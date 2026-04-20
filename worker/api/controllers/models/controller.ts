import { BaseController } from '../baseController';
import { RouteContext } from '../../types/route-context';
import { ApiResponse, ControllerResponse } from '../types';
import { createLogger } from '../../../logger';
import { validateNativeHints } from './nativeHintsValidator';

/**
 * Inbound upsert payload — narrowed from the parsed JSON body.
 */
interface UpsertModelPayload {
    id: string;
    display_name: string;
    provider: string;
    invocation_kind: string;
    endpoint_id?: string | null;
    supports_tools?: boolean | null;
    supports_streaming?: boolean | null;
    supports_vision?: boolean | null;
    supports_audio_input?: boolean | null;
    supports_json_mode?: boolean | null;
    supports_system_prompt?: boolean | null;
    supports_thinking?: boolean | null;
    max_input_tokens?: number | null;
    max_output_tokens?: number | null;
    max_image_count?: number | null;
    max_audio_seconds?: number | null;
    input_cost_per_mtok?: number | null;
    output_cost_per_mtok?: number | null;
    per_request_cost?: number | null;
    cost_tier?: string | null;
    latency_class?: string | null;
    quality_tier?: string | null;
    default_temperature?: number | null;
    default_reasoning?: string | null;
    default_max_output?: number | null;
    native_hints?: unknown;
    tags?: string[] | null;
    use_cases?: string[] | null;
    verification?: string;
    status?: string | null;
    scope_kind?: string | null;
    scope_id?: string | null;
    fallback_model_id?: string | null;
    replaces_model_id?: string | null;
    deprecated_at?: number | null;
}

interface UpsertModelResponse {
    model: UpsertModelPayload;
    message: string;
}

interface ModelErrorBody {
    ok: false;
    code: string;
    message: string;
    details?: unknown;
}

const KNOWN_PROVIDERS = [
    'gemini',
    'openai-compat',
    'anthropic',
    'elevenlabs',
    'runway',
    'veo',
    'replicate',
    'langflow',
    'unknown',
] as const;

function jsonErrorResponse(body: ModelErrorBody, status: number): ControllerResponse<ApiResponse<never>> {
    const resp = new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
    return resp as unknown as ControllerResponse<ApiResponse<never>>;
}

function isUpsertModelPayload(value: unknown): value is UpsertModelPayload {
    if (value === null || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.id === 'string' &&
        typeof v.display_name === 'string' &&
        typeof v.provider === 'string' &&
        typeof v.invocation_kind === 'string'
    );
}

export class ModelsController extends BaseController {
    static logger = createLogger('ModelsController');

    /**
     * POST /api/models — create or update a model catalog entry.
     * Enforces §2.7.3 write-time validation.
     */
    static async upsertModel(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        _context: RouteContext,
    ): Promise<ControllerResponse<ApiResponse<UpsertModelResponse>>> {
        try {
            const bodyResult = await ModelsController.parseJsonBody<unknown>(request);
            if (!bodyResult.success || bodyResult.data === undefined) {
                return (bodyResult.response ??
                    ModelsController.createErrorResponse(
                        'Missing body',
                        400,
                    )) as ControllerResponse<ApiResponse<UpsertModelResponse>>;
            }

            if (!isUpsertModelPayload(bodyResult.data)) {
                return jsonErrorResponse(
                    {
                        ok: false,
                        code: 'MISSING_REQUIRED_FIELDS',
                        message:
                            'Missing required fields: id, display_name, provider, invocation_kind',
                    },
                    400,
                ) as unknown as ControllerResponse<ApiResponse<UpsertModelResponse>>;
            }

            const data: UpsertModelPayload = bodyResult.data;

            // §2.7.3: Negative cost fields
            if (
                (data.input_cost_per_mtok !== undefined &&
                    data.input_cost_per_mtok !== null &&
                    data.input_cost_per_mtok < 0) ||
                (data.output_cost_per_mtok !== undefined &&
                    data.output_cost_per_mtok !== null &&
                    data.output_cost_per_mtok < 0) ||
                (data.per_request_cost !== undefined &&
                    data.per_request_cost !== null &&
                    data.per_request_cost < 0)
            ) {
                return jsonErrorResponse(
                    {
                        ok: false,
                        code: 'NEGATIVE_COST',
                        message: 'Cost fields cannot be negative',
                    },
                    400,
                ) as unknown as ControllerResponse<ApiResponse<UpsertModelResponse>>;
            }

            // §2.7.3: Internally inconsistent capability claims
            if (data.invocation_kind === 'image' && data.supports_audio_input === true) {
                return jsonErrorResponse(
                    {
                        ok: false,
                        code: 'INCONSISTENT_CAPABILITIES',
                        message: 'Image models cannot support audio input',
                    },
                    400,
                ) as unknown as ControllerResponse<ApiResponse<UpsertModelResponse>>;
            }

            // §2.7.3: provider must be in adapter registry OR endpoint_id provided
            if (
                !(KNOWN_PROVIDERS as readonly string[]).includes(data.provider) &&
                !data.endpoint_id
            ) {
                return jsonErrorResponse(
                    {
                        ok: false,
                        code: 'UNKNOWN_PROVIDER_NO_ENDPOINT',
                        message:
                            'Provider not in adapter registry and no endpoint_id provided',
                    },
                    400,
                ) as unknown as ControllerResponse<ApiResponse<UpsertModelResponse>>;
            }

            const db = env.DB;

            // §2.7.3: fallback_model_id must exist
            if (data.fallback_model_id) {
                const fallbackExists = await db
                    .prepare('SELECT id FROM models WHERE id = ?')
                    .bind(data.fallback_model_id)
                    .first();
                if (!fallbackExists) {
                    return jsonErrorResponse(
                        {
                            ok: false,
                            code: 'INVALID_FALLBACK',
                            message: `Fallback model '${data.fallback_model_id}' does not exist`,
                        },
                        400,
                    ) as unknown as ControllerResponse<ApiResponse<UpsertModelResponse>>;
                }
            }

            // §2.7.3: native_hints must validate against the discriminated union
            if (data.native_hints !== undefined && data.native_hints !== null) {
                const validationResult = validateNativeHints(data.native_hints);
                if (!validationResult.ok) {
                    return jsonErrorResponse(
                        {
                            ok: false,
                            code: validationResult.code,
                            message: validationResult.message,
                            details: validationResult.errors,
                        },
                        400,
                    ) as unknown as ControllerResponse<ApiResponse<UpsertModelResponse>>;
                }
            }

            // Single batch: model upsert + revision bump. If either statement fails,
            // D1 rolls back the entire batch so the revision doesn't advance
            // against a failed write.
            const statements = [
                db.prepare(
                    `INSERT INTO models (
                        id, display_name, provider, invocation_kind, endpoint_id,
                        supports_tools, supports_streaming, supports_vision, supports_audio_input,
                        supports_json_mode, supports_system_prompt, supports_thinking,
                        max_input_tokens, max_output_tokens, max_image_count, max_audio_seconds,
                        input_cost_per_mtok, output_cost_per_mtok, per_request_cost, cost_tier,
                        latency_class, quality_tier, default_temperature, default_reasoning,
                        default_max_output, native_hints, tags, use_cases, verification,
                        status, scope_kind, scope_id, fallback_model_id, replaces_model_id,
                        updated_at, deprecated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        unixepoch(), ?
                    ) ON CONFLICT(id) DO UPDATE SET
                        display_name = excluded.display_name,
                        provider = excluded.provider,
                        invocation_kind = excluded.invocation_kind,
                        endpoint_id = excluded.endpoint_id,
                        supports_tools = excluded.supports_tools,
                        supports_streaming = excluded.supports_streaming,
                        supports_vision = excluded.supports_vision,
                        supports_audio_input = excluded.supports_audio_input,
                        supports_json_mode = excluded.supports_json_mode,
                        supports_system_prompt = excluded.supports_system_prompt,
                        supports_thinking = excluded.supports_thinking,
                        max_input_tokens = excluded.max_input_tokens,
                        max_output_tokens = excluded.max_output_tokens,
                        max_image_count = excluded.max_image_count,
                        max_audio_seconds = excluded.max_audio_seconds,
                        input_cost_per_mtok = excluded.input_cost_per_mtok,
                        output_cost_per_mtok = excluded.output_cost_per_mtok,
                        per_request_cost = excluded.per_request_cost,
                        cost_tier = excluded.cost_tier,
                        latency_class = excluded.latency_class,
                        quality_tier = excluded.quality_tier,
                        default_temperature = excluded.default_temperature,
                        default_reasoning = excluded.default_reasoning,
                        default_max_output = excluded.default_max_output,
                        native_hints = excluded.native_hints,
                        tags = excluded.tags,
                        use_cases = excluded.use_cases,
                        verification = excluded.verification,
                        status = excluded.status,
                        scope_kind = excluded.scope_kind,
                        scope_id = excluded.scope_id,
                        fallback_model_id = excluded.fallback_model_id,
                        replaces_model_id = excluded.replaces_model_id,
                        updated_at = excluded.updated_at,
                        deprecated_at = excluded.deprecated_at`,
                ).bind(
                    data.id,
                    data.display_name,
                    data.provider,
                    data.invocation_kind,
                    data.endpoint_id ?? null,
                    data.supports_tools ?? null,
                    data.supports_streaming ?? null,
                    data.supports_vision ?? null,
                    data.supports_audio_input ?? null,
                    data.supports_json_mode ?? null,
                    data.supports_system_prompt ?? null,
                    data.supports_thinking ?? null,
                    data.max_input_tokens ?? null,
                    data.max_output_tokens ?? null,
                    data.max_image_count ?? null,
                    data.max_audio_seconds ?? null,
                    data.input_cost_per_mtok ?? null,
                    data.output_cost_per_mtok ?? null,
                    data.per_request_cost ?? null,
                    data.cost_tier ?? null,
                    data.latency_class ?? null,
                    data.quality_tier ?? null,
                    data.default_temperature ?? null,
                    data.default_reasoning ?? null,
                    data.default_max_output ?? null,
                    data.native_hints !== undefined && data.native_hints !== null
                        ? JSON.stringify(data.native_hints)
                        : null,
                    data.tags ? JSON.stringify(data.tags) : null,
                    data.use_cases ? JSON.stringify(data.use_cases) : null,
                    data.verification ?? 'self-declared',
                    data.status ?? null,
                    data.scope_kind ?? null,
                    data.scope_id ?? null,
                    data.fallback_model_id ?? null,
                    data.replaces_model_id ?? null,
                    data.deprecated_at ?? null,
                ),
                db.prepare(
                    `INSERT INTO model_config_global_revision (id, revision, updated_at)
                    VALUES ('global', 1, unixepoch())
                    ON CONFLICT(id) DO UPDATE SET
                        revision = model_config_global_revision.revision + 1,
                        updated_at = unixepoch()`,
                ),
            ];

            await db.batch(statements);

            return ModelsController.createSuccessResponse<UpsertModelResponse>({
                model: data,
                message: 'Model processed successfully',
            });
        } catch (error) {
            this.logger.error('Error upserting model:', error);
            return ModelsController.createErrorResponse('Failed to upsert model', 500);
        }
    }
}
