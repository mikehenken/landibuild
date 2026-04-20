/**
 * Types for the compiled routing bundle (§2.9.1).
 *
 * These mirror the plan's discriminated contracts exactly. No `any`, no `unknown`
 * dodges — every field is typed because downstream routers and the Nas
 * orchestrator consume this shape.
 */

import type { NativeHints } from '../../../database/types/nativeHints';

export type InvocationKind = 'text' | 'image' | 'audio' | 'video' | 'embedding';
export type QualityTier = 'draft' | 'standard' | 'pro' | 'flagship';
export type CostTier = 'free' | 'low' | 'mid' | 'high' | 'premium';
export type LatencyClass = 'realtime' | 'fast' | 'standard' | 'slow';
export type Verification = 'verified' | 'self-declared' | 'unverified';
export type ModelStatus = 'active' | 'deprecated' | 'experimental' | 'disabled';
export type ScopeKind = 'platform' | 'agency' | 'account' | 'user' | 'run';

/**
 * Quality bucket used for decision-tree splits. A coarser grouping than
 * the catalog's `QualityTier` so that the cold-path tree stays small.
 */
export type QualityBucket = 'low' | 'mid' | 'high' | 'flagship';

/**
 * Model descriptor as stored in the compiled bundle.
 * Values are nullable to match the sparse-metadata semantics of §2.7.2.
 */
export interface ModelDescriptor {
    id: string;
    display_name: string;
    provider: string;
    invocation_kind: InvocationKind;
    endpoint_id: string | null;

    supports_tools: boolean | null;
    supports_streaming: boolean | null;
    supports_vision: boolean | null;
    supports_audio_input: boolean | null;
    supports_json_mode: boolean | null;
    supports_system_prompt: boolean | null;
    supports_thinking: boolean | null;

    max_input_tokens: number | null;
    max_output_tokens: number | null;
    max_image_count: number | null;
    max_audio_seconds: number | null;

    input_cost_per_mtok: number | null;
    output_cost_per_mtok: number | null;
    per_request_cost: number | null;
    cost_tier: CostTier | null;

    latency_class: LatencyClass | null;
    quality_tier: QualityTier | null;

    default_temperature: number | null;
    default_reasoning: string | null;
    default_max_output: number | null;

    native_hints: NativeHints | null;

    tags: string[] | null;
    use_cases: string[] | null;

    verification: Verification;
    status: ModelStatus | null;
    scope_kind: ScopeKind | null;
    scope_id: string | null;

    fallback_model_id: string | null;
    replaces_model_id: string | null;
}

/**
 * Hot-path entry — one row of the pre-computed cartesian lookup map.
 * See §2.9.1 for the composite key shape.
 */
export interface HotPathEntry {
    modelId: string;
    paramsOverride: ParamsOverride;
}

/**
 * Sampling / invocation parameters that get merged onto the base ModelConfig
 * before a request reaches the adapter. Kept narrow — no arbitrary fields.
 */
export interface ParamsOverride {
    temperature?: number;
    maxOutputTokens?: number;
    reasoningEffort?: 'low' | 'medium' | 'high';
}

/**
 * Decision-tree nodes per §2.9.5: split on `kind`, then capability bitmask,
 * then quality bucket, arriving at an ordered list of rule refs.
 */
export type DecisionTreeNode =
    | DecisionTreeKindSplit
    | DecisionTreeCapabilitySplit
    | DecisionTreeQualitySplit
    | DecisionTreeLeaf;

export interface DecisionTreeKindSplit {
    type: 'kind';
    branches: Record<InvocationKind, DecisionTreeNode>;
}

export interface DecisionTreeCapabilitySplit {
    type: 'capability';
    /** Keyed by decimal string of the required capability bitmask. */
    branches: Record<string, DecisionTreeNode>;
}

export interface DecisionTreeQualitySplit {
    type: 'quality';
    branches: Record<QualityBucket, DecisionTreeNode>;
}

export interface DecisionTreeLeaf {
    type: 'leaf';
    /** Ordered rule refs. First match wins. */
    ruleRefs: string[];
}

/**
 * A routing rule — referenced from the decision tree leaves.
 * Predicates are enum / int / bitmask comparisons only (§2.9.5).
 */
export interface Rule {
    id: string;
    scope: ScopeKind;
    scopeId: string | null;
    priority: number;
    /** Resolved to a model ID when this rule fires. */
    modelId: string;
    paramsOverride: ParamsOverride;
    /** Bitmask of required capabilities (bit layout documented in compile-bundle). */
    capabilityBitmask: number;
    /** Minimum quality bucket required. */
    minQuality: QualityBucket;
}

/**
 * A single transformer operation — mutates the resolved config.
 */
export interface Transformer {
    op: 'set-model' | 'force-model' | 'cap-quality' | 'set-param' | 'require-capability';
    target?: string;
    value?: string | number | boolean;
    /** If set, a predicate gating when this transformer applies. */
    appliesTo?: TransformerPredicate;
}

export interface TransformerPredicate {
    kind?: InvocationKind;
    agentKey?: string;
    /** Whitelist of purposes — opt-in, not required. */
    purposeAllowlist?: string[];
}

/**
 * A pre-composed transformer chain for one user, flattened from
 * platform → agency → account → user → run precedence.
 */
export interface PrecomposedChainEntry {
    transformer: Transformer;
    sourceScope: ScopeKind;
    sourceId: string | null;
    locked: boolean;
}

/**
 * Custom endpoint descriptor inside the bundle. Secrets stay as `authRef`;
 * actual tokens never appear here.
 */
export interface CustomEndpointDescriptor {
    id: string;
    scope_kind: ScopeKind;
    scope_id: string | null;
    name: string;
    provider_kind: string;
    base_url: string;
    headers: Record<string, string> | null;
    auth_ref: string | null;
}

export interface Fallbacks {
    text: string | null;
    image: string | null;
    audio: string | null;
    video: string | null;
}

/**
 * The top-level compiled bundle shape. One JSON object per revision.
 */
export interface CompiledBundle {
    revision: number;
    generatedAt: string;
    hotPaths: Record<string, HotPathEntry>;
    decisionTree: DecisionTreeNode;
    rules: Record<string, Rule>;
    models: Record<string, ModelDescriptor>;
    customEndpoints: Record<string, CustomEndpointDescriptor>;
    fallbacks: Fallbacks;
    precomposedTransformerChains: Record<string, PrecomposedChainEntry[]>;
}

/**
 * Raw row shape returned from the `models` table (D1 reads everything as strings
 * for TEXT columns and numbers for INTEGER/REAL; JSON columns arrive as strings
 * that need parsing).
 */
export interface RawModelRow {
    id: string;
    display_name: string;
    provider: string;
    invocation_kind: string;
    endpoint_id: string | null;

    supports_tools: number | null;
    supports_streaming: number | null;
    supports_vision: number | null;
    supports_audio_input: number | null;
    supports_json_mode: number | null;
    supports_system_prompt: number | null;
    supports_thinking: number | null;

    max_input_tokens: number | null;
    max_output_tokens: number | null;
    max_image_count: number | null;
    max_audio_seconds: number | null;

    input_cost_per_mtok: number | null;
    output_cost_per_mtok: number | null;
    per_request_cost: number | null;
    cost_tier: string | null;

    latency_class: string | null;
    quality_tier: string | null;

    default_temperature: number | null;
    default_reasoning: string | null;
    default_max_output: number | null;

    native_hints: string | null;
    tags: string | null;
    use_cases: string | null;

    verification: string;
    status: string | null;
    scope_kind: string | null;
    scope_id: string | null;

    fallback_model_id: string | null;
    replaces_model_id: string | null;

    created_at: number | null;
    updated_at: number | null;
    deprecated_at: number | null;
}

export interface RawCustomEndpointRow {
    id: string;
    scope_kind: string;
    scope_id: string | null;
    name: string;
    provider_kind: string;
    base_url: string;
    headers: string | null;
    auth_ref: string | null;
    created_at: number | null;
}

export interface RawDemandTransformerRow {
    id: string;
    scope_kind: string;
    scope_id: string | null;
    priority: number;
    locked: number;
    transformers: string;
    applies_when: string | null;
    ttl_expires_at: number | null;
    status: string;
    created_at: number | null;
}

/**
 * Capability bit layout. Keep this close to the compiler so there's a single
 * source of truth.
 */
export const CAPABILITY_BITS = {
    tools: 1 << 0,
    streaming: 1 << 1,
    vision: 1 << 2,
    audioInput: 1 << 3,
    jsonMode: 1 << 4,
    systemPrompt: 1 << 5,
    thinking: 1 << 6,
} as const;
