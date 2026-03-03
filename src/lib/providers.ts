/**
 * Provider Types & UI Metadata — single source of truth for the frontend.
 *
 * NOTE: When adding a new provider type, also update
 * electron/utils/provider-registry.ts (env vars, models, configs).
 */

export const PROVIDER_TYPES = [
  'aihub-dev',
  'aihub-prd',
  'openai',
  'google',
  'openrouter',
  'ark',
  'moonshot',
  'siliconflow',
  'minimax-portal',
  'minimax-portal-cn',
  'qwen-portal',
  'ollama',
  'custom',
] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const OLLAMA_PLACEHOLDER_API_KEY = 'ollama-local';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  model?: string;
  fallbackModels?: string[];
  fallbackProviderIds?: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderWithKeyInfo extends ProviderConfig {
  hasKey: boolean;
  keyMasked: string | null;
}

export interface ProviderTypeInfo {
  id: ProviderType;
  name: string;
  icon: string;
  placeholder: string;
  /** Model brand name for display (e.g. "Claude", "GPT") */
  model?: string;
  requiresApiKey: boolean;
  /** Pre-filled base URL (for proxy/compatible providers like SiliconFlow) */
  defaultBaseUrl?: string;
  /** Whether the user can edit the base URL in setup */
  showBaseUrl?: boolean;
  /** Whether to show a Model ID input field (for providers where user picks the model) */
  showModelId?: boolean;
  /** Default / example model ID placeholder */
  modelIdPlaceholder?: string;
  /** Default model ID to pre-fill */
  defaultModelId?: string;
  /** Whether this provider uses OAuth device flow instead of an API key */
  isOAuth?: boolean;
  /** Whether this provider also accepts a direct API key (in addition to OAuth) */
  supportsApiKey?: boolean;
  /** URL where users can apply for the API Key */
  apiKeyUrl?: string;
}

import { providerIcons } from '@/assets/providers';

/** All supported provider types with UI metadata */
export const PROVIDER_TYPE_INFO: ProviderTypeInfo[] = [
  { id: 'aihub-dev', name: '国信AIHUB(办公网)', icon: 'aihub', placeholder: 'API key...', model: 'Kimi-K2.5', requiresApiKey: true, showBaseUrl: true, defaultBaseUrl: 'http://10.118.10.111:80/s-AIGCLLMP-0012/v1', defaultModelId: 'kimi2-5' },
  { id: 'aihub-prd', name: '国信AIHUB(生产网)', icon: 'aihub', placeholder: 'API key...', model: 'DeepSeek-V3.2', requiresApiKey: true, showBaseUrl: true, defaultBaseUrl: 'http://10.66.27.217:80/s-AIGCLLMP-0012/v1', defaultModelId: 'DeepSeek-v3.2' },
  { id: 'qwen-portal', name: 'Qwen', icon: '☁️', placeholder: 'sk-...', model: 'Qwen', requiresApiKey: false, isOAuth: true, defaultModelId: 'coder-model' },
  { id: 'custom', name: 'Custom', icon: '⚙️', placeholder: 'API key...', requiresApiKey: true, showBaseUrl: true, showModelId: true, modelIdPlaceholder: 'your-provider/model-id' },
];

/** Get the SVG logo URL for a provider type, falls back to undefined */
export function getProviderIconUrl(type: ProviderType | string): string | undefined {
  return providerIcons[type];
}

/** Whether a provider's logo needs CSS invert in dark mode (all logos are monochrome) */
export function shouldInvertInDark(_type: ProviderType | string): boolean {
  return true;
}

/** Provider list shown in the Setup wizard */
export const SETUP_PROVIDERS = PROVIDER_TYPE_INFO;

/** Get type info by provider type id */
export function getProviderTypeInfo(type: ProviderType): ProviderTypeInfo | undefined {
  return PROVIDER_TYPE_INFO.find((t) => t.id === type);
}

/** Normalize provider API key before saving; Ollama uses a local placeholder when blank. */
export function resolveProviderApiKeyForSave(type: ProviderType | string, apiKey: string): string | undefined {
  const trimmed = apiKey.trim();
  if (type === 'ollama') {
    return trimmed || OLLAMA_PLACEHOLDER_API_KEY;
  }
  return trimmed || undefined;
}
