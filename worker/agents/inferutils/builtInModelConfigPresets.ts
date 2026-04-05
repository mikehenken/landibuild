/**
 * Built-in (shipping) model configuration bundles. IDs are stable API tokens: `builtin:<slug>`.
 */

import type { AgentConfig } from './config.types';
import { AIModels } from './config.types';
import {
	agentConfigToPresetConfigs,
	type PresetConfigsMap,
} from './modelConfigPresetMap';

export const BUILTIN_PRESET_ID_PREFIX = 'builtin:' as const;

export interface BuiltInModelConfigPresetDefinition {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly agentConfig: AgentConfig;
}

const ISO_SHIP_DATE = '2026-04-05T00:00:00.000Z';

const COMMON_SCREENSHOT = {
	name: AIModels.DISABLED,
	reasoning_effort: 'medium' as const,
	max_tokens: 8000,
	temperature: 1,
	fallbackModel: AIModels.GEMINI_2_5_FLASH,
};

const FAST_CODE_FIXER = {
	name: AIModels.DISABLED,
	reasoning_effort: undefined,
	max_tokens: 64000,
	temperature: 0.0,
	fallbackModel: AIModels.GEMINI_2_5_PRO,
};

const SHARED_GEMINI_IMPL_HIGH = {
	reasoning_effort: 'low' as const,
	max_tokens: 48000,
	temperature: 1,
	fallbackModel: AIModels.GEMINI_2_5_PRO,
};

const SHARED_GEMINI_IMPL_MED = {
	reasoning_effort: 'low' as const,
	max_tokens: 48000,
	temperature: 1,
	fallbackModel: AIModels.GEMINI_2_5_PRO,
};

const SHARED_GEMINI_IMPL_LOW = {
	reasoning_effort: 'low' as const,
	max_tokens: 32000,
	temperature: 1,
	fallbackModel: AIModels.GEMINI_2_5_FLASH,
};

const REALTIME_GROK = {
	name: AIModels.GROK_4_1_FAST_NON_REASONING,
	reasoning_effort: 'low' as const,
	max_tokens: 32000,
	temperature: 0.2,
	fallbackModel: AIModels.GEMINI_2_5_FLASH,
};

const SHARED_OR_IMPL_HIGH = {
	reasoning_effort: 'low' as const,
	max_tokens: 48000,
	temperature: 1,
	fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_PRO,
};

const SHARED_OR_IMPL_MED = {
	reasoning_effort: 'low' as const,
	max_tokens: 48000,
	temperature: 1,
	fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7,
};

const SHARED_OR_IMPL_LOW = {
	reasoning_effort: 'low' as const,
	max_tokens: 32000,
	temperature: 1,
	fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
};

const SHARED_OR_FREE_IMPL = {
	reasoning_effort: 'low' as const,
	max_tokens: 48000,
	temperature: 1,
	fallbackModel: AIModels.OPENROUTER_NVIDIA_NEMOTRON_3_SUPER_120B_A12B_FREE,
};

/** Default platform bundle when not using PLATFORM_AGENT_CONFIG — OpenRouter free-tier. */
export const OPENROUTER_FREE_AGENT_CONFIG: AgentConfig = {
	screenshotAnalysis: {
		...COMMON_SCREENSHOT,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_6_PLUS_FREE,
	},
	realtimeCodeFixer: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_FREE,
		reasoning_effort: 'low',
		max_tokens: 32000,
		temperature: 0.2,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_6_PLUS_FREE,
	},
	fastCodeFixer: {
		name: AIModels.DISABLED,
		reasoning_effort: undefined,
		max_tokens: 64000,
		temperature: 0.0,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_CODER_FREE,
	},
	templateSelection: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_6_PLUS_FREE,
		max_tokens: 2000,
		fallbackModel: AIModels.OPENROUTER_MINIMAX_M2_5_FREE,
		temperature: 1,
	},
	blueprint: {
		name: AIModels.OPENROUTER_NVIDIA_NEMOTRON_3_SUPER_120B_A12B_FREE,
		reasoning_effort: 'high',
		max_tokens: 20000,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_6_PLUS_FREE,
		temperature: 1.0,
	},
	projectSetup: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_FREE,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_MINIMAX_M2_5_FREE,
	},
	phaseGeneration: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_FREE,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_NEXT_80B_A3B_INSTRUCT_FREE,
	},
	firstPhaseImplementation: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_FREE,
		...SHARED_OR_FREE_IMPL,
	},
	phaseImplementation: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_FREE,
		...SHARED_OR_FREE_IMPL,
	},
	conversationalResponse: {
		name: AIModels.OPENROUTER_MINIMAX_M2_5_FREE,
		reasoning_effort: 'low',
		max_tokens: 4000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_6_PLUS_FREE,
	},
	deepDebugger: {
		name: AIModels.OPENROUTER_ARCEE_TRINITY_LARGE_PREVIEW_FREE,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_CODER_FREE,
	},
	fileRegeneration: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_FREE,
		reasoning_effort: 'low',
		max_tokens: 16000,
		temperature: 0.0,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_NEXT_80B_A3B_INSTRUCT_FREE,
	},
	agenticProjectBuilder: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_FREE,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_NVIDIA_NEMOTRON_3_SUPER_120B_A12B_FREE,
	},
};

const GEMINI_HIGH: AgentConfig = {
	screenshotAnalysis: { ...COMMON_SCREENSHOT },
	realtimeCodeFixer: REALTIME_GROK,
	fastCodeFixer: {
		...FAST_CODE_FIXER,
		fallbackModel: AIModels.GEMINI_2_5_PRO,
	},
	templateSelection: {
		name: AIModels.GEMINI_2_5_FLASH_LITE,
		max_tokens: 2000,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
		temperature: 0.6,
	},
	blueprint: {
		name: AIModels.GEMINI_3_PRO_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 32000,
		fallbackModel: AIModels.GEMINI_2_5_PRO,
		temperature: 1,
	},
	projectSetup: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_PRO,
	},
	phaseGeneration: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_PRO,
	},
	firstPhaseImplementation: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		...SHARED_GEMINI_IMPL_HIGH,
	},
	phaseImplementation: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		...SHARED_GEMINI_IMPL_HIGH,
	},
	conversationalResponse: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'low',
		max_tokens: 4000,
		temperature: 0,
		fallbackModel: AIModels.GEMINI_2_5_PRO,
	},
	deepDebugger: {
		name: AIModels.GEMINI_2_5_PRO,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
	},
	fileRegeneration: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'low',
		max_tokens: 32000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
	agenticProjectBuilder: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_PRO,
	},
};

const GEMINI_MEDIUM: AgentConfig = {
	screenshotAnalysis: { ...COMMON_SCREENSHOT },
	realtimeCodeFixer: REALTIME_GROK,
	fastCodeFixer: FAST_CODE_FIXER,
	templateSelection: {
		name: AIModels.GEMINI_2_5_FLASH_LITE,
		max_tokens: 2000,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
		temperature: 0.6,
	},
	blueprint: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 64000,
		fallbackModel: AIModels.GEMINI_2_5_PRO,
		temperature: 1,
	},
	projectSetup: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		...SHARED_GEMINI_IMPL_MED,
	},
	phaseGeneration: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		...SHARED_GEMINI_IMPL_MED,
	},
	firstPhaseImplementation: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		...SHARED_GEMINI_IMPL_MED,
	},
	phaseImplementation: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		...SHARED_GEMINI_IMPL_MED,
	},
	conversationalResponse: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'low',
		max_tokens: 4000,
		temperature: 0,
		fallbackModel: AIModels.GEMINI_2_5_PRO,
	},
	deepDebugger: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
	fileRegeneration: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'low',
		max_tokens: 32000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
	agenticProjectBuilder: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
};

const GEMINI_LOW: AgentConfig = {
	screenshotAnalysis: { ...COMMON_SCREENSHOT },
	realtimeCodeFixer: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'low',
		max_tokens: 24000,
		temperature: 0.2,
		fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
	},
	fastCodeFixer: {
		name: AIModels.DISABLED,
		reasoning_effort: undefined,
		max_tokens: 48000,
		temperature: 0.0,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
	templateSelection: {
		name: AIModels.GEMINI_2_5_FLASH_LITE,
		max_tokens: 2000,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
		temperature: 0.6,
	},
	blueprint: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'high',
		max_tokens: 32000,
		fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
		temperature: 1,
	},
	projectSetup: {
		name: AIModels.GEMINI_2_5_FLASH,
		...SHARED_GEMINI_IMPL_LOW,
	},
	phaseGeneration: {
		name: AIModels.GEMINI_2_5_FLASH,
		...SHARED_GEMINI_IMPL_LOW,
	},
	firstPhaseImplementation: {
		name: AIModels.GEMINI_2_5_FLASH,
		...SHARED_GEMINI_IMPL_LOW,
	},
	phaseImplementation: {
		name: AIModels.GEMINI_2_5_FLASH,
		...SHARED_GEMINI_IMPL_LOW,
	},
	conversationalResponse: {
		name: AIModels.GEMINI_2_5_FLASH_LITE,
		reasoning_effort: 'low',
		max_tokens: 4000,
		temperature: 0,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
	deepDebugger: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
	},
	fileRegeneration: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'low',
		max_tokens: 24000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
	},
	agenticProjectBuilder: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
	},
};

const REALTIME_OR_HIGH = {
	name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
	reasoning_effort: 'low' as const,
	max_tokens: 32000,
	temperature: 0.2,
	fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
};

const OPENROUTER_HIGH: AgentConfig = {
	screenshotAnalysis: {
		...COMMON_SCREENSHOT,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_5_TURBO,
	},
	realtimeCodeFixer: REALTIME_OR_HIGH,
	fastCodeFixer: {
		name: AIModels.DISABLED,
		reasoning_effort: undefined,
		max_tokens: 64000,
		temperature: 0.0,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
	},
	templateSelection: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		max_tokens: 2000,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
		temperature: 1,
	},
	blueprint: {
		name: AIModels.OPENROUTER_GOOGLE_GEMINI_3_1_PRO_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 24000,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_PRO,
		temperature: 1,
	},
	projectSetup: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_5,
	},
	phaseGeneration: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_5,
	},
	firstPhaseImplementation: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
		...SHARED_OR_IMPL_HIGH,
	},
	phaseImplementation: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
		...SHARED_OR_IMPL_HIGH,
	},
	conversationalResponse: {
		name: AIModels.OPENROUTER_Z_AI_GLM_5_TURBO,
		reasoning_effort: 'low',
		max_tokens: 4000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7,
	},
	deepDebugger: {
		name: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_PRO,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
	},
	fileRegeneration: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		reasoning_effort: 'low',
		max_tokens: 16000,
		temperature: 0.0,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
	},
	agenticProjectBuilder: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_PRO,
	},
};

const OPENROUTER_MEDIUM: AgentConfig = {
	screenshotAnalysis: COMMON_SCREENSHOT,
	realtimeCodeFixer: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'low',
		max_tokens: 32000,
		temperature: 0.2,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7,
	},
	fastCodeFixer: {
		name: AIModels.DISABLED,
		reasoning_effort: undefined,
		max_tokens: 64000,
		temperature: 0.0,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7,
	},
	templateSelection: {
		name: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
		max_tokens: 2000,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		temperature: 1,
	},
	blueprint: {
		name: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_PRO,
		reasoning_effort: 'high',
		max_tokens: 32000,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_5_TURBO,
		temperature: 1,
	},
	projectSetup: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_5_PLUS_02_15,
	},
	phaseGeneration: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_5_PLUS_02_15,
	},
	firstPhaseImplementation: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		...SHARED_OR_IMPL_MED,
	},
	phaseImplementation: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		...SHARED_OR_IMPL_MED,
	},
	conversationalResponse: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'low',
		max_tokens: 4000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
	},
	deepDebugger: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_5_PLUS_02_15,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_PRO,
	},
	fileRegeneration: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'low',
		max_tokens: 16000,
		temperature: 0.0,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7,
	},
	agenticProjectBuilder: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_PRO,
	},
};

const OPENROUTER_LOW: AgentConfig = {
	screenshotAnalysis: COMMON_SCREENSHOT,
	realtimeCodeFixer: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'low',
		max_tokens: 24000,
		temperature: 0.2,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
	},
	fastCodeFixer: {
		name: AIModels.DISABLED,
		reasoning_effort: undefined,
		max_tokens: 48000,
		temperature: 0.0,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
	},
	templateSelection: {
		name: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
		max_tokens: 2000,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		temperature: 1,
	},
	blueprint: {
		name: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
		reasoning_effort: 'high',
		max_tokens: 24000,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		temperature: 1,
	},
	projectSetup: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
	},
	phaseGeneration: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
	},
	firstPhaseImplementation: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		...SHARED_OR_IMPL_LOW,
	},
	phaseImplementation: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		...SHARED_OR_IMPL_LOW,
	},
	conversationalResponse: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'low',
		max_tokens: 4000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
	},
	deepDebugger: {
		name: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
	},
	fileRegeneration: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'low',
		max_tokens: 24000,
		temperature: 0.0,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
	},
	agenticProjectBuilder: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
	},
};

const MIX_HIGH: AgentConfig = {
	screenshotAnalysis: { ...COMMON_SCREENSHOT },
	realtimeCodeFixer: REALTIME_GROK,
	fastCodeFixer: {
		...FAST_CODE_FIXER,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
	},
	templateSelection: {
		name: AIModels.GEMINI_2_5_FLASH_LITE,
		max_tokens: 2000,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
		temperature: 0.6,
	},
	blueprint: {
		name: AIModels.GEMINI_3_PRO_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 32000,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_PRO,
		temperature: 1,
	},
	projectSetup: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
	},
	phaseGeneration: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
	},
	firstPhaseImplementation: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
		...SHARED_OR_IMPL_HIGH,
	},
	phaseImplementation: {
		name: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
		...SHARED_OR_IMPL_HIGH,
	},
	conversationalResponse: {
		name: AIModels.GROK_4_1_FAST,
		reasoning_effort: 'low',
		max_tokens: 4000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
	deepDebugger: {
		name: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_PRO,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
	},
	fileRegeneration: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'low',
		max_tokens: 32000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
	},
	agenticProjectBuilder: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_QWEN_QWEN3_CODER_NEXT,
	},
};

const MIX_MEDIUM: AgentConfig = {
	screenshotAnalysis: { ...COMMON_SCREENSHOT },
	realtimeCodeFixer: REALTIME_GROK,
	fastCodeFixer: FAST_CODE_FIXER,
	templateSelection: {
		name: AIModels.GEMINI_2_5_FLASH_LITE,
		max_tokens: 2000,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
		temperature: 0.6,
	},
	blueprint: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 64000,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		temperature: 1,
	},
	projectSetup: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
	},
	phaseGeneration: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
	},
	firstPhaseImplementation: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		...SHARED_OR_IMPL_MED,
	},
	phaseImplementation: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7,
		...SHARED_OR_IMPL_MED,
	},
	conversationalResponse: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'low',
		max_tokens: 4000,
		temperature: 0,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
	},
	deepDebugger: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_PRO,
	},
	fileRegeneration: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'low',
		max_tokens: 32000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
	},
	agenticProjectBuilder: {
		name: AIModels.GEMINI_3_FLASH_PREVIEW,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7,
	},
};

const MIX_LOW: AgentConfig = {
	screenshotAnalysis: { ...COMMON_SCREENSHOT },
	realtimeCodeFixer: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'low',
		max_tokens: 24000,
		temperature: 0.2,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
	},
	fastCodeFixer: {
		name: AIModels.DISABLED,
		reasoning_effort: undefined,
		max_tokens: 48000,
		temperature: 0.0,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
	templateSelection: {
		name: AIModels.GEMINI_2_5_FLASH_LITE,
		max_tokens: 2000,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
		temperature: 0.6,
	},
	blueprint: {
		name: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
		reasoning_effort: 'high',
		max_tokens: 24000,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
		temperature: 1,
	},
	projectSetup: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
	phaseGeneration: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
	firstPhaseImplementation: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		...SHARED_OR_IMPL_LOW,
	},
	phaseImplementation: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		...SHARED_OR_IMPL_LOW,
	},
	conversationalResponse: {
		name: AIModels.GEMINI_2_5_FLASH_LITE,
		reasoning_effort: 'low',
		max_tokens: 4000,
		temperature: 0,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
	},
	deepDebugger: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'high',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_GOOGLE_GEMINI_2_5_FLASH_LITE,
	},
	fileRegeneration: {
		name: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
		reasoning_effort: 'low',
		max_tokens: 24000,
		temperature: 1,
		fallbackModel: AIModels.GEMINI_2_5_FLASH,
	},
	agenticProjectBuilder: {
		name: AIModels.GEMINI_2_5_FLASH,
		reasoning_effort: 'medium',
		max_tokens: 8000,
		temperature: 1,
		fallbackModel: AIModels.OPENROUTER_Z_AI_GLM_4_7_FLASH,
	},
};

export const BUILT_IN_MODEL_CONFIG_PRESETS: readonly BuiltInModelConfigPresetDefinition[] = [
	{
		id: `${BUILTIN_PRESET_ID_PREFIX}openrouter-free`,
		name: 'OpenRouter · Free (default)',
		description: 'Free-tier OpenRouter models across agents. Requires an OpenRouter API key or BYOK.',
		agentConfig: OPENROUTER_FREE_AGENT_CONFIG,
	},
	{
		id: `${BUILTIN_PRESET_ID_PREFIX}gemini-high`,
		name: 'Gemini · High',
		description: 'Gemini 3 Pro for blueprint; Flash for implementation. Google AI Studio access required.',
		agentConfig: GEMINI_HIGH,
	},
	{
		id: `${BUILTIN_PRESET_ID_PREFIX}gemini-medium`,
		name: 'Gemini · Medium',
		description: 'Gemini 3 Flash–centric workload. Google AI Studio access required.',
		agentConfig: GEMINI_MEDIUM,
	},
	{
		id: `${BUILTIN_PRESET_ID_PREFIX}gemini-low`,
		name: 'Gemini · Low',
		description: 'Gemini 2.5 Flash / Flash-Lite for lower cost. Google AI Studio access required.',
		agentConfig: GEMINI_LOW,
	},
	{
		id: `${BUILTIN_PRESET_ID_PREFIX}openrouter-high`,
		name: 'OpenRouter · High',
		description: 'Premium OpenRouter routing (Gemini 3.1 Pro, Qwen Coder Next, GLM).',
		agentConfig: OPENROUTER_HIGH,
	},
	{
		id: `${BUILTIN_PRESET_ID_PREFIX}openrouter-medium`,
		name: 'OpenRouter · Medium',
		description: 'Balanced OpenRouter models (Gemini 2.5 Pro, GLM 4.7, Qwen3.5).',
		agentConfig: OPENROUTER_MEDIUM,
	},
	{
		id: `${BUILTIN_PRESET_ID_PREFIX}openrouter-low`,
		name: 'OpenRouter · Low',
		description: 'Efficient OpenRouter models (Flash-Lite, GLM 4.7 Flash).',
		agentConfig: OPENROUTER_LOW,
	},
	{
		id: `${BUILTIN_PRESET_ID_PREFIX}mix-high`,
		name: 'Mix · High',
		description: 'Gemini blueprint + OpenRouter codegen + Grok chat.',
		agentConfig: MIX_HIGH,
	},
	{
		id: `${BUILTIN_PRESET_ID_PREFIX}mix-medium`,
		name: 'Mix · Medium',
		description: 'Gemini + OpenRouter GLM split across planning and coding.',
		agentConfig: MIX_MEDIUM,
	},
	{
		id: `${BUILTIN_PRESET_ID_PREFIX}mix-low`,
		name: 'Mix · Low',
		description: 'Lite Gemini and OpenRouter Flash models.',
		agentConfig: MIX_LOW,
	},
] as const;

const BUILTIN_BY_ID: ReadonlyMap<string, BuiltInModelConfigPresetDefinition> = new Map(
	BUILT_IN_MODEL_CONFIG_PRESETS.map((d) => [d.id, d]),
);

export function isBuiltInModelConfigPresetId(presetId: string): boolean {
	return presetId.startsWith(BUILTIN_PRESET_ID_PREFIX) && BUILTIN_BY_ID.has(presetId);
}

export function getBuiltInModelConfigPresetDefinition(
	presetId: string,
): BuiltInModelConfigPresetDefinition | undefined {
	return BUILTIN_BY_ID.get(presetId);
}

export function getBuiltInModelConfigPresetConfigs(presetId: string): PresetConfigsMap | undefined {
	const def = getBuiltInModelConfigPresetDefinition(presetId);
	if (!def) {
		return undefined;
	}
	return agentConfigToPresetConfigs(def.agentConfig);
}

export function listBuiltInModelConfigPresetSummaries(): Array<{
	id: string;
	name: string;
	description: string | null;
	agentActionCount: number;
	createdAt: string;
	updatedAt: string;
	isBuiltIn: true;
}> {
	return BUILT_IN_MODEL_CONFIG_PRESETS.map((d) => ({
		id: d.id,
		name: d.name,
		description: d.description,
		agentActionCount: Object.keys(agentConfigToPresetConfigs(d.agentConfig)).length,
		createdAt: ISO_SHIP_DATE,
		updatedAt: ISO_SHIP_DATE,
		isBuiltIn: true as const,
	}));
}
