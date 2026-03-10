import { z } from 'zod';
import { ValidationError } from '../../types';

const prioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
const languageSchema = z.enum(['en', 'he', 'ar']);
const toneSchema = z.enum(['calm', 'medium', 'heavy']);
const channelSchema = z.enum(['sms', 'email', 'whatsapp', 'call_task']);
const queuePrioritySchema = prioritySchema;

const kpiSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  format: z.enum(['currency', 'number', 'percent', 'text']),
  trend: z
    .object({
      direction: z.enum(['up', 'down', 'flat']),
      value: z.number().optional(),
      label: z.string().optional(),
    })
    .optional(),
});

const queueSchema = z.object({
  queueId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  count: z.number().int().min(0),
  customerIds: z.array(z.string().uuid()).max(200),
  priority: queuePrioritySchema,
});

const filterSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['select', 'multi_select', 'date_range', 'toggle']),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
      })
    )
    .optional(),
});

const groupingSuggestionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  supportedValues: z.array(z.string().min(1)).max(20),
});

const dashboardDefinitionSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  kpis: z.array(kpiSchema).max(8),
  queues: z.array(queueSchema).max(6),
  filters: z.array(filterSchema).max(12),
  groupings: z.array(groupingSuggestionSchema).max(10),
});

const recommendationCardSchema = z.object({
  cardId: z.string().min(1),
  type: z.enum(['queue', 'bulk_action', 'flow', 'alert', 'kpi_explainer']),
  title: z.string().min(1),
  body: z.string().min(1),
  priority: prioritySchema,
  badges: z.array(z.string().min(1)).max(8),
  targetCustomerIds: z.array(z.string().uuid()).max(200),
  queueRef: z.string().optional(),
  actionIntentIds: z.array(z.string().min(1)).max(6),
  explainability: z.object({
    whyNow: z.string().min(1),
    keySignals: z.array(z.string().min(1)).max(10),
  }),
});

const openQueuePayloadSchema = z.object({
  queueId: z.string().min(1),
  filterSpec: z.record(z.string()).optional(),
});

const sendBulkRemindersPayloadSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1).max(200),
  channel: channelSchema,
  language: languageSchema,
  tone: toneSchema,
  templateKey: z.string().min(1),
});

const switchChannelPayloadSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1).max(200),
  fromChannel: channelSchema,
  toChannel: channelSchema,
  language: languageSchema,
  tone: toneSchema,
  templateKey: z.string().min(1),
});

const materializeFlowPayloadSchema = z.object({
  blueprintId: z.string().min(1),
  flowName: z.string().min(1),
  description: z.string().optional(),
});

const assignFlowPayloadSchema = z.object({
  flowId: z.string().uuid(),
  customerIds: z.array(z.string().uuid()).min(1).max(200),
});

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const notifyManagementPayloadSchema = z.object({
  severity: prioritySchema,
  title: z.string().min(1),
  body: z.string().min(1),
  metadata: z.record(metadataValueSchema).optional(),
});

const createAlertPayloadSchema = z.object({
  severity: prioritySchema,
  audience: z.enum(['management', 'operations', 'collections']),
  title: z.string().min(1),
  body: z.string().min(1),
  metadata: z.record(metadataValueSchema).optional(),
});

const openQueueIntentSchema = z.object({
  id: z.string().min(1),
  type: z.literal('open_queue'),
  title: z.string().min(1),
  requiresApproval: z.boolean(),
  payload: openQueuePayloadSchema,
});

const sendBulkRemindersIntentSchema = z.object({
  id: z.string().min(1),
  type: z.literal('send_bulk_reminders'),
  title: z.string().min(1),
  requiresApproval: z.boolean(),
  payload: sendBulkRemindersPayloadSchema,
});

const switchChannelIntentSchema = z.object({
  id: z.string().min(1),
  type: z.literal('switch_channel_for_cohort'),
  title: z.string().min(1),
  requiresApproval: z.boolean(),
  payload: switchChannelPayloadSchema,
});

const materializeFlowIntentSchema = z.object({
  id: z.string().min(1),
  type: z.literal('materialize_collection_flow'),
  title: z.string().min(1),
  requiresApproval: z.boolean(),
  payload: materializeFlowPayloadSchema,
});

const assignFlowIntentSchema = z.object({
  id: z.string().min(1),
  type: z.literal('assign_flow_to_customers'),
  title: z.string().min(1),
  requiresApproval: z.boolean(),
  payload: assignFlowPayloadSchema,
});

const notifyManagementIntentSchema = z.object({
  id: z.string().min(1),
  type: z.literal('notify_management'),
  title: z.string().min(1),
  requiresApproval: z.boolean(),
  payload: notifyManagementPayloadSchema,
});

const createInternalAlertIntentSchema = z.object({
  id: z.string().min(1),
  type: z.literal('create_internal_alert'),
  title: z.string().min(1),
  requiresApproval: z.boolean(),
  payload: createAlertPayloadSchema,
});

const actionIntentSchema = z.union([
  openQueueIntentSchema,
  sendBulkRemindersIntentSchema,
  switchChannelIntentSchema,
  materializeFlowIntentSchema,
  assignFlowIntentSchema,
  notifyManagementIntentSchema,
  createInternalAlertIntentSchema,
]);

const internalAlertDraftSchema = z.object({
  id: z.string().min(1),
  severity: prioritySchema,
  audience: z.enum(['management', 'operations', 'collections']),
  title: z.string().min(1),
  body: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const collectionFlowBlueprintStepSchema = z.object({
  stepKey: z.string().min(1),
  dayOffset: z.number().int().min(0),
  actionType: z.enum(['assigned_channel', 'send_email', 'send_sms', 'send_whatsapp', 'voice_call']),
  explicitChannel: channelSchema.optional(),
  languageMode: z.enum(['preferred', 'explicit', 'inferred']),
  language: languageSchema.optional(),
  toneMode: z.enum(['auto', 'explicit']),
  tone: toneSchema.optional(),
  templateKey: z.string().min(1),
  expectedOutcome: z.string().optional(),
  fallbackRule: z.string().optional(),
});

export const collectionFlowBlueprintSchema = z.object({
  blueprintId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  audienceCustomerIds: z.array(z.string().uuid()).max(200),
  steps: z.array(collectionFlowBlueprintStepSchema).min(1).max(12),
});

export const homeBrainPlanSchema = z.object({
  planVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  contextVersion: z.string().min(1),
  reasoningSummary: z.string().min(1),
  dashboard: dashboardDefinitionSchema,
  cards: z.array(recommendationCardSchema).max(12),
  flowBlueprints: z.array(collectionFlowBlueprintSchema).max(3),
  actionIntents: z.array(actionIntentSchema).max(16),
  internalAlerts: z.array(internalAlertDraftSchema).max(5),
});

export type HomeBrainPlan = z.infer<typeof homeBrainPlanSchema>;
export type RecommendationCard = z.infer<typeof recommendationCardSchema>;
export type ActionIntent = z.infer<typeof actionIntentSchema>;
export type ActionIntentType = ActionIntent['type'];
export type CollectionFlowBlueprint = z.infer<typeof collectionFlowBlueprintSchema>;
export type InternalAlertDraft = z.infer<typeof internalAlertDraftSchema>;
export type SendBulkRemindersPayload = z.infer<typeof sendBulkRemindersPayloadSchema>;
export type SwitchChannelPayload = z.infer<typeof switchChannelPayloadSchema>;
export type MaterializeFlowPayload = z.infer<typeof materializeFlowPayloadSchema>;
export type AssignFlowPayload = z.infer<typeof assignFlowPayloadSchema>;
export type NotifyManagementPayload = z.infer<typeof notifyManagementPayloadSchema>;
export type CreateAlertPayload = z.infer<typeof createAlertPayloadSchema>;
export type OpenQueuePayload = z.infer<typeof openQueuePayloadSchema>;

export interface PlanValidationReferences {
  knownCustomerIds: Set<string>;
  availableChannels: Set<'sms' | 'email' | 'whatsapp' | 'call_task'>;
}

function assertKnownCustomerIds(label: string, customerIds: string[], knownCustomerIds: Set<string>) {
  const unknownIds = customerIds.filter((customerId) => !knownCustomerIds.has(customerId));
  if (unknownIds.length > 0) {
    throw new ValidationError(`${label} references unknown customers: ${unknownIds.slice(0, 3).join(', ')}`);
  }
}

function assertChannelAllowed(label: string, channel: z.infer<typeof channelSchema>, availableChannels: Set<string>) {
  if (!availableChannels.has(channel)) {
    throw new ValidationError(`${label} uses unavailable channel "${channel}"`);
  }
}

export function validateHomeBrainPlan(rawPlan: unknown, refs: PlanValidationReferences): HomeBrainPlan {
  const parsed = homeBrainPlanSchema.safeParse(rawPlan);
  if (!parsed.success) {
    throw new ValidationError(`AI output validation failed: ${parsed.error.issues[0]?.message || 'invalid plan'}`);
  }

  const plan = parsed.data;
  const queueIds = new Set(plan.dashboard.queues.map((queue) => queue.queueId));
  const actionIntentIds = new Set(plan.actionIntents.map((intent) => intent.id));
  const blueprintIds = new Set(plan.flowBlueprints.map((blueprint) => blueprint.blueprintId));

  for (const queue of plan.dashboard.queues) {
    assertKnownCustomerIds(`Queue "${queue.queueId}"`, queue.customerIds, refs.knownCustomerIds);
  }

  for (const blueprint of plan.flowBlueprints) {
    assertKnownCustomerIds(`Blueprint "${blueprint.blueprintId}"`, blueprint.audienceCustomerIds, refs.knownCustomerIds);
    const seenStepKeys = new Set<string>();
    for (const step of blueprint.steps) {
      if (seenStepKeys.has(step.stepKey)) {
        throw new ValidationError(`Blueprint "${blueprint.blueprintId}" contains duplicate stepKey "${step.stepKey}"`);
      }
      seenStepKeys.add(step.stepKey);
      if (step.explicitChannel) {
        assertChannelAllowed(`Blueprint "${blueprint.blueprintId}"`, step.explicitChannel, refs.availableChannels);
      }
    }
  }

  for (const card of plan.cards) {
    assertKnownCustomerIds(`Card "${card.cardId}"`, card.targetCustomerIds, refs.knownCustomerIds);
    if (card.queueRef && !queueIds.has(card.queueRef)) {
      throw new ValidationError(`Card "${card.cardId}" references unknown queue "${card.queueRef}"`);
    }
    for (const actionIntentId of card.actionIntentIds) {
      if (!actionIntentIds.has(actionIntentId)) {
        throw new ValidationError(`Card "${card.cardId}" references unknown action intent "${actionIntentId}"`);
      }
    }
  }

  for (const intent of plan.actionIntents) {
    switch (intent.type) {
      case 'send_bulk_reminders':
        assertKnownCustomerIds(`Intent "${intent.id}"`, intent.payload.customerIds, refs.knownCustomerIds);
        assertChannelAllowed(`Intent "${intent.id}"`, intent.payload.channel, refs.availableChannels);
        break;
      case 'switch_channel_for_cohort':
        assertKnownCustomerIds(`Intent "${intent.id}"`, intent.payload.customerIds, refs.knownCustomerIds);
        assertChannelAllowed(`Intent "${intent.id}"`, intent.payload.fromChannel, refs.availableChannels);
        assertChannelAllowed(`Intent "${intent.id}"`, intent.payload.toChannel, refs.availableChannels);
        break;
      case 'assign_flow_to_customers':
        assertKnownCustomerIds(`Intent "${intent.id}"`, intent.payload.customerIds, refs.knownCustomerIds);
        break;
      case 'materialize_collection_flow':
        if (!blueprintIds.has(intent.payload.blueprintId)) {
          throw new ValidationError(
            `Intent "${intent.id}" references unknown blueprint "${intent.payload.blueprintId}"`
          );
        }
        break;
      case 'open_queue':
        if (!queueIds.has(intent.payload.queueId)) {
          throw new ValidationError(`Intent "${intent.id}" references unknown queue "${intent.payload.queueId}"`);
        }
        break;
      case 'notify_management':
      case 'create_internal_alert':
        break;
      default:
        throw new ValidationError(`Unsupported action intent type "${(intent as { type: string }).type}"`);
    }
  }

  return plan;
}
