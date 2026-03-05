export type FlowDefinitionStatus = 'draft' | 'published' | 'archived';
export type FlowActionType = 'none' | 'assigned_channel' | 'send_email' | 'send_sms' | 'send_whatsapp' | 'voice_call';
export type FlowConditionType = 'time_elapsed';
export type FlowTone = 'calm' | 'medium' | 'heavy';
export type FlowChannel = 'sms' | 'email' | 'whatsapp' | 'call_task';
export type FlowInstanceStatus = 'running' | 'completed_paid' | 'completed_end' | 'failed';
export type FlowStateInstanceStatus = 'upcoming' | 'waiting' | 'completed' | 'failed';

export interface FlowStateNode {
  stateKey: string;
  stateName: string;
  actionName: string;
  actionType: FlowActionType;
  tone?: FlowTone | null;
  explicitChannel?: FlowChannel | null;
  isStart?: boolean;
  isEnd?: boolean;
  positionX?: number | null;
  positionY?: number | null;
}

export interface FlowTransitionEdge {
  fromStateKey: string;
  toStateKey: string;
  conditionType?: FlowConditionType;
  waitSeconds?: number;
  label?: string | null;
  priority?: number;
}

export interface FlowSummaryDto {
  id: string;
  flowKey: string;
  version: number;
  name: string;
  description?: string | null;
  status: FlowDefinitionStatus;
  isDefault: boolean;
  createdBy: string;
  updatedBy?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    states: number;
    transitions: number;
    assignments: number;
    instances: number;
  };
}

export interface FlowStateDto {
  id: string;
  flowId: string;
  stateKey: string;
  stateName: string;
  actionName: string;
  actionType: FlowActionType;
  tone?: FlowTone | null;
  explicitChannel?: FlowChannel | null;
  isStart: boolean;
  isEnd: boolean;
  positionX?: number | null;
  positionY?: number | null;
}

export interface FlowTransitionDto {
  id: string;
  flowId: string;
  fromStateId: string;
  toStateId: string;
  conditionType: FlowConditionType;
  waitSeconds: number;
  label?: string | null;
  priority: number;
  fromState: Pick<FlowStateDto, 'id' | 'stateKey' | 'stateName'>;
  toState: Pick<FlowStateDto, 'id' | 'stateKey' | 'stateName'>;
}

export interface FlowDefinitionDto extends FlowSummaryDto {
  states: FlowStateDto[];
  transitions: FlowTransitionDto[];
}

export interface CollectionFlowStateStatusDto {
  id: string;
  status: FlowStateInstanceStatus;
  dueAt?: string | null;
  enteredAt?: string | null;
  executedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  attemptNo: number;
  sequenceNo: number;
  notificationId?: string | null;
  state: {
    id: string;
    stateKey: string;
    stateName: string;
    actionName: string;
    actionType: FlowActionType;
    tone?: FlowTone | null;
    explicitChannel?: FlowChannel | null;
    isStart: boolean;
    isEnd: boolean;
  };
}

export interface CollectionFlowInstanceDto {
  id: string;
  flowId: string;
  customerId: string;
  status: FlowInstanceStatus;
  startedAt: string;
  finishedAt?: string | null;
  nextEvaluationAt?: string | null;
  lastEvaluatedAt?: string | null;
  lastError?: string | null;
  flow: {
    id: string;
    name: string;
    flowKey: string;
    version: number;
    status: FlowDefinitionStatus;
  };
  currentState?: {
    id: string;
    stateKey: string;
    stateName: string;
  } | null;
  stateStatuses: CollectionFlowStateStatusDto[];
}

export interface CustomerCollectionFlowDto {
  customer: {
    id: string;
    fullName: string;
    preferredChannel?: FlowChannel | null;
    preferredLanguage?: 'en' | 'he' | 'ar' | null;
    preferredTone?: FlowTone | null;
    status: 'active' | 'do_not_contact' | 'blocked';
  };
  assignment: {
    customerId: string;
    flowId: string;
    source: 'default_assigned' | 'manual_override';
    assignedAt: string;
    updatedAt: string;
    flow: FlowDefinitionDto;
  } | null;
  instance: CollectionFlowInstanceDto | null;
}
