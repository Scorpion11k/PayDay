import { GoogleGenerativeAI } from '@google/generative-ai';
import { CollectionFlowActionType, TemplateLanguage, TemplateTone } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { AppError, ValidationError } from '../types';
import activityService from './activity.service';
import flowDefinitionService from './flow-definition.service';
import flowMaterializerService from './home-brain/flow-materializer.service';
import { collectionFlowBlueprintStepSchema } from './home-brain/plan-validator';
import emailService from './email.service';
import smsService from './sms.service';
import whatsappService from './whatsapp.service';
import kolKasherService from './kol-kasher.service';
import systemSettingsService from './system-settings.service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const promptBlueprintSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(collectionFlowBlueprintStepSchema).min(1).max(10),
});

const flowPromptModelResponseSchema = z.object({
  assistantMessage: z.string().min(1),
  blueprint: promptBlueprintSchema,
});

type PromptBlueprint = z.infer<typeof promptBlueprintSchema>;

interface GenerateFlowFromPromptInput {
  prompt: string;
  locale: 'en' | 'he';
  flowId?: string;
  createdBy?: string;
}

interface ExistingDraftSummary {
  id: string;
  name: string;
  description?: string | null;
  steps: PromptBlueprint['steps'];
}

type SupportedChannel = 'email' | 'sms' | 'whatsapp' | 'call_task';
type PromptActionType = PromptBlueprint['steps'][number]['actionType'];

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function cleanJsonResponse(responseText: string): unknown {
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim()) as unknown;
}

function parseTone(prompt: string): TemplateTone {
  const text = prompt.toLowerCase();
  if (/(calm|soft|gentle|friendly)/.test(text)) return 'calm';
  if (/(heavy|urgent|final|strong|strict|legal)/.test(text)) return 'heavy';
  if (/(medium|firm)/.test(text)) return 'medium';
  return 'medium';
}

function parseLanguage(prompt: string): TemplateLanguage | undefined {
  const text = prompt.toLowerCase();
  if (/(hebrew|עברית)/.test(text)) return 'he';
  if (/(arabic|عربي)/.test(text)) return 'ar';
  if (/(english)/.test(text)) return 'en';
  return undefined;
}

function channelToActionType(channel: SupportedChannel): PromptActionType {
  switch (channel) {
    case 'email':
      return 'send_email';
    case 'sms':
      return 'send_sms';
    case 'whatsapp':
      return 'send_whatsapp';
    case 'call_task':
      return 'voice_call';
  }
}

function inferFlowName(prompt: string, locale: 'en' | 'he') {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 48) return trimmed;
  return locale === 'he' ? 'טיוטת תהליך AI' : 'AI prompt flow draft';
}

function segmentPrompt(prompt: string) {
  return prompt
    .split(/[\n,.]+|\band\b/gi)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseDayOffset(segment: string): number | null {
  const text = segment.toLowerCase();
  if (/(immediately|right away|day 0|same day|right now|start)/.test(text)) return 0;
  const afterMatch = text.match(/(?:after|in)\s+(\d+)\s*(day|days|week|weeks|hour|hours)/);
  if (afterMatch) {
    const value = Number(afterMatch[1]);
    const unit = afterMatch[2];
    if (unit.startsWith('week')) return value * 7;
    if (unit.startsWith('hour')) return 0;
    return value;
  }
  const dayMatch = text.match(/day\s*(\d+)/);
  if (dayMatch) return Number(dayMatch[1]);
  return null;
}

function detectChannel(segment: string): SupportedChannel | null {
  const text = segment.toLowerCase();
  if (/(whatsapp|wa\b)/.test(text)) return 'whatsapp';
  if (/(sms|text message|text\b)/.test(text)) return 'sms';
  if (/(email|e-mail|mail\b)/.test(text)) return 'email';
  if (/(voice|phone call|call task|call\b)/.test(text)) return 'call_task';
  return null;
}

function summarizeExistingDraft(flow: Awaited<ReturnType<typeof flowDefinitionService.getById>>): ExistingDraftSummary {
  const transitionsByFromKey = new Map(
    flow.transitions.map((transition) => [transition.fromState.stateKey, transition])
  );
  const startState = flow.states.find((state) => state.isStart) || flow.states[0];
  const orderedStates: typeof flow.states = [];
  let current: (typeof flow.states)[number] | null = startState;
  const visited = new Set<string>();

  while (current && !visited.has(current.stateKey)) {
    visited.add(current.stateKey);
    orderedStates.push(current);
    const nextTransition = transitionsByFromKey.get(current.stateKey);
    current = nextTransition
      ? flow.states.find((state) => state.id === nextTransition.toStateId) || null
      : null;
  }

  let dayOffset = 0;
  const steps = orderedStates
    .filter((state) => state.actionType !== 'none')
    .map((state) => {
      const outgoing = transitionsByFromKey.get(state.stateKey);
      const channel = state.explicitChannel || (state.actionType === 'send_email'
        ? 'email'
        : state.actionType === 'send_sms'
          ? 'sms'
          : state.actionType === 'send_whatsapp'
            ? 'whatsapp'
            : state.actionType === 'voice_call'
              ? 'call_task'
              : undefined);
      const step = {
        stepKey: state.stateKey,
        dayOffset,
        actionType: state.actionType as PromptBlueprint['steps'][number]['actionType'],
        explicitChannel: channel as PromptBlueprint['steps'][number]['explicitChannel'],
        languageMode: 'preferred' as const,
        toneMode: state.tone ? ('explicit' as const) : ('auto' as const),
        tone: state.tone || undefined,
        templateKey: 'debt_reminder',
      };
      dayOffset += Math.round((outgoing?.waitSeconds || 0) / 86400);
      return step;
    });

  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    steps,
  };
}

function buildFallbackBlueprint(
  prompt: string,
  locale: 'en' | 'he',
  existingDraft?: ExistingDraftSummary | null
): { assistantMessage: string; blueprint: PromptBlueprint } {
  const tone = parseTone(prompt);
  const language = parseLanguage(prompt);
  const lowered = prompt.toLowerCase();

  let steps = existingDraft ? [...existingDraft.steps] : [];

  if (steps.length === 0) {
    const segments = segmentPrompt(prompt);
    const parsedSteps = segments
      .map((segment, index) => {
        const channel = detectChannel(segment);
        if (!channel) return null;
        const dayOffset = parseDayOffset(segment);
        return {
          stepKey: normalizeKey(`step_${index + 1}_${channel}`) || `step_${index + 1}`,
          dayOffset: dayOffset ?? index * 3,
          actionType: channelToActionType(channel),
          explicitChannel: channel,
          languageMode: language ? ('explicit' as const) : ('preferred' as const),
          language,
          toneMode: 'explicit' as const,
          tone,
          templateKey: 'debt_reminder',
        };
      })
      .filter((step): step is NonNullable<typeof step> => Boolean(step));

    steps = parsedSteps.length
      ? parsedSteps
      : [
          {
            stepKey: 'day0_whatsapp',
            dayOffset: 0,
            actionType: 'send_whatsapp',
            explicitChannel: 'whatsapp',
            languageMode: language ? ('explicit' as const) : ('preferred' as const),
            language,
            toneMode: 'explicit' as const,
            tone,
            templateKey: 'debt_reminder',
          },
          {
            stepKey: 'day3_sms',
            dayOffset: 3,
            actionType: 'send_sms',
            explicitChannel: 'sms',
            languageMode: language ? ('explicit' as const) : ('preferred' as const),
            language,
            toneMode: 'explicit' as const,
            tone,
            templateKey: 'debt_reminder',
          },
          {
            stepKey: 'day7_voice',
            dayOffset: 7,
            actionType: 'voice_call',
            explicitChannel: 'call_task',
            languageMode: language ? ('explicit' as const) : ('preferred' as const),
            language,
            toneMode: 'explicit' as const,
            tone: 'heavy',
            templateKey: 'debt_reminder',
          },
        ];
  } else {
    if (/(calm|soft|gentle|friendly|medium|firm|heavy|urgent|strong|strict|legal)/.test(lowered)) {
      steps = steps.map((step) => ({
        ...step,
        toneMode: 'explicit',
        tone: step.actionType === 'voice_call' && tone === 'calm' ? 'medium' : tone,
      }));
    }

    const addMatches = Array.from(
      lowered.matchAll(/add\s+(whatsapp|sms|email|voice|call)\s+(?:after|in)\s+(\d+)\s*(day|days|week|weeks|hour|hours)/g)
    );
    for (const match of addMatches) {
      const channelToken = match[1];
      const channel = channelToken === 'voice' || channelToken === 'call' ? 'call_task' : (channelToken as SupportedChannel);
      const value = Number(match[2]);
      const unit = match[3];
      const dayOffset = unit.startsWith('week') ? value * 7 : unit.startsWith('hour') ? 0 : value;
      steps.push({
        stepKey: normalizeKey(`step_${steps.length + 1}_${channel}`),
        dayOffset,
        actionType: channelToActionType(channel),
        explicitChannel: channel,
        languageMode: language ? ('explicit' as const) : ('preferred' as const),
        language,
        toneMode: 'explicit' as const,
        tone,
        templateKey: 'debt_reminder',
      });
    }

    const removeMatches = Array.from(lowered.matchAll(/remove\s+(whatsapp|sms|email|voice|call)/g));
    for (const match of removeMatches) {
      const channelToken = match[1];
      const channel = channelToken === 'voice' || channelToken === 'call' ? 'call_task' : (channelToken as SupportedChannel);
      steps = steps.filter((step) => step.explicitChannel !== channel);
    }

    if (language) {
      steps = steps.map((step) => ({
        ...step,
        languageMode: 'explicit',
        language,
      }));
    }
  }

  const deduped = [...steps]
    .sort((a, b) => a.dayOffset - b.dayOffset || a.stepKey.localeCompare(b.stepKey))
    .map((step, index) => ({
      ...step,
      stepKey: normalizeKey(step.stepKey) || `step_${index + 1}`,
    }))
    .filter((step, index, array) => array.findIndex((candidate) => candidate.stepKey === step.stepKey) === index);

  const name = existingDraft?.name || inferFlowName(prompt, locale);
  const description = locale === 'he'
    ? `טיוטת תהליך שנוצרה מהפרומפט: ${prompt}`
    : `Draft flow generated from prompt: ${prompt}`;

  return {
    assistantMessage: locale === 'he'
      ? `יצרתי טיוטת תהליך עם ${deduped.length} שלבים. ניתן להמשיך לעדכן אותה בצ'אט.`
      : `I created a ${deduped.length}-step draft flow. You can keep refining it in chat.`,
    blueprint: {
      name,
      description,
      steps: deduped,
    },
  };
}

class FlowPromptService {
  private async getFlowContext(flowId?: string): Promise<ExistingDraftSummary | null> {
    if (!flowId) return null;
    const flow = await flowDefinitionService.getById(flowId);
    if (flow.status !== 'draft') {
      throw new ValidationError('Only draft flows can be refined with prompts');
    }
    return summarizeExistingDraft(flow);
  }

  private async getAvailabilitySummary() {
    const mode = await systemSettingsService.getMode();
    await Promise.all([
      emailService.initialize(),
      smsService.initialize(),
      whatsappService.initialize(),
      kolKasherService.initialize(),
    ]);

    const availableChannels: SupportedChannel[] = [
      mode === 'development' || emailService.isAvailable() ? 'email' : null,
      mode === 'development' || smsService.isAvailable() ? 'sms' : null,
      mode === 'development' || whatsappService.isAvailable() ? 'whatsapp' : null,
      mode === 'development' || kolKasherService.isAvailable() ? 'call_task' : null,
    ].filter((value): value is SupportedChannel => Boolean(value));

    const templates = await prisma.messageTemplate.findMany({
      where: { status: 'active', key: 'debt_reminder' },
      select: { channel: true, language: true, tone: true },
      orderBy: [{ channel: 'asc' }, { language: 'asc' }, { tone: 'asc' }],
    });

    return { mode, availableChannels, templates };
  }

  private buildPrompt(
    userPrompt: string,
    locale: 'en' | 'he',
    availability: Awaited<ReturnType<FlowPromptService['getAvailabilitySummary']>>,
    existingDraft: ExistingDraftSummary | null
  ) {
    return [
      'You are a collection-flow design assistant for PayDay AI.',
      'Return JSON only.',
      `User locale: ${locale}.`,
      'Create or refine a collection flow draft from the user prompt.',
      'Use conservative behavior only: generate a draft flow; do not publish or assign it.',
      'Important platform constraints:',
      '- Only these action types are allowed: assigned_channel, send_email, send_sms, send_whatsapp, voice_call',
      '- Use templateKey "debt_reminder" for every step',
      '- Prefer a simple linear sequence of steps',
      '- Day offsets must be integers and non-decreasing',
      '- If language is not explicitly requested, use preferred language mode',
      '- If tone is not explicitly requested, choose a reasonable explicit tone',
      `Available channels now: ${availability.availableChannels.join(', ') || 'none'}`,
      `Available debt_reminder templates: ${JSON.stringify(availability.templates)}`,
      existingDraft ? `Current draft being refined: ${JSON.stringify(existingDraft)}` : 'No existing draft yet.',
      `User prompt: ${userPrompt}`,
      'Return shape:',
      JSON.stringify({
        assistantMessage: 'short natural-language summary in the user locale',
        blueprint: {
          name: 'flow name',
          description: 'optional description',
          steps: [
            {
              stepKey: 'day0_whatsapp',
              dayOffset: 0,
              actionType: 'send_whatsapp',
              explicitChannel: 'whatsapp',
              languageMode: 'preferred',
              toneMode: 'explicit',
              tone: 'medium',
              templateKey: 'debt_reminder',
            },
          ],
        },
      }),
    ].join('\n');
  }

  private async generateWithAi(
    input: GenerateFlowFromPromptInput,
    availability: Awaited<ReturnType<FlowPromptService['getAvailabilitySummary']>>,
    existingDraft: ExistingDraftSummary | null
  ) {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(
      this.buildPrompt(input.prompt, input.locale, availability, existingDraft)
    );
    const responseText = result.response.text();
    if (!responseText) {
      throw new AppError('AI service unavailable', 502);
    }
    return cleanJsonResponse(responseText);
  }

  private shouldUseFallback() {
    return process.env.FLOW_PROMPT_USE_MOCK === '1' || !process.env.GEMINI_API_KEY;
  }

  async generateDraftFromPrompt(input: GenerateFlowFromPromptInput) {
    const existingDraft = await this.getFlowContext(input.flowId);
    const availability = await this.getAvailabilitySummary();

    const modelResponse = this.shouldUseFallback()
      ? buildFallbackBlueprint(input.prompt, input.locale, existingDraft)
      : await this.generateWithAi(input, availability, existingDraft).catch(() =>
          buildFallbackBlueprint(input.prompt, input.locale, existingDraft)
        );

    const parsed = flowPromptModelResponseSchema.safeParse(modelResponse);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid flow blueprint response');
    }

    const validTemplatePairs = new Set(
      availability.templates.map((template) => `${template.channel}:${template.language}:${template.tone}`)
    );
    for (const step of parsed.data.blueprint.steps) {
      if (step.explicitChannel && !availability.availableChannels.includes(step.explicitChannel)) {
        throw new ValidationError(`Channel "${step.explicitChannel}" is unavailable`);
      }
      if (step.languageMode === 'explicit' && step.language && step.tone) {
        const key = `${step.explicitChannel || (step.actionType === 'send_email'
          ? 'email'
          : step.actionType === 'send_sms'
            ? 'sms'
            : step.actionType === 'send_whatsapp'
              ? 'whatsapp'
              : 'call_task')}:${step.language}:${step.tone}`;
        if (step.explicitChannel !== 'call_task' && !validTemplatePairs.has(key)) {
          throw new ValidationError(`No active debt_reminder template for ${key}`);
        }
      }
    }

    const flow = existingDraft
      ? await flowMaterializerService.updateStandaloneDraft({
          flowId: existingDraft.id,
          blueprint: parsed.data.blueprint,
          flowName: parsed.data.blueprint.name,
          description: parsed.data.blueprint.description,
          updatedBy: input.createdBy || 'ui',
        })
      : await flowMaterializerService.materializeStandaloneDraft({
          blueprint: parsed.data.blueprint,
          flowName: parsed.data.blueprint.name,
          description: parsed.data.blueprint.description,
          createdBy: input.createdBy || 'ui',
        });

    if (!existingDraft) {
      await activityService.logCollectionFlowCreated({
        flowId: flow.id,
        flowName: flow.name,
        status: 'success',
        createdBy: input.createdBy || 'ui',
      }).catch(() => undefined);
    }

    return {
      assistantMessage: parsed.data.assistantMessage,
      flow,
      created: !existingDraft,
      updated: Boolean(existingDraft),
    };
  }
}

export default new FlowPromptService();
