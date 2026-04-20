/**
 * Fixture seed for compile-bundle tests. Produces a realistic catalog of
 * ≥ 50 models, 10 custom endpoints, and 20 demand transformers with populated
 * metadata so the 256 KB gzip budget and golden-fixture assertions are
 * meaningful (not a trivially-small fixture that always passes).
 *
 * Used by:
 *   - test/unit/compileBundleSize.test.ts (size assertion)
 *   - test/unit/compileBundleGolden.test.ts (deep-equal against a golden JSON)
 */

export interface SeededModel {
    id: string;
    display_name: string;
    provider: string;
    invocation_kind: 'text' | 'image' | 'audio' | 'video' | 'embedding';
    verification: 'verified' | 'self-declared' | 'unverified';
    supports_tools?: number;
    supports_streaming?: number;
    supports_vision?: number;
    supports_audio_input?: number;
    supports_json_mode?: number;
    supports_system_prompt?: number;
    supports_thinking?: number;
    max_input_tokens?: number;
    max_output_tokens?: number;
    input_cost_per_mtok?: number;
    output_cost_per_mtok?: number;
    cost_tier?: 'free' | 'low' | 'mid' | 'high' | 'premium';
    latency_class?: 'realtime' | 'fast' | 'standard' | 'slow';
    quality_tier?: 'draft' | 'standard' | 'pro' | 'flagship';
    default_temperature?: number;
    default_max_output?: number;
    native_hints?: Record<string, unknown>;
    tags?: string[];
    use_cases?: string[];
    status?: 'active' | 'deprecated' | 'experimental' | 'disabled';
    scope_kind?: 'platform' | 'agency' | 'account' | 'user';
    scope_id?: string;
    fallback_model_id?: string;
}

export interface SeededCustomEndpoint {
    id: string;
    scope_kind: 'platform' | 'agency' | 'account' | 'user';
    scope_id: string | null;
    name: string;
    provider_kind: string;
    base_url: string;
    headers: Record<string, string>;
    auth_ref: string;
}

export interface SeededDemandTransformer {
    id: string;
    scope_kind: 'platform' | 'agency' | 'account' | 'user' | 'run';
    scope_id: string | null;
    priority: number;
    locked: number;
    transformers: Array<{
        op: 'set-model' | 'force-model' | 'cap-quality' | 'set-param' | 'require-capability';
        target?: string;
        value?: string | number | boolean;
    }>;
    applies_when?: Record<string, unknown>;
    status: 'active' | 'disabled';
}

const TAG_POOL = ['fast', 'cheap', 'high-quality', 'multilingual', 'code', 'vision', 'voice'];
const USE_CASE_POOL = ['chat', 'summarization', 'generation', 'classification', 'translation'];

function rotatingTags(i: number): string[] {
    return [TAG_POOL[i % TAG_POOL.length], TAG_POOL[(i + 1) % TAG_POOL.length]];
}

function rotatingUseCases(i: number): string[] {
    return [USE_CASE_POOL[i % USE_CASE_POOL.length]];
}

export function buildSeededModels(): SeededModel[] {
    const models: SeededModel[] = [];

    // 30 text models across providers / quality tiers / cost tiers
    for (let i = 0; i < 30; i++) {
        const quality =
            i < 8 ? 'flagship' : i < 16 ? 'pro' : i < 24 ? 'standard' : 'draft';
        const cost = i < 6 ? 'premium' : i < 12 ? 'high' : i < 20 ? 'mid' : i < 26 ? 'low' : 'free';
        const provider =
            i % 4 === 0
                ? 'openai-compat'
                : i % 4 === 1
                  ? 'gemini'
                  : i % 4 === 2
                    ? 'anthropic'
                    : 'openai-compat';
        models.push({
            id: `text-model-${i.toString().padStart(2, '0')}`,
            display_name: `Text Model ${i}`,
            provider,
            invocation_kind: 'text',
            verification: i % 3 === 0 ? 'verified' : i % 3 === 1 ? 'self-declared' : 'unverified',
            supports_tools: 1,
            supports_streaming: 1,
            supports_json_mode: i % 2,
            supports_system_prompt: 1,
            supports_thinking: i < 10 ? 1 : 0,
            max_input_tokens: 128_000 + i * 4096,
            max_output_tokens: 8192,
            input_cost_per_mtok: 0.25 + i * 0.15,
            output_cost_per_mtok: 0.75 + i * 0.3,
            cost_tier: cost,
            latency_class: i < 10 ? 'fast' : i < 20 ? 'standard' : 'slow',
            quality_tier: quality,
            default_temperature: 0.7,
            default_max_output: 4096,
            native_hints:
                provider === 'gemini'
                    ? { provider: 'gemini', useSystemInstruction: true, thinkingBudget: 1024 }
                    : provider === 'anthropic'
                      ? {
                            provider: 'anthropic',
                            thinking: { type: 'enabled', budget_tokens: 1024 },
                        }
                      : { provider: 'openai-compat', reasoningEffort: 'medium' },
            tags: rotatingTags(i),
            use_cases: rotatingUseCases(i),
            status: i === 29 ? 'deprecated' : 'active',
            scope_kind: 'platform',
        });
    }

    // 10 image models
    for (let i = 0; i < 10; i++) {
        models.push({
            id: `image-model-${i.toString().padStart(2, '0')}`,
            display_name: `Image Model ${i}`,
            provider: i % 2 === 0 ? 'gemini' : 'replicate',
            invocation_kind: 'image',
            verification: 'self-declared',
            supports_vision: 1,
            max_image_count: 4,
            input_cost_per_mtok: 1.0,
            cost_tier: i < 3 ? 'high' : 'mid',
            quality_tier: i < 4 ? 'flagship' : 'pro',
            latency_class: 'standard',
            native_hints:
                i % 2 === 0
                    ? { provider: 'gemini', useSystemInstruction: false }
                    : {
                          provider: 'replicate',
                          replicateModelSlug: `stability-ai/sdxl-${i}`,
                      },
            tags: rotatingTags(i),
            use_cases: ['generation'],
            status: 'active',
            scope_kind: 'platform',
        });
    }

    // 5 audio models
    for (let i = 0; i < 5; i++) {
        models.push({
            id: `audio-model-${i.toString().padStart(2, '0')}`,
            display_name: `Audio Model ${i}`,
            provider: i < 3 ? 'elevenlabs' : 'openai-compat',
            invocation_kind: 'audio',
            verification: 'self-declared',
            supports_audio_input: 1,
            quality_tier: 'pro',
            cost_tier: 'mid',
            latency_class: 'fast',
            native_hints:
                i < 3
                    ? {
                          provider: 'elevenlabs',
                          voiceId: `voice_${i}`,
                          stability: 0.5,
                          similarityBoost: 0.75,
                      }
                    : { provider: 'openai-compat' },
            tags: ['voice'],
            use_cases: ['chat'],
            status: 'active',
            scope_kind: 'platform',
        });
    }

    // 3 video models
    for (let i = 0; i < 3; i++) {
        models.push({
            id: `video-model-${i.toString().padStart(2, '0')}`,
            display_name: `Video Model ${i}`,
            provider: i === 0 ? 'veo' : 'runway',
            invocation_kind: 'video',
            verification: 'self-declared',
            quality_tier: 'pro',
            cost_tier: 'premium',
            latency_class: 'slow',
            native_hints:
                i === 0
                    ? {
                          provider: 'veo',
                          aspectRatio: '16:9',
                          personGeneration: 'allow',
                      }
                    : { provider: 'runway', model: 'gen3', duration: 4, motionScale: 0.5 },
            tags: ['video'],
            use_cases: ['generation'],
            status: 'active',
            scope_kind: 'platform',
        });
    }

    // 3 embedding models
    for (let i = 0; i < 3; i++) {
        models.push({
            id: `embedding-model-${i.toString().padStart(2, '0')}`,
            display_name: `Embedding Model ${i}`,
            provider: 'openai-compat',
            invocation_kind: 'embedding',
            verification: 'verified',
            quality_tier: 'standard',
            cost_tier: 'low',
            latency_class: 'realtime',
            max_input_tokens: 8192,
            native_hints: { provider: 'openai-compat' },
            tags: ['cheap'],
            use_cases: ['classification'],
            status: 'active',
            scope_kind: 'platform',
        });
    }

    return models; // 30 + 10 + 5 + 3 + 3 = 51
}

export function buildSeededCustomEndpoints(): SeededCustomEndpoint[] {
    const endpoints: SeededCustomEndpoint[] = [];
    const scopes: SeededCustomEndpoint['scope_kind'][] = ['platform', 'agency', 'account', 'user'];
    for (let i = 0; i < 10; i++) {
        const scope_kind = scopes[i % scopes.length];
        endpoints.push({
            id: `endpoint-${i.toString().padStart(2, '0')}`,
            scope_kind,
            scope_id: scope_kind === 'platform' ? null : `scope_${i}`,
            name: `Custom Endpoint ${i}`,
            provider_kind: i % 2 === 0 ? 'openai-compat' : 'anthropic-compat',
            base_url: `https://endpoint-${i}.example.com/v1`,
            headers: {
                'X-Client-Id': `client-${i}`,
                'X-Source': 'landi',
            },
            auth_ref: `secret://custom-endpoint-${i}`,
        });
    }
    return endpoints;
}

export function buildSeededDemandTransformers(): SeededDemandTransformer[] {
    const transformers: SeededDemandTransformer[] = [];
    const scopes: SeededDemandTransformer['scope_kind'][] = [
        'platform',
        'agency',
        'account',
        'user',
    ];
    for (let i = 0; i < 20; i++) {
        const scope_kind = scopes[i % scopes.length];
        transformers.push({
            id: `transformer-${i.toString().padStart(2, '0')}`,
            scope_kind,
            scope_id: scope_kind === 'platform' ? null : `scope_${i}`,
            priority: i,
            locked: i < 3 ? 1 : 0,
            transformers: [
                {
                    op: 'cap-quality',
                    value: i % 2 === 0 ? 'pro' : 'standard',
                },
                {
                    op: 'set-param',
                    target: 'temperature',
                    value: 0.5,
                },
            ],
            applies_when: { kind: 'text' },
            status: 'active',
        });
    }
    return transformers;
}

/**
 * Seed the test D1 catalog tables.
 * Assumes tables already exist (created by miniflare schema or beforeAll).
 */
export async function seedCatalog(
    db: D1Database,
    opts?: { resetRevisionTo?: number },
): Promise<void> {
    const models = buildSeededModels();
    const endpoints = buildSeededCustomEndpoints();
    const transformers = buildSeededDemandTransformers();

    const revision = opts?.resetRevisionTo ?? 1;
    await db
        .prepare(
            `INSERT INTO model_config_global_revision (id, revision) VALUES ('global', ?)
            ON CONFLICT(id) DO UPDATE SET revision = ?`,
        )
        .bind(revision, revision)
        .run();

    for (const e of endpoints) {
        await db
            .prepare(
                `INSERT INTO custom_endpoints (id, scope_kind, scope_id, name, provider_kind, base_url, headers, auth_ref)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING`,
            )
            .bind(
                e.id,
                e.scope_kind,
                e.scope_id,
                e.name,
                e.provider_kind,
                e.base_url,
                JSON.stringify(e.headers),
                e.auth_ref,
            )
            .run();
    }

    for (const m of models) {
        await db
            .prepare(
                `INSERT INTO models (
                    id, display_name, provider, invocation_kind,
                    supports_tools, supports_streaming, supports_vision, supports_audio_input,
                    supports_json_mode, supports_system_prompt, supports_thinking,
                    max_input_tokens, max_output_tokens, max_image_count,
                    input_cost_per_mtok, output_cost_per_mtok, cost_tier,
                    latency_class, quality_tier, default_temperature, default_max_output,
                    native_hints, tags, use_cases, verification, status, scope_kind, scope_id,
                    fallback_model_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING`,
            )
            .bind(
                m.id,
                m.display_name,
                m.provider,
                m.invocation_kind,
                m.supports_tools ?? null,
                m.supports_streaming ?? null,
                m.supports_vision ?? null,
                m.supports_audio_input ?? null,
                m.supports_json_mode ?? null,
                m.supports_system_prompt ?? null,
                m.supports_thinking ?? null,
                m.max_input_tokens ?? null,
                m.max_output_tokens ?? null,
                m.max_image_count ?? null,
                m.input_cost_per_mtok ?? null,
                m.output_cost_per_mtok ?? null,
                m.cost_tier ?? null,
                m.latency_class ?? null,
                m.quality_tier ?? null,
                m.default_temperature ?? null,
                m.default_max_output ?? null,
                m.native_hints ? JSON.stringify(m.native_hints) : null,
                m.tags ? JSON.stringify(m.tags) : null,
                m.use_cases ? JSON.stringify(m.use_cases) : null,
                m.verification,
                m.status ?? null,
                m.scope_kind ?? null,
                m.scope_id ?? null,
                m.fallback_model_id ?? null,
            )
            .run();
    }

    for (const t of transformers) {
        await db
            .prepare(
                `INSERT INTO demand_transformers (
                    id, scope_kind, scope_id, priority, locked, transformers, applies_when, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING`,
            )
            .bind(
                t.id,
                t.scope_kind,
                t.scope_id,
                t.priority,
                t.locked,
                JSON.stringify(t.transformers),
                t.applies_when ? JSON.stringify(t.applies_when) : null,
                t.status,
            )
            .run();
    }
}

export const EXPECTED_SEED_COUNTS = {
    models: 51,
    customEndpoints: 10,
    demandTransformers: 20,
} as const;
