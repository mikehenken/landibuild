/**
 * Model Configuration Controller
 * Handles CRUD operations for user model configurations
 */

import { BaseController } from '../baseController';
import { RouteContext } from '../../types/route-context';
import { ApiResponse, ControllerResponse } from '../types';
import { ModelConfigService } from '../../../database/services/ModelConfigService';
import { ModelTestService } from '../../../database/services/ModelTestService';
import {
    AgentActionKey,
    ModelConfig,
    AIModels
} from '../../../agents/inferutils/config.types';
import { AGENT_CONFIG } from '../../../agents/inferutils/config';
import {
    ModelConfigsData,
    ModelConfigData,
    ModelConfigUpdateData,
    ModelConfigTestData,
    ModelConfigResetData,
    ModelConfigDefaultsData,
    ModelConfigDeleteData,
    ByokProvidersData,
    ModelConfigPresetsListData,
    ModelConfigPresetSummary,
    ModelConfigPresetMutationData,
    ModelConfigPresetApplyData,
    ModelConfigPresetDeleteData,
} from './types';
import type { PresetConfigsMap } from '../../../agents/inferutils/modelConfigPresetMap';
import { ModelConfigPresetService, type PresetAgentEntry } from '../../../database/services/ModelConfigPresetService';
import {
    getBuiltInModelConfigPresetConfigs,
    isBuiltInModelConfigPresetId,
    listBuiltInModelConfigPresetSummaries,
} from '../../../agents/inferutils/builtInModelConfigPresets';
import {
    getUserProviderStatus,
    getByokModels,
    getPlatformAvailableModels,
    validateModelAccessForEnvironment,
    loadByokKeysFromUserVault,
    getAccessProviderFromModelId,
} from './byokHelper';
import { z } from 'zod';
import { createLogger } from '../../../logger';
import { getFilteredModelsForAgent } from './constraintHelper';

// Validation schemas
const modelConfigUpdateSchema = z.object({
    modelName: z.string().min(1).max(100).nullable().optional(),
    maxTokens: z.number().min(1).max(200000).nullable().optional(),
    temperature: z.number().min(0).max(2).nullable().optional(),
    reasoningEffort: z.enum(['low', 'medium', 'high']).nullable().optional(),
    providerOverride: z.enum(['cloudflare', 'direct']).nullable().optional(),
    fallbackModel: z.string().min(1).max(100).nullable().optional(),
    isUserOverride: z.boolean().optional()
});

const modelTestSchema = z.object({
    agentActionName: z.string(),
    testPrompt: z.string().optional(),
    useUserKeys: z.boolean().default(true),
    tempConfig: modelConfigUpdateSchema.optional()
});

const createPresetFromCurrentSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().nullable(),
});

export class ModelConfigController extends BaseController {
    static logger = createLogger('ModelConfigController');

    private static buildFullModelConfigForPresetApply(
        agentAction: AgentActionKey,
        entry: PresetAgentEntry,
    ): Partial<ModelConfig> {
        const d = AGENT_CONFIG[agentAction];
        return {
            name:
                entry.modelName !== undefined && entry.modelName !== null && entry.modelName !== ''
                    ? entry.modelName
                    : d.name,
            max_tokens:
                entry.maxTokens !== undefined && entry.maxTokens !== null ? entry.maxTokens : d.max_tokens,
            temperature:
                entry.temperature !== undefined && entry.temperature !== null ? entry.temperature : d.temperature,
            reasoning_effort:
                entry.reasoningEffort !== undefined && entry.reasoningEffort !== null
                    ? (entry.reasoningEffort as ModelConfig['reasoning_effort'])
                    : d.reasoning_effort,
            fallbackModel:
                entry.fallbackModel !== undefined &&
                entry.fallbackModel !== null &&
                entry.fallbackModel !== ''
                    ? entry.fallbackModel
                    : d.fallbackModel,
        };
    }
    /**
     * Get all model configurations for the current user
     * GET /api/model-configs
     */
    static async getModelConfigs(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelConfigsData>>> {
        try {
            const user = context.user!;
            const modelConfigService = new ModelConfigService(env);
            const configs = await modelConfigService.getUserModelConfigs(user.id);
            const defaults = modelConfigService.getDefaultConfigs();

            const responseData: ModelConfigsData = {
                configs,
                defaults,
                message: 'Model configurations retrieved successfully'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error getting model configurations:', error);
            return ModelConfigController.createErrorResponse<ModelConfigsData>('Failed to get model configurations', 500);
        }
    }

    /**
     * Get a specific model configuration
     * GET /api/model-configs/:agentAction
     */
    static async getModelConfig(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelConfigData>>> {
        try {
            const user = context.user!;

            const url = new URL(request.url);
            const agentAction = url.pathname.split('/').pop() as AgentActionKey;

            if (!agentAction || !(agentAction in AGENT_CONFIG)) {
                return ModelConfigController.createErrorResponse<ModelConfigData>('Invalid agent action name', 400);
            }
            const modelConfigService = new ModelConfigService(env);

            const config = await modelConfigService.getUserModelConfig(user.id, agentAction);
            const defaultConfig = modelConfigService.getDefaultConfigs()[agentAction];

            const responseData: ModelConfigData = {
                config,
                defaultConfig,
                message: 'Model configuration retrieved successfully'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error getting model configuration:', error);
            return ModelConfigController.createErrorResponse<ModelConfigData>('Failed to get model configuration', 500);
        }
    }

    /**
     * Update a specific model configuration
     * PUT /api/model-configs/:agentAction
     */
    static async updateModelConfig(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelConfigUpdateData>>> {
        try {
            const user = context.user!;

            const url = new URL(request.url);
            const agentAction = url.pathname.split('/').pop() as AgentActionKey;

            if (!agentAction || !(agentAction in AGENT_CONFIG)) {
                return ModelConfigController.createErrorResponse<ModelConfigUpdateData>('Invalid agent action name', 400);
            }

            const bodyResult = await ModelConfigController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ModelConfigUpdateData>>;
            }

            const validatedData = modelConfigUpdateSchema.parse(bodyResult.data);

            // Convert to ModelConfig format - only include non-null values
            const modelConfig: Partial<ModelConfig> = {};
            
            if (validatedData.modelName !== null && validatedData.modelName !== undefined) {
                modelConfig.name = validatedData.modelName;
            }
            if (validatedData.maxTokens !== null && validatedData.maxTokens !== undefined) {
                modelConfig.max_tokens = validatedData.maxTokens;
            }
            if (validatedData.temperature !== null && validatedData.temperature !== undefined) {
                modelConfig.temperature = validatedData.temperature;
            }
            if (validatedData.reasoningEffort !== null && validatedData.reasoningEffort !== undefined) {
                modelConfig.reasoning_effort = validatedData.reasoningEffort;
            }
            if (validatedData.fallbackModel !== null && validatedData.fallbackModel !== undefined) {
                modelConfig.fallbackModel = validatedData.fallbackModel;
            }

            // Validate model access based on environment configuration and user BYOK status
            if (modelConfig.name || modelConfig.fallbackModel) {
                const userProviderStatus = await getUserProviderStatus(user.id, env);
                
                // Validate primary model
                if (modelConfig.name) {
                    const isValidAccess = validateModelAccessForEnvironment(
                        modelConfig.name, 
                        env, 
                        userProviderStatus
                    );
                    
                    if (!isValidAccess) {
                        const provider = getAccessProviderFromModelId(modelConfig.name);
                        return ModelConfigController.createErrorResponse<ModelConfigUpdateData>(
                            `Model requires API key for provider '${provider}'. Please add your API key in the BYOK settings or contact your platform administrator.`,
                            403
                        );
                    }
                }

                // Validate fallback model
                if (modelConfig.fallbackModel) {
                    const isValidAccess = validateModelAccessForEnvironment(
                        modelConfig.fallbackModel,
                        env,
                        userProviderStatus
                    );
                    
                    if (!isValidAccess) {
                        const provider = getAccessProviderFromModelId(modelConfig.fallbackModel);
                        return ModelConfigController.createErrorResponse<ModelConfigUpdateData>(
                            `Fallback model requires API key for provider '${provider}'. Please add your API key in the BYOK settings or contact your platform administrator.`,
                            403
                        );
                    }
                }
            }

            if (!modelConfig.name) {
                return ModelConfigController.createErrorResponse<ModelConfigUpdateData>(
                    'Model name is required',
                    400
                );
            }

            const modelConfigService = new ModelConfigService(env);
            const updatedConfig = await modelConfigService.upsertUserModelConfig(
                user.id,
                agentAction,
                modelConfig
            );

            const responseData: ModelConfigUpdateData = {
                config: updatedConfig,
                message: 'Model configuration updated successfully'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return ModelConfigController.createErrorResponse<ModelConfigUpdateData>('Validation failed: ' + JSON.stringify(error.errors), 400);
            }

            // Handle constraint violations (thrown by service)
            if (error instanceof Error && error.message.includes('not allowed')) {
                return ModelConfigController.createErrorResponse<ModelConfigUpdateData>(error.message, 400);
            }

            this.logger.error('Error updating model configuration:', error);
            return ModelConfigController.createErrorResponse<ModelConfigUpdateData>('Failed to update model configuration', 500);
        }
    }

    /**
     * Delete/reset a model configuration to default
     * DELETE /api/model-configs/:agentAction
     */
    static async deleteModelConfig(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelConfigDeleteData>>> {
        try {
            const user = context.user!;

            const url = new URL(request.url);
            const agentAction = url.pathname.split('/').pop() as AgentActionKey;

            if (!agentAction || !(agentAction in AGENT_CONFIG)) {
                return ModelConfigController.createErrorResponse<ModelConfigDeleteData>('Invalid agent action name', 400);
            }

            const modelConfigService = new ModelConfigService(env);
            const deleted = await modelConfigService.deleteUserModelConfig(user.id, agentAction);

            if (!deleted) {
                return ModelConfigController.createErrorResponse<ModelConfigDeleteData>('Configuration not found or already using defaults', 404);
            }

            const responseData: ModelConfigDeleteData = {
                message: 'Model configuration reset to default successfully'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error deleting model configuration:', error);
            return ModelConfigController.createErrorResponse<ModelConfigDeleteData>('Failed to delete model configuration', 500);
        }
    }

    /**
     * Test a model configuration
     * POST /api/model-configs/test
     */
    static async testModelConfig(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelConfigTestData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelConfigController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ModelConfigTestData>>;
            }

            const validatedData = modelTestSchema.parse(bodyResult.data);
            const agentAction = validatedData.agentActionName as AgentActionKey;

            if (!(agentAction in AGENT_CONFIG)) {
                return ModelConfigController.createErrorResponse<ModelConfigTestData>('Invalid agent action name', 400);
            }

            const modelConfigService = new ModelConfigService(env);
            const modelTestService = new ModelTestService(env);

            // Get base configuration and merge with temporary changes if provided
            const baseConfig = await modelConfigService.getUserModelConfig(user.id, agentAction);
            
            const configToTest: ModelConfig = validatedData.tempConfig ? {
                ...baseConfig,
                // Map frontend field names to backend config structure
                ...(validatedData.tempConfig.modelName != null && { name: validatedData.tempConfig.modelName }),
                ...(validatedData.tempConfig.maxTokens != null && { max_tokens: validatedData.tempConfig.maxTokens }),
                ...(validatedData.tempConfig.temperature != null && { temperature: validatedData.tempConfig.temperature }),
                ...(validatedData.tempConfig.reasoningEffort != null && { reasoning_effort: validatedData.tempConfig.reasoningEffort }),
                ...(validatedData.tempConfig.fallbackModel != null && { fallbackModel: validatedData.tempConfig.fallbackModel }),
                ...(validatedData.tempConfig.providerOverride != null && { providerOverride: validatedData.tempConfig.providerOverride })
            } : baseConfig;

			let userApiKeys: Record<string, string> | undefined = undefined;
			if (validatedData.useUserKeys) {
				const fromVault = await loadByokKeysFromUserVault(env, user.id);
				if (Object.keys(fromVault).length > 0) {
					userApiKeys = fromVault;
				}
			}

            // Test the configuration
            const testResult = await modelTestService.testModelConfig({
                modelConfig: configToTest,
                userApiKeys,
                testPrompt: validatedData.testPrompt,
				userId: user.id,
            });

            const responseData: ModelConfigTestData = {
                testResult,
                message: testResult.success 
                    ? 'Model configuration test successful' 
                    : 'Model configuration test failed'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return ModelConfigController.createErrorResponse<ModelConfigTestData>('Validation failed: ' + JSON.stringify(error.errors), 400);
            }
            this.logger.error('Error testing model configuration:', error);
            return ModelConfigController.createErrorResponse<ModelConfigTestData>('Failed to test model configuration', 500);
        }
    }

    /**
     * Reset all model configurations to defaults
     * POST /api/model-configs/reset-all
     */
    static async resetAllConfigs(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelConfigResetData>>> {
        try {
            const user = context.user!;

            const modelConfigService = new ModelConfigService(env);
            const resetCount = await modelConfigService.resetAllUserConfigs(user.id);

            const responseData: ModelConfigResetData = {
                resetCount,
                message: `${resetCount} model configurations reset to defaults`
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error resetting all model configurations:', error);
            return ModelConfigController.createErrorResponse<ModelConfigResetData>('Failed to reset model configurations', 500);
        }
    }

    /**
     * Get default configurations
     * GET /api/model-configs/defaults
     */
    static async getDefaults(_request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<ModelConfigDefaultsData>>> {
        try {
            const modelConfigService = new ModelConfigService(env);
            const defaults = modelConfigService.getDefaultConfigs();
            
            const responseData: ModelConfigDefaultsData = {
                defaults,
                message: 'Default configurations retrieved successfully'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error getting default configurations:', error);
            return ModelConfigController.createErrorResponse<ModelConfigDefaultsData>('Failed to get default configurations', 500);
        }
    }

    /**
     * Get BYOK providers and available models
     * GET /api/model-configs/byok-providers?agentAction=<optional>
     *
     * If agentAction is provided, returns only models allowed by that agent's constraints
     */
    static async getByokProviders(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ByokProvidersData>>> {
        try {
            const user = context.user!;

            // Parse and validate optional agentAction query parameter
            const url = new URL(request.url);
            const agentActionParam = url.searchParams.get('agentAction');

            let agentAction: AgentActionKey | null = null;
            const validAgentActions = Object.keys(AGENT_CONFIG) as AgentActionKey[];
            if (agentActionParam && validAgentActions.includes(agentActionParam as AgentActionKey)) {
                agentAction = agentActionParam as AgentActionKey;
            } else if (agentActionParam) {
                return ModelConfigController.createErrorResponse<ByokProvidersData>(
                    `Invalid agentAction: '${agentActionParam}'. Must be one of: ${validAgentActions.join(', ')}`,
                    400
                );
            }

            // Get user's provider status
            const providers = await getUserProviderStatus(user.id, env);

            // Get all accessible models (BYOK + platform)
            const allModelsByProvider = getByokModels(providers);
            const allPlatformModels = getPlatformAvailableModels(env);

            // If agentAction provided, filter models by constraints
            if (agentAction) {
                // Get all accessible models
                const allAccessibleModels = Object.values(allModelsByProvider).flat();
                const combinedModels = [...new Set([...allAccessibleModels, ...allPlatformModels])];

                // Filter based on agent constraints
                const filteredModels = getFilteredModelsForAgent(agentAction, combinedModels);
                const filteredSet = new Set(filteredModels);

                // Filter modelsByProvider
                const filteredModelsByProvider: Record<string, AIModels[]> = {};
                for (const [provider, models] of Object.entries(allModelsByProvider)) {
                    const filtered = models.filter(m => filteredSet.has(m));
                    if (filtered.length > 0) {
                        filteredModelsByProvider[provider] = filtered;
                    }
                }

                // Filter platformModels
                const filteredPlatformModels = allPlatformModels.filter(m => filteredSet.has(m));

                const responseData: ByokProvidersData = {
                    providers,
                    modelsByProvider: filteredModelsByProvider,
                    platformModels: filteredPlatformModels
                };

                return ModelConfigController.createSuccessResponse(responseData);
            }

            // No filtering - return all models
            const responseData: ByokProvidersData = {
                providers,
                modelsByProvider: allModelsByProvider,
                platformModels: allPlatformModels
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error getting BYOK providers:', error);
            return ModelConfigController.createErrorResponse<ByokProvidersData>('Failed to get BYOK providers', 500);
        }
    }

    static async listModelConfigPresets(
        _request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext,
    ): Promise<ControllerResponse<ApiResponse<ModelConfigPresetsListData>>> {
        try {
            const user = context.user!;
            const builtIn = listBuiltInModelConfigPresetSummaries();
            let userPresets: Awaited<ReturnType<ModelConfigPresetService['listPresets']>> = [];
            try {
                const presetService = new ModelConfigPresetService(env);
                userPresets = await presetService.listPresets(user.id);
            } catch (dbError) {
                // Local dev often misses D1 migrations; still return built-ins so Settings does not 500.
                this.logger.error('User model config presets query failed; returning built-ins only', {
                    error: dbError,
                    userId: user.id,
                });
            }
            const presets: ModelConfigPresetSummary[] = [
                ...builtIn,
                ...userPresets.map((p) => ({ ...p, isBuiltIn: false as const })),
            ];
            return ModelConfigController.createSuccessResponse<ModelConfigPresetsListData>({
                presets,
                message: 'Presets retrieved successfully',
            });
        } catch (error) {
            this.logger.error('Error listing model config presets:', error);
            return ModelConfigController.createErrorResponse<ModelConfigPresetsListData>(
                'Failed to list presets',
                500,
            );
        }
    }

    static async createModelConfigPresetFromCurrent(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext,
    ): Promise<ControllerResponse<ApiResponse<ModelConfigPresetMutationData>>> {
        try {
            const user = context.user!;
            const bodyResult = await ModelConfigController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ModelConfigPresetMutationData>>;
            }
            const validated = createPresetFromCurrentSchema.parse(bodyResult.data);
            const presetService = new ModelConfigPresetService(env);
            const detail = await presetService.createFromCurrentOverrides(
                user.id,
                validated.name,
                validated.description ?? null,
            );
            const preset = {
                id: detail.id,
                name: detail.name,
                description: detail.description,
                agentActionCount: detail.agentActionCount,
                createdAt: detail.createdAt,
                updatedAt: detail.updatedAt,
            };
            return ModelConfigController.createSuccessResponse<ModelConfigPresetMutationData>({
                preset,
                message: 'Preset saved from your current overrides',
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return ModelConfigController.createErrorResponse<ModelConfigPresetMutationData>(
                    'Validation failed: ' + JSON.stringify(error.errors),
                    400,
                );
            }
            if (error instanceof Error) {
                if (error.message.includes('UNIQUE constraint') || error.message.includes('unique')) {
                    return ModelConfigController.createErrorResponse<ModelConfigPresetMutationData>(
                        'A preset with this name already exists',
                        409,
                    );
                }
                return ModelConfigController.createErrorResponse<ModelConfigPresetMutationData>(error.message, 400);
            }
            this.logger.error('Error creating model config preset:', error);
            return ModelConfigController.createErrorResponse<ModelConfigPresetMutationData>(
                'Failed to create preset',
                500,
            );
        }
    }

    static async applyModelConfigPreset(
        _request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext,
    ): Promise<ControllerResponse<ApiResponse<ModelConfigPresetApplyData>>> {
        try {
            const user = context.user!;
            const presetId = context.pathParams?.presetId;
            if (!presetId) {
                return ModelConfigController.createErrorResponse<ModelConfigPresetApplyData>(
                    'presetId is required',
                    400,
                );
            }
            const presetService = new ModelConfigPresetService(env);
            let configs: PresetConfigsMap | null = null;
            if (isBuiltInModelConfigPresetId(presetId)) {
                configs = getBuiltInModelConfigPresetConfigs(presetId) ?? null;
            } else {
                const detail = await presetService.getPreset(user.id, presetId);
                configs = detail?.configs ?? null;
            }
            if (!configs) {
                return ModelConfigController.createErrorResponse<ModelConfigPresetApplyData>('Preset not found', 404);
            }

            const userProviderStatus = await getUserProviderStatus(user.id, env);
            const modelConfigService = new ModelConfigService(env);
            const appliedAgentActions: AgentActionKey[] = [];

            for (const agentAction of Object.keys(configs) as AgentActionKey[]) {
                const entry = configs[agentAction];
                if (!entry) continue;
                const full = ModelConfigController.buildFullModelConfigForPresetApply(agentAction, entry);

                if (full.name) {
                    const okPrimary = validateModelAccessForEnvironment(full.name, env, userProviderStatus);
                    if (!okPrimary) {
                        const provider = getAccessProviderFromModelId(full.name);
                        return ModelConfigController.createErrorResponse<ModelConfigPresetApplyData>(
                            `Model requires API key for provider '${provider}' (agent: ${agentAction}).`,
                            403,
                        );
                    }
                }
                if (full.fallbackModel) {
                    const okFb = validateModelAccessForEnvironment(full.fallbackModel, env, userProviderStatus);
                    if (!okFb) {
                        const provider = getAccessProviderFromModelId(full.fallbackModel);
                        return ModelConfigController.createErrorResponse<ModelConfigPresetApplyData>(
                            `Fallback model requires API key for provider '${provider}' (agent: ${agentAction}).`,
                            403,
                        );
                    }
                }

                await modelConfigService.upsertUserModelConfig(user.id, agentAction, full);
                appliedAgentActions.push(agentAction);
            }

            return ModelConfigController.createSuccessResponse<ModelConfigPresetApplyData>({
                appliedAgentActions,
                message:
                    appliedAgentActions.length > 0
                        ? `Applied preset to ${appliedAgentActions.length} agent configuration(s)`
                        : 'No changes applied',
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes('not allowed')) {
                return ModelConfigController.createErrorResponse<ModelConfigPresetApplyData>(error.message, 400);
            }
            this.logger.error('Error applying model config preset:', error);
            return ModelConfigController.createErrorResponse<ModelConfigPresetApplyData>(
                'Failed to apply preset',
                500,
            );
        }
    }

    static async deleteModelConfigPreset(
        _request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext,
    ): Promise<ControllerResponse<ApiResponse<ModelConfigPresetDeleteData>>> {
        try {
            const user = context.user!;
            const presetId = context.pathParams?.presetId;
            if (!presetId) {
                return ModelConfigController.createErrorResponse<ModelConfigPresetDeleteData>(
                    'presetId is required',
                    400,
                );
            }
            if (isBuiltInModelConfigPresetId(presetId)) {
                return ModelConfigController.createErrorResponse<ModelConfigPresetDeleteData>(
                    'Built-in presets cannot be deleted',
                    400,
                );
            }
            const presetService = new ModelConfigPresetService(env);
            const removed = await presetService.deletePreset(user.id, presetId);
            if (!removed) {
                return ModelConfigController.createErrorResponse<ModelConfigPresetDeleteData>('Preset not found', 404);
            }
            return ModelConfigController.createSuccessResponse<ModelConfigPresetDeleteData>({
                message: 'Preset deleted',
            });
        } catch (error) {
            this.logger.error('Error deleting model config preset:', error);
            return ModelConfigController.createErrorResponse<ModelConfigPresetDeleteData>(
                'Failed to delete preset',
                500,
            );
        }
    }
}