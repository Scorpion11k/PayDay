import { GoogleGenerativeAI } from '@google/generative-ai';
import { TemplateLanguage, TemplateTone } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { AppError, ValidationError } from '../types';
import activityService from './activity.service';
import flowDefinitionService from './flow-definition.service';
import flowMaterializerService from './home-brain/flow-materializer.service';
import emailService from './email.service';
import smsService from './sms.service';
import whatsappService from './whatsapp.service';
import kolKasherService from './kol-kasher.service';
import systemSettingsService from './system-settings.service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const promptFlowStepSchema = z.object({
  stepKey: z.string().min(1),
  waitSecondsFromPrevious: z.number().int().min(0),
  actionType: z.enum(['assigned_channel', 'send_email', 'send_sms', 'send_whatsapp', 'voice_call']),
  explicitChannel: z.enum(['email', 'sms', 'whatsapp', 'call_task']).optional(),
  languageMode: z.enum(['preferred', 'explicit', 'inferred']),
  language: z.enum(['en', 'he', 'ar']).optional(),
  toneMode: z.enum(['auto', 'explicit']),
  tone: z.enum(['calm', 'medium', 'heavy']).optional(),
  templateKey: z.string().min(1),
});

const promptBlueprintSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(promptFlowStepSchema).min(1).max(10),
});

const flowPromptModelResponseSchema = z.object({
  assistantMessage: z.string().min(1),
  blueprint: promptBlueprintSchema,
});

type PromptBlueprint = z.infer<typeof promptBlueprintSchema>;
type PromptStep = PromptBlueprint['steps'][number];
type PromptActionType = PromptStep['actionType'];
type SupportedChannel = 'email' | 'sms' | 'whatsapp' | 'call_task';

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
  steps: PromptStep[];
}

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

function unitToSeconds(value: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized.startsWith('week')) return value * 7 * 86400;
  if (normalized.startsWith('day')) return value * 86400;
  if (normalized.startsWith('hour')) return value * 3600;
  if (normalized.startsWith('minute')) return value * 60;
  return value;
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

function actionTypeToChannel(actionType: PromptActionType): SupportedChannel {
  switch (actionType) {
    case 'send_email':
      return 'email';
    case 'send_sms':
      return 'sms';
    case 'send_whatsapp':
      return 'whatsapp';
    case 'voice_call':
      return 'call_task';
    case 'assigned_channel':
    default:
      return 'email';
  }
}

function parseToneFromText(text: string): TemplateTone | undefined {
  const normalized = text.toLowerCase();
  if (/(escalated|heavy|urgent|final|strong|strict|legal)/.test(normalized)) return 'heavy';
  if (/(medium|firm)/.test(normalized)) return 'medium';
  if (/(calm|soft|gentle|friendly)/.test(normalized)) return 'calm';
  return undefined;
}

function parseLanguageFromText(text: string): TemplateLanguage | undefined {
  const normalized = text.toLowerCase();
  if (/(hebrew|עברית)/.test(normalized)) return 'he';
  if (/(arabic|عربي)/.test(normalized)) return 'ar';
  if (/(english)/.test(normalized)) return 'en';
  return undefined;
}

function detectChannel(text: string): SupportedChannel | null {
  const normalized = text.toLowerCase();
  if (/(whatsapp|wa\b)/.test(normalized)) return 'whatsapp';
  if (/(sms|text message|text\b)/.test(normalized)) return 'sms';
  if (/(email|e-mail|\bmail\b)/.test(normalized)) return 'email';
  if (/(voice call|phone call|call task)/.test(normalized)) return 'call_task';
  return null;
}

function extractFlowName(prompt: string): { sanitizedPrompt: string; flowName?: string } {
  const patterns = [
    /(?:call|name)\s+(?:this\s+)?flow\s+["']?([^"'.\n]+)["']?/i,
    /(?:call|name)\s+it\s+["']?([^"'.\n]+)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match) {
      const flowName = match[1].trim();
      const sanitizedPrompt = prompt.replace(match[0], '').replace(/\s+/g, ' ').trim();
      return { sanitizedPrompt, flowName };
    }
  }

  return { sanitizedPrompt: prompt.trim() };
}

function inferFlowName(prompt: string, locale: 'en' | 'he') {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 48) return trimmed;
  return locale === 'he' ? 'טיוטת תהליך AI' : 'AI prompt flow draft';
}

function splitPromptIntoClauses(prompt: string) {
  const normalized = prompt
    .replace(/\band after another\b/gi, '|after another')
    .replace(/\band then\b/gi, '|then')
    .replace(/,\s*/g, '|');

  return normalized
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseWaitSecondsFromText(text: string): number | null {
  const match = text.match(/(?:after|in)(?:\s+another)?\s+(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?)/i);
  if (!match) return null;
  return unitToSeconds(Number(match[1]), match[2]);
}

function buildPromptStep(
  clause: string,
  index: number,
  defaults: { language?: TemplateLanguage; tone?: TemplateTone }
): PromptStep | null {
  const channel = detectChannel(clause);
  if (!channel) return null;

  const localTone = parseToneFromText(clause);
  const localLanguage = parseLanguageFromText(clause);
  return {
    stepKey: normalizeKey(`step_${index + 1}_${channel}`) || `step_${index + 1}`,
    waitSecondsFromPrevious: index === 0 ? 0 : Math.max(0, parseWaitSecondsFromText(clause) ?? 0),
    actionType: channelToActionType(channel),
    explicitChannel: channel,
    languageMode: localLanguage || defaults.language ? 'explicit' : 'preferred',
    language: localLanguage || defaults.language,
    toneMode: localTone || defaults.tone ? 'explicit' : 'auto',
    tone: localTone || defaults.tone,
    templateKey: 'debt_reminder',
  };
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

  let previousStateKey: string | null = null;
  const steps = orderedStates
    .filter((state) => state.actionType !== 'none')
    .map((state, index) => {
      const incomingWaitSeconds =
        index === 0 || !previousStateKey ? 0 : transitionsByFromKey.get(previousStateKey)?.waitSeconds || 0;
      previousStateKey = state.stateKey;
      return {
        stepKey: state.stateKey,
        waitSecondsFromPrevious: incomingWaitSeconds,
        actionType: state.actionType as PromptActionType,
        explicitChannel: (state.explicitChannel || actionTypeToChannel(state.actionType as PromptActionType)) as PromptStep['explicitChannel'],
        languageMode: 'preferred' as const,
        toneMode: state.tone ? ('explicit' as const) : ('auto' as const),
        tone: state.tone || undefined,
        templateKey: 'debt_reminder',
      };
    });

  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    steps,
  };
}

function buildFallbackCreateBlueprint(
  prompt: string,
  locale: 'en' | 'he',
  flowName?: string
): { assistantMessage: string; blueprint: PromptBlueprint } {
  const { sanitizedPrompt } = extractFlowName(prompt);
  const clauses = splitPromptIntoClauses(sanitizedPrompt);
  const defaults = {
    language: parseLanguageFromText(sanitizedPrompt),
    tone: parseToneFromText(sanitizedPrompt),
  };

  const steps = clauses
    .map((clause, index) => buildPromptStep(clause, index, defaults))
    .filter((step): step is PromptStep => Boolean(step));

  const baseSteps: PromptStep[] = steps.length > 0
    ? steps
    : [
        {
          stepKey: 'step_1_email',
          waitSecondsFromPrevious: 0,
          actionType: 'send_email',
          explicitChannel: 'email',
          languageMode: defaults.language ? 'explicit' : 'preferred',
          language: defaults.language,
          toneMode: defaults.tone ? 'explicit' : 'auto',
          tone: defaults.tone || 'medium',
          templateKey: 'debt_reminder',
        },
      ];

  const normalizedSteps: PromptStep[] = baseSteps.map((step, index) => ({
    ...step,
    stepKey: normalizeKey(step.stepKey) || `step_${index + 1}`,
  }));

  return {
    assistantMessage:
      locale === 'he'
        ? `יצרתי טיוטת תהליך עם ${normalizedSteps.length} שלבים. ניתן להמשיך לעדכן אותה בצ'אט.`
        : `I created a ${normalizedSteps.length}-step draft flow. You can keep refining it in chat.`,
    blueprint: {
      name: flowName || inferFlowName(sanitizedPrompt, locale),
      description:
        locale === 'he'
          ? `טיוטת תהליך שנוצרה מהפרומפט: ${prompt}`
          : `Draft flow generated from prompt: ${prompt}`,
      steps: normalizedSteps,
    },
  };
}

function buildFallbackRefinedBlueprint(
  prompt: string,
  locale: 'en' | 'he',
  existingDraft: ExistingDraftSummary,
  flowName?: string
): { assistantMessage: string; blueprint: PromptBlueprint } {
  const { sanitizedPrompt } = extractFlowName(prompt);
  const lowered = sanitizedPrompt.toLowerCase();
  const globalTone = parseToneFromText(sanitizedPrompt);
  const globalLanguage = parseLanguageFromText(sanitizedPrompt);

  let steps = existingDraft.steps.map((step) => ({ ...step }));

  if (globalTone) {
    steps = steps.map((step) => ({
      ...step,
      toneMode: 'explicit',
      tone: globalTone,
    }));
  }

  if (globalLanguage) {
    steps = steps.map((step) => ({
      ...step,
      languageMode: 'explicit',
      language: globalLanguage,
    }));
  }

  const addPattern =
    /add\s+(?:another\s+)?(?:an?\s+)?(whatsapp|sms|email|voice call|phone call|call task)(?:\s+message)?(?:.*?tone\s+(calm|medium|heavy|escalated|friendly|firm|urgent))?.*?(?:after|in)(?:\s+another)?\s+(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?)/gi;
  const addMatches = Array.from(lowered.matchAll(addPattern));
  for (const match of addMatches) {
    const rawChannel = match[1];
    const channel =
      rawChannel === 'voice call' || rawChannel === 'phone call' || rawChannel === 'call task'
        ? 'call_task'
        : (rawChannel as SupportedChannel);
    const tone = parseToneFromText(match[2] || '') || globalTone || 'medium';
    steps.push({
      stepKey: normalizeKey(`step_${steps.length + 1}_${channel}`),
      waitSecondsFromPrevious: unitToSeconds(Number(match[3]), match[4]),
      actionType: channelToActionType(channel),
      explicitChannel: channel,
      languageMode: globalLanguage ? 'explicit' : 'preferred',
      language: globalLanguage,
      toneMode: 'explicit',
      tone,
      templateKey: 'debt_reminder',
    });
  }

  const removeMatches = Array.from(
    lowered.matchAll(/remove\s+(whatsapp|sms|email|voice call|phone call|call task)/g)
  );
  for (const match of removeMatches) {
    const rawChannel = match[1];
    const channel =
      rawChannel === 'voice call' || rawChannel === 'phone call' || rawChannel === 'call task'
        ? 'call_task'
        : (rawChannel as SupportedChannel);
    steps = steps.filter((step) => step.explicitChannel !== channel);
  }

  const normalizedSteps = steps.map((step, index) => ({
    ...step,
    stepKey: normalizeKey(step.stepKey) || `step_${index + 1}`,
  }));

  return {
    assistantMessage:
      locale === 'he'
        ? `עדכנתי את טיוטת התהליך ל-${normalizedSteps.length} שלבים.`
        : `I updated the draft flow to ${normalizedSteps.length} steps.`,
    blueprint: {
      name: flowName || existingDraft.name,
      description:
        locale === 'he'
          ? `טיוטת תהליך שנוצרה מהפרומפט: ${prompt}`
          : `Draft flow generated from prompt: ${prompt}`,
      steps: normalizedSteps,
    },
  };
}

function buildFallbackBlueprint(
  prompt: string,
  locale: 'en' | 'he',
  existingDraft?: ExistingDraftSummary | null
): { assistantMessage: string; blueprint: PromptBlueprint } {
  const { flowName } = extractFlowName(prompt);
  return existingDraft
    ? buildFallbackRefinedBlueprint(prompt, locale, existingDraft, flowName)
    : buildFallbackCreateBlueprint(prompt, locale, flowName);
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
      '- Use waitSecondsFromPrevious as the relative delay from the prior step',
      '- The first step must have waitSecondsFromPrevious = 0',
      '- If language is not explicitly requested, use preferred language mode',
      '- If tone is not explicitly requested, choose a reasonable explicit tone',
      '- If the user names the flow (for example: "call this flow gil test 3"), set blueprint.name to that exact name',
      '- Do not treat a naming instruction as a voice call step',
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
              waitSecondsFromPrevious: 0,
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
      if (step.waitSecondsFromPrevious < 0) {
        throw new ValidationError('Step waitSecondsFromPrevious must be non-negative');
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
