import { BaseController } from '../baseController';
import { RouteContext } from '../../types/route-context';
import { ApiResponse, ControllerResponse } from '../types';
import { createLogger } from '../../../logger';
import type {
    CompiledBundle,
    CustomEndpointDescriptor,
    DecisionTreeLeaf,
    DecisionTreeNode,
    DecisionTreeKindSplit,
    DecisionTreeCapabilitySplit,
    DecisionTreeQualitySplit,
    Fallbacks,
    HotPathEntry,
    InvocationKind,
    ModelDescriptor,
    ModelStatus,
    ParamsOverride,
    PrecomposedChainEntry,
    QualityBucket,
    QualityTier,
    RawCustomEndpointRow,
    RawDemandTransformerRow,
    RawModelRow,
    Rule,
    ScopeKind,
    Transformer,
    Verification,
} from './types';
import { CAPABILITY_BITS } from './types';
import type { NativeHints } from '../../../database/types/nativeHints';
import { isKnownNativeHintProvider } from '../../../database/types/nativeHints';

interface RevisionRow {
    revision: number;
}

/** Agent keys Nas currently needs hot-path entries for (§2.4 + §2.5.2). */
const AGENT_HOT_PATH_KEYS = [
    'nasPlan',
    'nasResearch',
    'nasEdit',
    'nasCritic',
    'nasRespond',
    'nasGenerate',
    'nasVision',
] as const;

/** Maps each agent to the invocation kind it emits on its hot path. */
const AGENT_KIND_MAP: Record<(typeof AGENT_HOT_PATH_KEYS)[number], InvocationKind> = {
    nasPlan: 'text',
    nasResearch: 'text',
    nasEdit: 'text',
    nasCritic: 'text',
    nasRespond: 'text',
    nasGenerate: 'text',
    nasVision: 'image',
};

const QUALITY_TIER_RANK: Record<QualityTier, number> = {
    draft: 0,
    standard: 1,
    pro: 2,
    flagship: 3,
};

const VERIFICATION_RANK: Record<Verification, number> = {
    unverified: 0,
    'self-declared': 1,
    verified: 2,
};

function qualityToBucket(tier: QualityTier | null): QualityBucket {
    if (tier === null) return 'low';
    switch (tier) {
        case 'draft':
            return 'low';
        case 'standard':
            return 'mid';
        case 'pro':
            return 'high';
        case 'flagship':
            return 'flagship';
    }
}

function parseJsonArray<T>(raw: string | null): T[] | null {
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch {
        return null;
    }
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

function parseNativeHints(raw: string | null): NativeHints | null {
    const obj = parseJsonObject(raw);
    if (obj === null) return null;
    const provider = obj.provider;
    if (typeof provider !== 'string' || !isKnownNativeHintProvider(provider)) {
        return null;
    }
    // The validator on the write path guarantees the shape is valid; trust it here.
    return obj as unknown as NativeHints;
}

function coerceBool(value: number | null): boolean | null {
    if (value === null) return null;
    return value === 1;
}

function toInvocationKind(value: string): InvocationKind {
    switch (value) {
        case 'text':
        case 'image':
        case 'audio':
        case 'video':
        case 'embedding':
            return value;
        default:
            // Unknown kinds disqualify from demand routing; treat as text so it
            // still appears in the bundle but is filtered out of fallbacks.
            return 'text';
    }
}

function toQualityTier(value: string | null): QualityTier | null {
    if (value === 'draft' || value === 'standard' || value === 'pro' || value === 'flagship') {
        return value;
    }
    return null;
}

function toVerification(value: string): Verification {
    if (value === 'verified' || value === 'self-declared' || value === 'unverified') {
        return value;
    }
    return 'self-declared';
}

function toStatus(value: string | null): ModelStatus | null {
    if (
        value === 'active' ||
        value === 'deprecated' ||
        value === 'experimental' ||
        value === 'disabled'
    ) {
        return value;
    }
    return null;
}

function toScopeKind(value: string | null): ScopeKind | null {
    if (
        value === 'platform' ||
        value === 'agency' ||
        value === 'account' ||
        value === 'user' ||
        value === 'run'
    ) {
        return value;
    }
    return null;
}

function hydrateModel(row: RawModelRow): ModelDescriptor {
    return {
        id: row.id,
        display_name: row.display_name,
        provider: row.provider,
        invocation_kind: toInvocationKind(row.invocation_kind),
        endpoint_id: row.endpoint_id,
        supports_tools: coerceBool(row.supports_tools),
        supports_streaming: coerceBool(row.supports_streaming),
        supports_vision: coerceBool(row.supports_vision),
        supports_audio_input: coerceBool(row.supports_audio_input),
        supports_json_mode: coerceBool(row.supports_json_mode),
        supports_system_prompt: coerceBool(row.supports_system_prompt),
        supports_thinking: coerceBool(row.supports_thinking),
        max_input_tokens: row.max_input_tokens,
        max_output_tokens: row.max_output_tokens,
        max_image_count: row.max_image_count,
        max_audio_seconds: row.max_audio_seconds,
        input_cost_per_mtok: row.input_cost_per_mtok,
        output_cost_per_mtok: row.output_cost_per_mtok,
        per_request_cost: row.per_request_cost,
        cost_tier:
            row.cost_tier === 'free' ||
            row.cost_tier === 'low' ||
            row.cost_tier === 'mid' ||
            row.cost_tier === 'high' ||
            row.cost_tier === 'premium'
                ? row.cost_tier
                : null,
        latency_class:
            row.latency_class === 'realtime' ||
            row.latency_class === 'fast' ||
            row.latency_class === 'standard' ||
            row.latency_class === 'slow'
                ? row.latency_class
                : null,
        quality_tier: toQualityTier(row.quality_tier),
        default_temperature: row.default_temperature,
        default_reasoning: row.default_reasoning,
        default_max_output: row.default_max_output,
        native_hints: parseNativeHints(row.native_hints),
        tags: parseJsonArray<string>(row.tags),
        use_cases: parseJsonArray<string>(row.use_cases),
        verification: toVerification(row.verification),
        status: toStatus(row.status),
        scope_kind: toScopeKind(row.scope_kind),
        scope_id: row.scope_id,
        fallback_model_id: row.fallback_model_id,
        replaces_model_id: row.replaces_model_id,
    };
}

function capabilityBitmask(row: ModelDescriptor): number {
    let mask = 0;
    if (row.supports_tools) mask |= CAPABILITY_BITS.tools;
    if (row.supports_streaming) mask |= CAPABILITY_BITS.streaming;
    if (row.supports_vision) mask |= CAPABILITY_BITS.vision;
    if (row.supports_audio_input) mask |= CAPABILITY_BITS.audioInput;
    if (row.supports_json_mode) mask |= CAPABILITY_BITS.jsonMode;
    if (row.supports_system_prompt) mask |= CAPABILITY_BITS.systemPrompt;
    if (row.supports_thinking) mask |= CAPABILITY_BITS.thinking;
    return mask;
}

/**
 * Rank eligible models: verified > non-deprecated > higher quality tier.
 * Higher score wins. Used for fallback picks and leaf rule ordering.
 */
function modelScore(m: ModelDescriptor): number {
    const verificationScore = VERIFICATION_RANK[m.verification] * 100;
    const notDeprecated = m.status !== 'deprecated' && m.status !== 'disabled' ? 10 : 0;
    const qualityScore = m.quality_tier !== null ? QUALITY_TIER_RANK[m.quality_tier] : -1;
    return verificationScore + notDeprecated + qualityScore;
}

export class ModelRoutingController extends BaseController {
    static logger = createLogger('ModelRoutingController');

    /**
     * POST /api/model-routing/compile-bundle?revision=...
     *
     * Compiles models + transformers + custom endpoints into the §2.9.1 bundle.
     * All reads happen through a single `db.batch(...)` so the snapshot is
     * consistent (D1 gives batched reads a consistent view — see the D1 docs
     * on the `batch()` method).
     */
    static async compileBundle(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        _context: RouteContext,
    ): Promise<ControllerResponse<ApiResponse<CompiledBundle>>> {
        try {
            const url = new URL(request.url);
            const rawRevision = url.searchParams.get('revision');

            const db = env.DB;

            // Atomic snapshot of all three tables via db.batch.
            const [modelsResult, customEndpointsResult, demandTransformersResult, revisionResult] =
                await db.batch<RawModelRow | RawCustomEndpointRow | RawDemandTransformerRow | RevisionRow>([
                    db.prepare('SELECT * FROM models'),
                    db.prepare('SELECT * FROM custom_endpoints'),
                    db.prepare(
                        "SELECT * FROM demand_transformers WHERE status = 'active' OR status IS NULL",
                    ),
                    db.prepare('SELECT revision FROM model_config_global_revision LIMIT 1'),
                ]);

            const modelRows = modelsResult.results as RawModelRow[];
            const customEndpointRows = customEndpointsResult.results as RawCustomEndpointRow[];
            const demandTransformerRows =
                demandTransformersResult.results as RawDemandTransformerRow[];
            const revisionRows = revisionResult.results as RevisionRow[];

            // Determine revision. If a caller passed ?revision=, we validate it's numeric
            // and use it as-is; otherwise we read from the global revision table.
            let revision: number;
            if (rawRevision !== null) {
                const parsed = parseInt(rawRevision, 10);
                if (Number.isNaN(parsed)) {
                    return ModelRoutingController.createErrorResponse(
                        'Invalid revision query parameter',
                        400,
                    );
                }
                revision = parsed;
            } else {
                revision = revisionRows[0]?.revision ?? 0;
            }

            // Hydrate models
            const models: Record<string, ModelDescriptor> = {};
            for (const row of modelRows) {
                models[row.id] = hydrateModel(row);
            }

            // Hydrate custom endpoints — filter out deprecated/unknown statuses.
            // `custom_endpoints` has no status column per §2.7.1, so this just filters
            // by scope kind being a known value.
            const customEndpoints: Record<string, CustomEndpointDescriptor> = {};
            for (const row of customEndpointRows) {
                const scopeKind = toScopeKind(row.scope_kind);
                if (scopeKind === null) {
                    ModelRoutingController.logger.warn(
                        `Skipping custom_endpoint ${row.id}: invalid scope_kind ${row.scope_kind}`,
                    );
                    continue;
                }
                customEndpoints[row.id] = {
                    id: row.id,
                    scope_kind: scopeKind,
                    scope_id: row.scope_id,
                    name: row.name,
                    provider_kind: row.provider_kind,
                    base_url: row.base_url,
                    headers:
                        (parseJsonObject(row.headers) as Record<string, string> | null) ?? null,
                    auth_ref: row.auth_ref,
                };
            }

            // Fallback computation: pick the best-scored non-deprecated row per kind.
            const byKind: Record<InvocationKind, ModelDescriptor[]> = {
                text: [],
                image: [],
                audio: [],
                video: [],
                embedding: [],
            };
            for (const m of Object.values(models)) {
                byKind[m.invocation_kind].push(m);
            }

            const walkFallbackChain = (startId: string, visited: Set<string> = new Set()): string | null => {
                if (visited.has(startId)) return null;
                const m = models[startId];
                if (!m) return null;
                if (m.status === 'disabled' || m.status === 'deprecated') {
                    if (m.fallback_model_id) {
                        const next = new Set(visited);
                        next.add(startId);
                        return walkFallbackChain(m.fallback_model_id, next);
                    }
                    return null;
                }
                return startId;
            };

            const pickFallback = (kind: InvocationKind): string | null => {
                const pool = byKind[kind].slice().sort((a, b) => modelScore(b) - modelScore(a));
                for (const m of pool) {
                    const resolved = walkFallbackChain(m.id);
                    if (resolved !== null) return resolved;
                }
                return null;
            };

            const fallbacks: Fallbacks = {
                text: pickFallback('text'),
                image: pickFallback('image'),
                audio: pickFallback('audio'),
                video: pickFallback('video'),
            };

            // Rules: one rule per model, scoped. Rule IDs are stable `r_<modelId>` strings.
            const rules: Record<string, Rule> = {};
            for (const m of Object.values(models)) {
                if (m.status === 'disabled' || m.status === 'deprecated') continue;
                const ruleId = `r_${m.id}`;
                rules[ruleId] = {
                    id: ruleId,
                    scope: m.scope_kind ?? 'platform',
                    scopeId: m.scope_id,
                    priority: QUALITY_TIER_RANK[m.quality_tier ?? 'draft'],
                    modelId: m.id,
                    paramsOverride: {
                        temperature: m.default_temperature ?? undefined,
                        maxOutputTokens: m.default_max_output ?? undefined,
                    },
                    capabilityBitmask: capabilityBitmask(m),
                    minQuality: qualityToBucket(m.quality_tier),
                };
            }

            // Hot paths: one composite-key entry per (agentKey × kind × quality × cost × capBitmask × entitlement).
            // For Phase 1.5a we emit one entry per agent per qualityBucket seeded from the best matching model.
            const hotPaths: Record<string, HotPathEntry> = {};
            for (const agentKey of AGENT_HOT_PATH_KEYS) {
                const kind = AGENT_KIND_MAP[agentKey];
                const candidatePool = byKind[kind]
                    .slice()
                    .filter((m) => m.status !== 'disabled' && m.status !== 'deprecated')
                    .sort((a, b) => modelScore(b) - modelScore(a));

                for (const bucket of ['low', 'mid', 'high', 'flagship'] as QualityBucket[]) {
                    const winner = candidatePool.find(
                        (m) => qualityToBucket(m.quality_tier) === bucket,
                    ) ?? candidatePool[0];
                    if (!winner) continue;
                    const costBucket = winner.cost_tier ?? 'mid';
                    const capBitmask = capabilityBitmask(winner);
                    // Composite key per §2.9.1: agentKey|kind|qualityBucket|costBucket|capBitmask|entitlement
                    const key = `${agentKey}|${kind}|${bucket}|${costBucket}|${capBitmask}|*`;
                    const paramsOverride: ParamsOverride = {};
                    if (winner.default_temperature !== null) {
                        paramsOverride.temperature = winner.default_temperature;
                    }
                    if (winner.default_max_output !== null) {
                        paramsOverride.maxOutputTokens = winner.default_max_output;
                    }
                    hotPaths[key] = {
                        modelId: winner.id,
                        paramsOverride,
                    };
                }
            }

            // Decision tree per §2.9.5: kind → capability bitmask → quality bucket → sorted rule refs.
            const buildLeaf = (kind: InvocationKind, bucket: QualityBucket): DecisionTreeLeaf => {
                const eligible = Object.values(rules).filter((r) => {
                    const model = models[r.modelId];
                    return (
                        model.invocation_kind === kind &&
                        QUALITY_TIER_RANK[model.quality_tier ?? 'draft'] >=
                            QUALITY_TIER_RANK[bucketToTier(bucket)]
                    );
                });
                eligible.sort((a, b) => b.priority - a.priority);
                return {
                    type: 'leaf',
                    ruleRefs: eligible.map((r) => r.id),
                };
            };

            const bucketToTier = (b: QualityBucket): QualityTier => {
                switch (b) {
                    case 'low':
                        return 'draft';
                    case 'mid':
                        return 'standard';
                    case 'high':
                        return 'pro';
                    case 'flagship':
                        return 'flagship';
                }
            };

            const buildQualityBranch = (kind: InvocationKind): DecisionTreeQualitySplit => ({
                type: 'quality',
                branches: {
                    low: buildLeaf(kind, 'low'),
                    mid: buildLeaf(kind, 'mid'),
                    high: buildLeaf(kind, 'high'),
                    flagship: buildLeaf(kind, 'flagship'),
                },
            });

            // For each kind, gather the set of distinct capability bitmasks in play and
            // build one branch per bitmask. Keeps the tree as narrow as the catalog
            // actually needs.
            const buildCapabilityBranch = (kind: InvocationKind): DecisionTreeCapabilitySplit => {
                const masks = new Set<number>();
                for (const m of byKind[kind]) {
                    masks.add(capabilityBitmask(m));
                }
                // Always include 0 so a demand with no capability requirements has a branch.
                masks.add(0);
                const branches: Record<string, DecisionTreeNode> = {};
                for (const mask of masks) {
                    branches[String(mask)] = buildQualityBranch(kind);
                }
                return {
                    type: 'capability',
                    branches,
                };
            };

            const decisionTree: DecisionTreeKindSplit = {
                type: 'kind',
                branches: {
                    text: buildCapabilityBranch('text'),
                    image: buildCapabilityBranch('image'),
                    audio: buildCapabilityBranch('audio'),
                    video: buildCapabilityBranch('video'),
                    embedding: buildCapabilityBranch('embedding'),
                },
            };

            // Precomposed transformer chains: per-user flattened with
            // platform < agency < account < user < run precedence. `locked: true`
            // entries at lower scopes are preserved verbatim.
            const precomposedTransformerChains = this.flattenTransformers(demandTransformerRows);

            const bundle: CompiledBundle = {
                revision,
                generatedAt: new Date().toISOString(),
                hotPaths,
                decisionTree,
                rules,
                models,
                customEndpoints,
                fallbacks,
                precomposedTransformerChains,
            };

            return ModelRoutingController.createSuccessResponse(bundle);
        } catch (error) {
            this.logger.error('Error compiling bundle:', error);
            return ModelRoutingController.createErrorResponse('Failed to compile bundle', 500);
        }
    }

    /**
     * Flatten demand-transformer rows into per-user chains honoring the fixed
     * precedence platform < agency < account < user < run.
     *
     * For Phase 1.5a we key by the transformer's own scope_id when scope is
     * `user`; platform/agency/account transformers apply to everyone and are
     * merged in precedence order under a wildcard `*` key. Runtime resolvers
     * merge `*` with the caller's user-specific chain.
     */
    private static flattenTransformers(
        rows: RawDemandTransformerRow[],
    ): Record<string, PrecomposedChainEntry[]> {
        const scopePriority: Record<ScopeKind, number> = {
            platform: 0,
            agency: 1,
            account: 2,
            user: 3,
            run: 4,
        };

        const byScopeUser: Record<string, PrecomposedChainEntry[]> = {};
        const platformAgencyAccount: PrecomposedChainEntry[] = [];

        const sorted = rows
            .slice()
            .sort((a, b) => {
                const aKind = toScopeKind(a.scope_kind);
                const bKind = toScopeKind(b.scope_kind);
                if (aKind === null || bKind === null) return 0;
                const scopeDiff = scopePriority[aKind] - scopePriority[bKind];
                if (scopeDiff !== 0) return scopeDiff;
                return a.priority - b.priority;
            });

        for (const row of sorted) {
            const scopeKind = toScopeKind(row.scope_kind);
            if (scopeKind === null) continue;
            const transformers = parseJsonArray<Transformer>(row.transformers) ?? [];
            const entries: PrecomposedChainEntry[] = transformers.map((t) => ({
                transformer: t,
                sourceScope: scopeKind,
                sourceId: row.scope_id,
                locked: row.locked === 1,
            }));

            if (scopeKind === 'user' && row.scope_id !== null) {
                const key = row.scope_id;
                byScopeUser[key] ??= [];
                byScopeUser[key].push(...entries);
            } else if (scopeKind === 'run') {
                // Per-run transformers are not precomposable — runtime applies them.
                continue;
            } else {
                platformAgencyAccount.push(...entries);
            }
        }

        // Compose: each user chain starts with platform/agency/account entries, then
        // its own user-specific entries. Locked entries at lower scopes must not be
        // overridden — the runtime resolver checks `locked` when applying later ops.
        const result: Record<string, PrecomposedChainEntry[]> = {
            '*': platformAgencyAccount,
        };
        for (const [userId, userEntries] of Object.entries(byScopeUser)) {
            result[userId] = [...platformAgencyAccount, ...userEntries];
        }
        return result;
    }

    /**
     * GET /api/model-routing/revision
     */
    static async getRevision(
        _request: Request,
        env: Env,
        _ctx: ExecutionContext,
        _context: RouteContext,
    ): Promise<ControllerResponse<ApiResponse<{ revision: number }>>> {
        try {
            const db = env.DB;
            const revResult = await db
                .prepare('SELECT revision FROM model_config_global_revision LIMIT 1')
                .first<RevisionRow>();

            return ModelRoutingController.createSuccessResponse({
                revision: revResult?.revision ?? 0,
            });
        } catch (error) {
            this.logger.error('Error getting routing revision:', error);
            return ModelRoutingController.createErrorResponse('Failed to get revision', 500);
        }
    }
}
