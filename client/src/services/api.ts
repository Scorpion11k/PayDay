// API Service for communicating with the backend

const API_BASE_URL = '/api';

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

