// API Service for communicating with the backend

const API_BASE_URL = '/api';

export interface AIQueryResponse {
  success: boolean;
  data: {
    query: string;
    explanation: string;
    results: unknown;
    resultCount: number;
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
export async function queryAI(query: string): Promise<AIQueryResponse> {
  const response = await fetch(`${API_BASE_URL}/ai/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
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
export async function getAISuggestions(): Promise<AISuggestionsResponse> {
  const response = await fetch(`${API_BASE_URL}/ai/suggestions`);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

