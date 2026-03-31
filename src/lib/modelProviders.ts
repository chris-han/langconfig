import type { ModelOption } from '@/hooks/useAvailableModels';

export const ADDITIONAL_PROVIDER_CATALOG: Record<string, { label: string; baseUrl: string; placeholderModels: string[] }> = {
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    placeholderModels: ['openai/gpt-4.1', 'anthropic/claude-sonnet-4.5'],
  },
  fireworks: {
    label: 'Fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    placeholderModels: ['accounts/fireworks/models/qwen3.5-72b-instruct'],
  },
  baseten: {
    label: 'Baseten',
    baseUrl: 'https://inference.baseten.co/v1',
    placeholderModels: ['openai/gpt-4.1'],
  },
};

const BUILTIN_PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  azure_openai: 'Azure OpenAI',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  vllm: 'vLLM',
  litellm: 'LiteLLM',
  local: 'Local',
};

export function normalizeProviderKey(provider: string | undefined | null): string {
  if (!provider) return 'unknown';
  return provider.toLowerCase().replace(/\s+/g, '_');
}

export function inferProviderKeyFromModelId(modelId: string): string {
  if (modelId.includes(':')) {
    return normalizeProviderKey(modelId.split(':', 1)[0]);
  }
  if (modelId.startsWith('gpt-') || modelId.startsWith('o')) return 'openai';
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gemini-')) return 'google';
  if (modelId.startsWith('local-')) return 'local';
  return 'unknown';
}

export function getProviderKeyForModel(model: Pick<ModelOption, 'id' | 'provider'>): string {
  const providerKey = normalizeProviderKey(model.provider);
  return providerKey !== 'unknown' ? providerKey : inferProviderKeyFromModelId(model.id);
}

export function getProviderDisplayName(providerKey: string): string {
  return ADDITIONAL_PROVIDER_CATALOG[providerKey]?.label
    || BUILTIN_PROVIDER_LABELS[providerKey]
    || providerKey.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function groupModelsByProvider(models: ModelOption[]) {
  const grouped = new Map<string, ModelOption[]>();
  for (const model of models) {
    const providerKey = getProviderKeyForModel(model);
    const existing = grouped.get(providerKey) || [];
    existing.push(model);
    grouped.set(providerKey, existing);
  }

  return Array.from(grouped.entries()).map(([key, providerModels]) => ({
    key,
    label: getProviderDisplayName(key),
    models: providerModels,
  }));
}

export function findModelForProvider(
  providerGroups: Array<{ key: string; label: string; models: ModelOption[] }>,
  providerKey: string,
  currentModelId?: string
) {
  const group = providerGroups.find((item) => item.key === providerKey);
  if (!group || group.models.length === 0) return undefined;
  return group.models.find((model) => model.id === currentModelId) || group.models[0];
}
