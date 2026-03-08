// API Service for communicating with the backend

import type {
  CustomerCollectionFlowDto,
  FlowDefinitionDto,
  FlowStateNode,
  FlowSummaryDto,
  FlowTransitionEdge,
} from '../types/flows';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface AIQueryResponse {
  success: boolean;
  data: {
    query: string;
    explanation: string;
    results: unknown;
    resultCount: number;
    requiresConfirmation?: boolean;
    confirmToken?: string;
    previewCount?: number;
    confirmed?: boolean;
  };
  error?: string;
}

export interface AISuggestionsResponse {
  success: boolean;
  data: string[];
}

/**
 * Send a natural language query to the AI endpoint
 */
export async function queryAI(query?: string, language?: string, confirmToken?: string): Promise<AIQueryResponse> {
  const body: Record<string, unknown> = { language };
  if (query) body.query = query;
  if (confirmToken) body.confirmToken = confirmToken;

  const response = await fetch(`${API_BASE_URL}/ai/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Get suggested queries from the AI endpoint
 */
export async function getAISuggestions(language?: string): Promise<AISuggestionsResponse> {
  const query = language ? `?language=${encodeURIComponent(language)}` : '';
  const response = await fetch(`${API_BASE_URL}/ai/suggestions${query}`);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Check server connection health
 */
export async function checkServerHealth(): Promise<{ connected: boolean; message: string }> {
  try {
    // Remove /api from the base URL to get the health endpoint
    const baseUrl = API_BASE_URL.replace(/\/api$/, '');
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });    if (response.ok) {
      const data = await response.json();
      return {
        connected: true,
        message: `Connected to server at ${baseUrl} (Status: ${data.status})`,
      };
    } else {
      return {
        connected: false,
        message: `Server responded with status ${response.status}`,
      };
    }
  } catch (error) {
    return {
      connected: false,
      message: `Failed to connect to server at ${API_BASE_URL}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  const body = (await response.json()) as ApiEnvelope<T>;
  return body.data;
}

export interface CreateFlowPayload {
  flowKey?: string;
  name: string;
  description?: string | null;
  createdBy?: string;
  states: FlowStateNode[];
  transitions: FlowTransitionEdge[];
}

export interface UpdateFlowPayload {
  name?: string;
  description?: string | null;
  updatedBy?: string;
  states: FlowStateNode[];
  transitions: FlowTransitionEdge[];
}

export async function listFlows(): Promise<FlowSummaryDto[]> {
  return apiFetch<FlowSummaryDto[]>('/flows');
}

export async function getFlowById(id: string): Promise<FlowDefinitionDto> {
  return apiFetch<FlowDefinitionDto>(`/flows/${id}`);
}

export async function createFlow(payload: CreateFlowPayload): Promise<FlowDefinitionDto> {
  return apiFetch<FlowDefinitionDto>('/flows', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFlow(id: string, payload: UpdateFlowPayload): Promise<FlowDefinitionDto> {
  return apiFetch<FlowDefinitionDto>(`/flows/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function publishFlow(id: string, updatedBy = 'ui'): Promise<FlowSummaryDto> {
  return apiFetch<FlowSummaryDto>(`/flows/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ updatedBy }),
  });
}

export interface SetDefaultFlowResult {
  flow: FlowSummaryDto;
  reassignedDefaultCustomers: number;
  newlyAssignedCustomers: number;
}

export async function setDefaultFlow(id: string, updatedBy = 'ui'): Promise<SetDefaultFlowResult> {
  return apiFetch<SetDefaultFlowResult>(`/flows/${id}/set-default`, {
    method: 'POST',
    body: JSON.stringify({ updatedBy }),
  });
}

export async function createNewFlowVersion(id: string, createdBy = 'ui'): Promise<FlowDefinitionDto> {
  return apiFetch<FlowDefinitionDto>(`/flows/${id}/new-version`, {
    method: 'POST',
    body: JSON.stringify({ createdBy }),
  });
}

export interface RunExecutorResult {
  scanned: number;
  claimed: number;
  completedPaid: number;
  completedEnd: number;
  advanced: number;
  failed: number;
  retried: number;
  skipped: number;
}

export async function runFlowExecutorOnce(limit = 50): Promise<RunExecutorResult> {
  return apiFetch<RunExecutorResult>('/flows/executor/run-once', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}

export async function getCustomerCollectionFlow(customerId: string): Promise<CustomerCollectionFlowDto> {
  return apiFetch<CustomerCollectionFlowDto>(`/customers/${customerId}/collection-flow`);
}

export async function assignCustomerFlow(customerId: string, flowId: string): Promise<{ customerId: string; flowId: string; instanceId: string | null }> {
  return apiFetch<{ customerId: string; flowId: string; instanceId: string | null }>(
    `/customers/${customerId}/collection-flow/assign`,
    {
      method: 'POST',
      body: JSON.stringify({ flowId, source: 'manual_override' }),
    }
  );
}

export interface CustomerListItem {
  id: string;
  fullName: string;
}

export async function listCustomersForFlowMonitor(limit = 100): Promise<CustomerListItem[]> {
  const response = await fetch(`${API_BASE_URL}/customers?page=1&limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const body = (await response.json()) as { success: boolean; data: CustomerListItem[] };
  return body.data || [];
}

// ── Activities ──

export interface ActivityLogItem {
  id: string;
  type: 'notification_sent' | 'chat_prompt' | 'collection_flow_created';
  activityName: string;
  description: string | null;
  customerId: string | null;
  customerName: string | null;
  status: 'success' | 'failed';
  metadata: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  customer: { id: string; fullName: string } | null;
}

export interface ActivityListResponse {
  data: ActivityLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listActivities(params: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
} = {}): Promise<ActivityListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.type) query.set('type', params.type);
  if (params.status) query.set('status', params.status);

  const qs = query.toString();
  const response = await fetch(`${API_BASE_URL}/activities${qs ? `?${qs}` : ''}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  const body = await response.json();
  return {
    data: body.data,
    pagination: body.pagination,
  };
}
