import {
  CollectionFlowActionType,
  NotificationChannel,
  TemplateTone,
} from '@prisma/client';
import flowDefinitionService from '../flow-definition.service';
import type { CollectionFlowBlueprint } from './plan-validator';

interface MaterializeFlowInput {
  planId: string;
  cardId: string;
  blueprint: CollectionFlowBlueprint;
  flowName?: string;
  description?: string;
}

interface StandaloneBlueprint {
  name: string;
  description?: string;
  steps: Array<{
    stepKey: string;
    waitSecondsFromPrevious: number;
    actionType: 'assigned_channel' | 'send_email' | 'send_sms' | 'send_whatsapp' | 'voice_call';
    explicitChannel?: 'email' | 'sms' | 'whatsapp' | 'call_task';
    languageMode: 'preferred' | 'explicit' | 'inferred';
    language?: 'en' | 'he' | 'ar';
    toneMode: 'auto' | 'explicit';
    tone?: 'calm' | 'medium' | 'heavy';
    templateKey: string;
  }>;
}

interface MaterializeStandaloneFlowInput {
  blueprint: StandaloneBlueprint;
  flowName?: string;
  description?: string;
  createdBy?: string;
}

interface UpdateStandaloneFlowInput {
  flowId: string;
  blueprint: StandaloneBlueprint;
  flowName?: string;
  description?: string;
  updatedBy?: string;
}

function buildActionLabel(actionType: CollectionFlowActionType, dayOffset: number): string {
  const prefix = `Day ${dayOffset}`;
  switch (actionType) {
    case 'assigned_channel':
      return `${prefix} Assigned channel`;
    case 'send_email':
      return `${prefix} Email`;
    case 'send_sms':
      return `${prefix} SMS`;
    case 'send_whatsapp':
      return `${prefix} WhatsApp`;
    case 'voice_call':
      return `${prefix} Voice call`;
    default:
      return `${prefix} Action`;
  }
}

function formatWaitLabel(waitSeconds: number): string {
  if (waitSeconds <= 0) return 'Immediate';
  if (waitSeconds % 86400 === 0) return `Wait ${waitSeconds / 86400} day(s)`;
  if (waitSeconds % 3600 === 0) return `Wait ${waitSeconds / 3600} hour(s)`;
  if (waitSeconds % 60 === 0) return `Wait ${waitSeconds / 60} minute(s)`;
  return `Wait ${waitSeconds} second(s)`;
}

function formatCumulativePrefix(totalWaitSeconds: number): string {
  if (totalWaitSeconds <= 0) return 'Immediate';
  if (totalWaitSeconds % 86400 === 0) return `Day ${totalWaitSeconds / 86400}`;
  if (totalWaitSeconds % 3600 === 0) return `Hour ${totalWaitSeconds / 3600}`;
  if (totalWaitSeconds % 60 === 0) return `Minute ${totalWaitSeconds / 60}`;
  return `${totalWaitSeconds}s`;
}

function standaloneActionLabel(actionType: CollectionFlowActionType): string {
  switch (actionType) {
    case 'assigned_channel':
      return 'Assigned channel';
    case 'send_email':
      return 'Email';
    case 'send_sms':
      return 'SMS';
    case 'send_whatsapp':
      return 'WhatsApp';
    case 'voice_call':
      return 'Voice call';
    default:
      return 'Action';
  }
}

function mapExplicitTone(toneMode: 'auto' | 'explicit', tone?: 'calm' | 'medium' | 'heavy'): TemplateTone | null {
  if (toneMode !== 'explicit') {
    return null;
  }
  return tone || null;
}

function mapExplicitChannel(
  actionType: CollectionFlowActionType,
  explicitChannel?: 'email' | 'sms' | 'whatsapp' | 'call_task'
): NotificationChannel | null {
  if (explicitChannel) {
    return explicitChannel;
  }
  switch (actionType) {
    case 'send_email':
      return 'email';
    case 'send_sms':
      return 'sms';
    case 'send_whatsapp':
      return 'whatsapp';
    case 'voice_call':
      return 'call_task';
    default:
      return null;
  }
}

class FlowMaterializerService {
  private buildDefinition(steps: CollectionFlowBlueprint['steps']) {
    const sortedSteps = [...steps].sort((a, b) => a.dayOffset - b.dayOffset);
    const states = sortedSteps.map((step, index) => {
      const actionType = step.actionType as CollectionFlowActionType;
      const actionLabel = buildActionLabel(actionType, step.dayOffset);
      return {
        stateKey: step.stepKey,
        stateName: actionLabel,
        actionName: actionLabel,
        actionType,
        tone: mapExplicitTone(step.toneMode, step.tone),
        explicitChannel: mapExplicitChannel(actionType, step.explicitChannel),
        isStart: index === 0,
        isEnd: index === sortedSteps.length - 1,
        positionX: index * 240,
        positionY: 80,
      };
    });

    const transitions = sortedSteps.slice(1).map((step, index) => {
      const previous = sortedSteps[index];
      return {
        fromStateKey: previous.stepKey,
        toStateKey: step.stepKey,
        waitSeconds: Math.max(0, step.dayOffset - previous.dayOffset) * 86400,
        label: `Wait ${Math.max(0, step.dayOffset - previous.dayOffset)} day(s)`,
        priority: 1,
      };
    });

    return { sortedSteps, states, transitions };
  }

  async materialize(input: MaterializeFlowInput) {
    const { sortedSteps, states, transitions } = this.buildDefinition(input.blueprint.steps);
    const description = JSON.stringify({
      planId: input.planId,
      cardId: input.cardId,
      blueprintId: input.blueprint.blueprintId,
      originalSteps: sortedSteps,
      notes: 'AI-generated flow draft. Template and language metadata preserved here for audit only.',
    });

    return flowDefinitionService.create({
      flowKey: `ai_generated_${Date.now()}`,
      name: input.flowName || input.blueprint.name,
      description: input.description || description,
      createdBy: 'home_brain',
      states,
      transitions,
    });
  }

  async materializeStandaloneDraft(input: MaterializeStandaloneFlowInput) {
    const cumulativeOffsets: number[] = [];
    let runningSeconds = 0;
    const states = input.blueprint.steps.map((step, index) => {
      runningSeconds += Math.max(0, step.waitSecondsFromPrevious || 0);
      cumulativeOffsets.push(runningSeconds);
      const actionType = step.actionType as CollectionFlowActionType;
      const prefix = formatCumulativePrefix(runningSeconds);
      const actionLabel = standaloneActionLabel(actionType);
      return {
        stateKey: step.stepKey,
        stateName: `${prefix} ${actionLabel}`.trim(),
        actionName: `${prefix} ${actionLabel}`.trim(),
        actionType,
        tone: mapExplicitTone(step.toneMode, step.tone),
        explicitChannel: mapExplicitChannel(actionType, step.explicitChannel),
        isStart: index === 0,
        isEnd: index === input.blueprint.steps.length - 1,
        positionX: index * 240,
        positionY: 80,
      };
    });
    const transitions = input.blueprint.steps.slice(1).map((step, index) => ({
      fromStateKey: input.blueprint.steps[index].stepKey,
      toStateKey: step.stepKey,
      waitSeconds: Math.max(0, step.waitSecondsFromPrevious || 0),
      label: formatWaitLabel(Math.max(0, step.waitSecondsFromPrevious || 0)),
      priority: 1,
    }));
    return flowDefinitionService.create({
      flowKey: `ai_prompt_${Date.now()}`,
      name: input.flowName || input.blueprint.name,
      description: input.description || input.blueprint.description || null,
      createdBy: input.createdBy || 'home_brain',
      states,
      transitions,
    });
  }

  async updateStandaloneDraft(input: UpdateStandaloneFlowInput) {
    let runningSeconds = 0;
    const states = input.blueprint.steps.map((step, index) => {
      runningSeconds += Math.max(0, step.waitSecondsFromPrevious || 0);
      const actionType = step.actionType as CollectionFlowActionType;
      const prefix = formatCumulativePrefix(runningSeconds);
      const actionLabel = standaloneActionLabel(actionType);
      return {
        stateKey: step.stepKey,
        stateName: `${prefix} ${actionLabel}`.trim(),
        actionName: `${prefix} ${actionLabel}`.trim(),
        actionType,
        tone: mapExplicitTone(step.toneMode, step.tone),
        explicitChannel: mapExplicitChannel(actionType, step.explicitChannel),
        isStart: index === 0,
        isEnd: index === input.blueprint.steps.length - 1,
        positionX: index * 240,
        positionY: 80,
      };
    });
    const transitions = input.blueprint.steps.slice(1).map((step, index) => ({
      fromStateKey: input.blueprint.steps[index].stepKey,
      toStateKey: step.stepKey,
      waitSeconds: Math.max(0, step.waitSecondsFromPrevious || 0),
      label: formatWaitLabel(Math.max(0, step.waitSecondsFromPrevious || 0)),
      priority: 1,
    }));
    return flowDefinitionService.update(input.flowId, {
      name: input.flowName || input.blueprint.name,
      description: input.description || input.blueprint.description || null,
      updatedBy: input.updatedBy || 'home_brain',
      states,
      transitions,
    });
  }
}

export default new FlowMaterializerService();
