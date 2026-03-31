/**
 * Copyright (c) 2025 Cade Russell (Ghost Peony)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * API Configuration
 *
 * Centralized API configuration using environment variables.
 * Prevents hardcoded URLs and enables different environments (dev, staging, prod).
 *
 * NOTE: All endpoints use relative paths to leverage Vite proxy for backend communication.
 * The proxy is configured in vite.config.ts to forward /api/* to the backend server.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * API Endpoints
 * All backend API endpoints organized by domain
 * Using relative paths to leverage Vite proxy for backend communication
 */
export const API_ENDPOINTS = {
  agents: {
    templates: `/api/agents/templates`,
    custom: `/api/deepagents`,
    create: `/api/deepagents`,
    update: (id: string) => `/api/deepagents/${id}`,
    delete: (id: string) => `/api/deepagents/${id}`,
  },

  workflows: {
    list: `/api/workflows`,
    detail: (id: number) => `/api/workflows/${id}`,
    create: `/api/workflows`,
    update: (id: number) => `/api/workflows/${id}`,
    delete: (id: number) => `/api/workflows/${id}`,
    duplicate: (id: number) => `/api/workflows/${id}/duplicate`,
    rename: (id: number) => `/api/workflows/${id}/rename`,
    metrics: {
      cost: (id: number, days: number = 30) =>
        `/api/workflows/${id}/metrics/cost?days=${days}`,
      runs: (id: number) => `/api/workflows/${id}/metrics/runs`,
    },
  },

  projects: {
    list: `/api/projects`,
    detail: (id: number) => `/api/projects/${id}`,
    create: `/api/projects`,
    update: (id: number) => `/api/projects/${id}`,
    delete: (id: number) => `/api/projects/${id}`,
  },

  tools: {
    list: `/api/custom-tools`,
    detail: (id: string) => `/api/custom-tools/${id}`,
    create: `/api/custom-tools`,
    update: (id: string) => `/api/custom-tools/${id}`,
    delete: (id: string) => `/api/custom-tools/${id}`,
    duplicate: (id: string, newId: string) =>
      `/api/custom-tools/${id}/duplicate?new_tool_id=${newId}`,
    test: (id: string) => `/api/custom-tools/${id}/test`,
  },
} as const;

/**
 * Check if API is available
 * Useful for health checks and error recovery
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}
