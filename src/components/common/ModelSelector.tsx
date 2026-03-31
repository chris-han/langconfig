/**
 * Copyright (c) 2025 Cade Russell (Ghost Peony)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect } from 'react';
import { useAvailableModels } from '@/hooks/useAvailableModels';
import { findModelForProvider, getProviderKeyForModel, groupModelsByProvider } from '@/lib/modelProviders';

/**
 * ModelSelector Component
 *
 * A reusable dropdown component for selecting LLM models (cloud + local).
 * Automatically fetches and displays both cloud models and validated local models,
 * organized into optgroups for easy navigation.
 *
 * Usage:
 * ```tsx
 * <ModelSelector
 *   value={config.model}
 *   onChange={(modelId) => updateConfig('model', modelId)}
 *   label="Primary Model"
 *   description="The main model for this agent"
 *   includeLocal={true}
 *   required={true}
 * />
 * ```
 */

export interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  includeLocal?: boolean;
  onlyValidated?: boolean;
  required?: boolean;
  disabled?: boolean;
  showProviderLabels?: boolean;
  autoRefresh?: boolean;  // Auto-refresh model list every 30s
  className?: string;
}

export default function ModelSelector({
  value,
  onChange,
  label = 'Model',
  description,
  placeholder = 'Select a model',
  includeLocal = true,
  onlyValidated = true,
  required = false,
  disabled = false,
  showProviderLabels = true,
  autoRefresh = false,
  className = ''
}: ModelSelectorProps) {
  const { models, cloudModels, localModels, isLoading, error } = useAvailableModels({
    includeLocal,
    onlyValidated,
    refreshInterval: autoRefresh ? 30000 : undefined
  });
  const providerGroups = groupModelsByProvider(includeLocal ? models : cloudModels);
  const selectedModelOption = (includeLocal ? models : cloudModels).find((model) => model.id === value);
  const selectedProviderKey = selectedModelOption
    ? getProviderKeyForModel(selectedModelOption)
    : providerGroups[0]?.key || '';
  const selectedProviderModels = providerGroups.find((group) => group.key === selectedProviderKey)?.models || [];

  // Log error if models fail to load
  useEffect(() => {
    if (error) {
      console.error('ModelSelector: Failed to load models:', error);
    }
  }, [error]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Label */}
      {label && (
        <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <select
          value={selectedProviderKey}
          onChange={(e) => {
            const nextModel = findModelForProvider(providerGroups, e.target.value);
            onChange(nextModel?.id || '');
          }}
          disabled={disabled || isLoading}
          className="px-3 py-2 border border-gray-300 dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--color-input-background)',
            color: 'var(--color-text-primary)'
          }}
        >
          <option value="" disabled>{isLoading ? 'Loading providers...' : 'Select provider'}</option>
          {providerGroups.map((group) => (
            <option key={group.key} value={group.key}>{group.label}</option>
          ))}
        </select>

        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isLoading || selectedProviderModels.length === 0}
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="px-3 py-2 border border-gray-300 dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--color-input-background)',
            color: 'var(--color-text-primary)'
          }}
        >
          <option value="" disabled>
            {isLoading ? 'Loading models...' : placeholder}
          </option>
          {selectedProviderModels.map((model) => (
            <option key={model.id} value={model.id}>
              {showProviderLabels ? model.name : model.name}
            </option>
          ))}
          {!isLoading && selectedProviderModels.length === 0 && (
            <option value="" disabled>No models available</option>
          )}
        </select>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {description}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500">
          Failed to load models. Please check your connection.
        </p>
      )}

      {/* No local models hint */}
      {includeLocal && !isLoading && localModels.length === 0 && cloudModels.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          No local models configured. Visit Settings → Local Models to add one.
        </p>
      )}
    </div>
  );
}

/**
 * Minimal ModelSelector variant for inline use
 * Just the dropdown without label/description
 */
export function ModelSelectorInline({
  value,
  onChange,
  includeLocal = true,
  onlyValidated = true,
  disabled = false,
  className = ''
}: Pick<ModelSelectorProps, 'value' | 'onChange' | 'includeLocal' | 'onlyValidated' | 'disabled' | 'className'>) {
  const { models, cloudModels, localModels, isLoading } = useAvailableModels({
    includeLocal,
    onlyValidated
  });
  const availableModels = includeLocal ? models : cloudModels;
  const providerGroups = groupModelsByProvider(availableModels);
  const selectedModelOption = availableModels.find((model) => model.id === value);
  const selectedProviderKey = selectedModelOption
    ? getProviderKeyForModel(selectedModelOption)
    : providerGroups[0]?.key || '';
  const selectedProviderModels = providerGroups.find((group) => group.key === selectedProviderKey)?.models || [];

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <select
        value={selectedProviderKey}
        onChange={(e) => {
          const nextModel = findModelForProvider(providerGroups, e.target.value);
          onChange(nextModel?.id || '');
        }}
        disabled={disabled || isLoading}
        className="w-full px-3 py-2 border border-gray-300 dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        style={{
          backgroundColor: 'var(--color-input-background)',
          color: 'var(--color-text-primary)'
        }}
      >
        <option value="">{isLoading ? 'Loading...' : 'Provider'}</option>
        {providerGroups.map((group) => (
          <option key={group.key} value={group.key}>{group.label}</option>
        ))}
      </select>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || isLoading || selectedProviderModels.length === 0}
        onMouseDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className="w-full px-3 py-2 border border-gray-300 dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        style={{
          backgroundColor: 'var(--color-input-background)',
          color: 'var(--color-text-primary)'
        }}
      >
        <option value="">{isLoading ? 'Loading...' : 'Select model'}</option>
        {selectedProviderModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
    </div>
  );
}
