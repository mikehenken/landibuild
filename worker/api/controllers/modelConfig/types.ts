/**
 * Type definitions for ModelConfig Controller responses
 */

import type { UserModelConfigWithMetadata, ModelTestResult } from '../../../database/types';
import type { AgentActionKey, ModelConfig, AIModels } from '../../../agents/inferutils/config.types';

export interface UserProviderStatus {
  provider: string;
  hasValidKey: boolean;
  keyPreview?: string;
}

export interface ModelsByProvider {
  [provider: string]: AIModels[];
}
import { UserModelConfig } from '../../../database/schema';

/**
 * Response data for getModelConfigs
 */
export interface ModelConfigsData {
    configs: Record<AgentActionKey, UserModelConfigWithMetadata>;
    defaults: Record<AgentActionKey, ModelConfig>;
    message: string;
}

/**
 * Response data for getModelConfig
 */
export interface ModelConfigData {
    config: UserModelConfigWithMetadata;
    defaultConfig: ModelConfig;
    message: string;
}

/**
 * Response data for updateModelConfig
 */
export interface ModelConfigUpdateData {
    config: UserModelConfig;
    message: string;
}

/**
 * Response data for testModelConfig
 */
export interface ModelConfigTestData {
    testResult: ModelTestResult;
    message: string;
}

/**
 * Response data for resetAllConfigs
 */
export interface ModelConfigResetData {
    resetCount: number;
    message: string;
}

/**
 * Response data for getDefaults
 */
export interface ModelConfigDefaultsData {
    defaults: Record<AgentActionKey, ModelConfig>;
    message: string;
}

/**
 * Response data for deleteModelConfig
 */
export interface ModelConfigDeleteData {
    message: string;
}

/**
 * Response data for getByokProviders
 */
export interface ByokProvidersData {
    providers: UserProviderStatus[];
    modelsByProvider: ModelsByProvider;
    platformModels: AIModels[];
}

/** User-scoped named model config bundles */
export interface ModelConfigPresetSummary {
    id: string;
    name: string;
    description: string | null;
    agentActionCount: number;
    createdAt: string;
    updatedAt: string;
    /** Shipping bundles from code (`builtin:…`); not persisted per user. */
    isBuiltIn?: boolean;
}

export interface ModelConfigPresetsListData {
    presets: ModelConfigPresetSummary[];
    message: string;
}

export interface ModelConfigPresetMutationData {
    preset: ModelConfigPresetSummary;
    message: string;
}

export interface ModelConfigPresetApplyData {
    appliedAgentActions: AgentActionKey[];
    message: string;
}

export interface ModelConfigPresetDeleteData {
    message: string;
}