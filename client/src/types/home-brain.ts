export type HomeBrainPriority = 'critical' | 'high' | 'medium' | 'low';
export type HomeBrainChannel = 'sms' | 'email' | 'whatsapp' | 'call_task';
export type HomeBrainLanguage = 'en' | 'he' | 'ar';
export type HomeBrainTone = 'calm' | 'medium' | 'heavy';

export interface HomeBrainKpi {
  key: string;
  label: string;
  value: number | string;
  format: 'currency' | 'number' | 'percent' | 'text';
  trend?: {
    direction: 'up' | 'down' | 'flat';
    value?: number;
    label?: string;
  };
}

export interface HomeBrainQueue {
  queueId: string;
  title: string;
  description?: string;
  count: number;
  customerIds: string[];
  priority: HomeBrainPriority;
}

export interface HomeBrainFilter {
  key: string;
  label: string;
  type: 'select' | 'multi_select' | 'date_range' | 'toggle';
  options?: Array<{ label: string; value: string }>;
}

export interface HomeBrainGroupingSuggestion {
  key: string;
  label: string;
  supportedValues: string[];
}

export interface HomeBrainDashboardDefinition {
  title: string;
  subtitle?: string;
  kpis: HomeBrainKpi[];
  queues: HomeBrainQueue[];
  filters: HomeBrainFilter[];
  groupings: HomeBrainGroupingSuggestion[];
}

export interface HomeBrainRecommendationCard {
  cardId: string;
  type: 'queue' | 'bulk_action' | 'flow' | 'alert' | 'kpi_explainer';
  title: string;
  body: string;
  priority: HomeBrainPriority;
  badges: string[];
  targetCustomerIds: string[];
  queueRef?: string;
  actionIntentIds: string[];
  explainability: {
    whyNow: string;
    keySignals: string[];
  };
}

export interface HomeBrainOpenQueuePayload {
  queueId: string;
  filterSpec?: Record<string, string>;
}

export interface HomeBrainSendBulkPayload {
  customerIds: string[];
  channel: HomeBrainChannel;
  language: HomeBrainLanguage;
  tone: HomeBrainTone;
  templateKey: string;
}

export interface HomeBrainSwitchChannelPayload {
  customerIds: string[];
  fromChannel: HomeBrainChannel;
  toChannel: HomeBrainChannel;
  language: HomeBrainLanguage;
  tone: HomeBrainTone;
  templateKey: string;
}

export interface HomeBrainMaterializeFlowPayload {
  blueprintId: string;
  flowName: string;
  description?: string;
}

export interface HomeBrainAssignFlowPayload {
  flowId: string;
  customerIds: string[];
}

export interface HomeBrainNotifyManagementPayload {
  severity: HomeBrainPriority;
  title: string;
  body: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface HomeBrainCreateAlertPayload extends HomeBrainNotifyManagementPayload {
  audience: 'management' | 'operations' | 'collections';
}

export type HomeBrainActionIntent =
  | {
      id: string;
      type: 'open_queue';
      title: string;
      requiresApproval: boolean;
      payload: HomeBrainOpenQueuePayload;
    }
  | {
      id: string;
      type: 'send_bulk_reminders';
      title: string;
      requiresApproval: boolean;
      payload: HomeBrainSendBulkPayload;
    }
  | {
      id: string;
      type: 'switch_channel_for_cohort';
      title: string;
      requiresApproval: boolean;
      payload: HomeBrainSwitchChannelPayload;
    }
  | {
      id: string;
      type: 'materialize_collection_flow';
      title: string;
      requiresApproval: boolean;
      payload: HomeBrainMaterializeFlowPayload;
    }
  | {
      id: string;
      type: 'assign_flow_to_customers';
      title: string;
      requiresApproval: boolean;
      payload: HomeBrainAssignFlowPayload;
    }
  | {
      id: string;
      type: 'notify_management';
      title: string;
      requiresApproval: boolean;
      payload: HomeBrainNotifyManagementPayload;
    }
  | {
      id: string;
      type: 'create_internal_alert';
      title: string;
      requiresApproval: boolean;
      payload: HomeBrainCreateAlertPayload;
    };

export interface HomeBrainInternalAlert {
  id: string;
  severity: HomeBrainPriority;
  audience: 'management' | 'operations' | 'collections';
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface HomeBrainFlowBlueprintStep {
  stepKey: string;
  dayOffset: number;
  actionType: 'assigned_channel' | 'send_email' | 'send_sms' | 'send_whatsapp' | 'voice_call';
  explicitChannel?: HomeBrainChannel;
  languageMode: 'preferred' | 'explicit' | 'inferred';
  language?: HomeBrainLanguage;
  toneMode: 'auto' | 'explicit';
  tone?: HomeBrainTone;
  templateKey: string;
  expectedOutcome?: string;
  fallbackRule?: string;
}

export interface HomeBrainFlowBlueprint {
  blueprintId: string;
  name: string;
  description?: string;
  audienceCustomerIds: string[];
  steps: HomeBrainFlowBlueprintStep[];
}

export interface HomeBrainPlan {
  planVersion: string;
  generatedAt: string;
  contextVersion: string;
  reasoningSummary: string;
  dashboard: HomeBrainDashboardDefinition;
  cards: HomeBrainRecommendationCard[];
  flowBlueprints: HomeBrainFlowBlueprint[];
  actionIntents: HomeBrainActionIntent[];
  internalAlerts: HomeBrainInternalAlert[];
}

export interface GenerateHomeBrainPlanRequest {
  locale: 'en' | 'he';
  filters?: {
    segment?: 'all' | 'high_risk' | 'overdue' | 'no_response';
    language?: 'en' | 'he' | 'ar';
    minOverdueDays?: number;
  };
  forceRefresh?: boolean;
  maxCards?: number;
}

export interface GenerateHomeBrainPlanResponse {
  planId: string;
  status: 'generated';
  plan: HomeBrainPlan;
  cachedAt?: string;
}

export interface HomeBrainCardMutationRequest {
  planId: string;
  performedBy?: string;
  modifications?: Record<string, unknown>;
  reason?: string;
}

export interface HomeBrainCardMutationResponse {
  cardId: string;
  planId: string;
  status: 'approved' | 'modified' | 'skipped' | 'resolved' | 'failed';
  executionResult?: Record<string, unknown>;
  preview?: Record<string, unknown>;
  intent?: HomeBrainActionIntent | null;
}
