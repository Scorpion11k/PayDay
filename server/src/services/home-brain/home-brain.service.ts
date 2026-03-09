import { GoogleGenerativeAI } from '@google/generative-ai';
import { Prisma, PrismaClient, type TemplateLanguage, type TemplateTone } from '@prisma/client';
import prisma from '../../config/database';
import { AppError, NotFoundError, ValidationError } from '../../types';
import activityService from '../activity.service';
import notificationDispatchService from '../notification-dispatch.service';
import { getDefaultTone } from '../preference.service';
import flowRuntimeService from '../flow-runtime.service';
import contextAssemblerService, {
  type HomeBrainContext,
  type HomeBrainFilters,
} from './context-assembler.service';
import flowMaterializerService from './flow-materializer.service';
import {
  homeBrainPlanSchema,
  validateHomeBrainPlan,
  type ActionIntent,
  type ActionIntentType,
  type CollectionFlowBlueprint,
  type HomeBrainPlan,
  type MaterializeFlowPayload,
  type RecommendationCard,
} from './plan-validator';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const db = prisma as unknown as PrismaClient;

const PROMPT_VERSION = 'home-brain-v1';
const PLAN_SURFACE = 'home';
const CACHE_WINDOW_MS = 60 * 60 * 1000;
const CARD_EXPIRATION_MS = 24 * 60 * 60 * 1000;
const PRIORITY_WEIGHT: Record<'critical' | 'high' | 'medium' | 'low', number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

type SupportedLocale = 'en' | 'he';

export interface GeneratePlanInput {
  locale: SupportedLocale;
  filters?: HomeBrainFilters;
  forceRefresh?: boolean;
  maxCards?: number;
}

export interface GeneratePlanResult {
  planId: string;
  status: 'generated';
  plan: HomeBrainPlan;
  cachedAt?: string;
}

export interface CardMutationInput {
  planId: string;
  performedBy?: string;
  modifications?: Record<string, unknown>;
  reason?: string;
}

function localizedCopy(locale: SupportedLocale) {
  if (locale === 'he') {
    return {
      dashboardTitle: 'מוקד הגבייה של היום',
      dashboardSubtitle: 'תוכנית פעולה דינמית שנבנתה מנתוני המערכת החיים',
      totalOverdue: 'סה"כ חוב באיחור',
      overdueCustomers: 'לקוחות באיחור',
      collectedToday: 'נגבה היום',
      criticalAccounts: 'חשבונות קריטיים',
      overdueTrend: 'דורש טיפול',
      actionQueue: 'פתח תור',
      reviewCustomers: 'בדוק לקוחות',
      sendReminders: 'שלח תזכורות',
      switchChannel: 'החלף ערוץ לקבוצה',
      materializeFlow: 'צור טיוטת תהליך',
      managementAlert: 'צור התראת הנהלה',
      whyNow: 'מדוע עכשיו',
      noActions: 'אין המלצות דחופות כרגע.',
      alertsTitle: 'התראת הנהלה',
      alertBody: 'מספר החשבונות הקריטיים גדל ונדרש מעקב תפעולי צמוד.',
      flowCardTitle: 'הכן תהליך אוטומטי להסלמת פיגורים',
      flowCardBody: 'טיוטת תהליך חדשה תתרגם את ההמלצה לרצף פעולות קיים ב-Flows.',
      switchCardTitle: 'העבר לקוחות שלא הגיבו מ-WhatsApp ל-SMS',
      switchCardBody: 'לקוחות אלה ממשיכים לצבור פיגור למרות ניסיונות WhatsApp קודמים.',
      reminderCardTitle: 'שלח תזכורות ללקוחות בעלי סיכון גבוה',
      reminderCardBody: 'הקבוצה המובילה כוללת לקוחות עם יתרה פתוחה, איחור וערוצי קשר זמינים.',
      queueCardTitle: 'תעדף את תור הסיכון הגבוה',
      queueCardBody: 'זהו התור עם פוטנציאל הגבייה המיידי הגבוה ביותר.',
      kpiSignals: ['פיגור', 'סיכון', 'יתרה פתוחה'],
      filterSegment: 'פלח',
      filterLanguage: 'שפה',
      filterMinOverdue: 'מינימום ימי איחור',
      groupingRisk: 'רמת סיכון',
      groupingLanguage: 'שפה',
    };
  }

  return {
    dashboardTitle: "Today's Collection Focus",
    dashboardSubtitle: 'Dynamic priorities assembled from live system data',
    totalOverdue: 'Total overdue',
    overdueCustomers: 'Overdue customers',
    collectedToday: 'Collected today',
    criticalAccounts: 'Critical accounts',
    overdueTrend: 'Needs action',
    actionQueue: 'Open queue',
    reviewCustomers: 'Review customers',
    sendReminders: 'Send reminders',
    switchChannel: 'Switch channel for cohort',
    materializeFlow: 'Create draft flow',
    managementAlert: 'Create management alert',
    whyNow: 'Why now',
    noActions: 'No urgent actions recommended at this time.',
    alertsTitle: 'Management alert',
    alertBody: 'Critical delinquency exposure is rising and needs closer operational review.',
    flowCardTitle: 'Prepare an escalation flow draft',
    flowCardBody: 'Create a draft collection flow from the AI blueprint for later publishing in Flows.',
    switchCardTitle: 'Shift non-responsive customers from WhatsApp to SMS',
    switchCardBody: 'These customers continue to miss engagement after prior WhatsApp outreach.',
    reminderCardTitle: 'Send reminders to the highest-risk cohort',
    reminderCardBody: 'The leading cohort combines open balance, overdue exposure, and reachable contact channels.',
    queueCardTitle: 'Review the highest-risk queue first',
    queueCardBody: 'This queue represents the most immediate collection opportunity.',
    kpiSignals: ['overdue', 'risk', 'open balance'],
    filterSegment: 'Segment',
    filterLanguage: 'Language',
    filterMinOverdue: 'Minimum overdue days',
    groupingRisk: 'Risk level',
    groupingLanguage: 'Preferred language',
  };
}

function normalizeFilters(filters: HomeBrainFilters = {}): HomeBrainFilters {
  return {
    segment: filters.segment || 'all',
    language: filters.language,
    minOverdueDays: filters.minOverdueDays,
  };
}

function cleanJsonResponse(responseText: string): unknown {
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim()) as unknown;
}

function sortCards(cards: RecommendationCard[]) {
  return [...cards].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
}

function emptyPlan(reasoningSummary: string): HomeBrainPlan {
  return {
    planVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    contextVersion: 'empty',
    reasoningSummary,
    dashboard: {
      title: 'Home',
      kpis: [],
      queues: [],
      filters: [],
      groupings: [],
    },
    cards: [],
    flowBlueprints: [],
    actionIntents: [],
    internalAlerts: [],
  };
}

function pickTemplateLanguage(context: HomeBrainContext, customerIds: string[]): 'en' | 'he' | 'ar' {
  const histogram = new Map<string, number>();
  const selected = context.customers.filter((customer) => customerIds.includes(customer.id));
  for (const customer of selected) {
    const language = customer.preferredLanguage || 'en';
    histogram.set(language, (histogram.get(language) || 0) + 1);
  }
  return (
    (Array.from(histogram.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] as 'en' | 'he' | 'ar' | undefined) || 'en'
  );
}

function pickToneForCustomers(context: HomeBrainContext, customerIds: string[]): TemplateTone {
  const selected = context.customers.filter((customer) => customerIds.includes(customer.id));
  const maxOverdue = Math.max(0, ...selected.map((customer) => customer.overdueDays));
  if (maxOverdue >= 30) return 'heavy';
  if (maxOverdue >= 14) return 'medium';
  return 'calm';
}

function pickChannelForCustomers(context: HomeBrainContext, customerIds: string[]): 'sms' | 'email' | 'whatsapp' | 'call_task' {
  const selected = context.customers.filter((customer) => customerIds.includes(customer.id));
  const preferredOrder: Array<'whatsapp' | 'sms' | 'email' | 'call_task'> = ['whatsapp', 'sms', 'email', 'call_task'];
  for (const channel of preferredOrder) {
    if (selected.every((customer) => customer.eligibleChannels.includes(channel))) {
      return channel;
    }
  }
  return selected[0]?.eligibleChannels[0] || 'email';
}

function buildMockPlan(context: HomeBrainContext, locale: SupportedLocale, maxCards: number): HomeBrainPlan {
  if (!context.customers.length) {
    return emptyPlan(locale === 'he' ? 'לא נמצאו המלצות דחופות בזמן זה.' : 'No urgent actions recommended at this time.');
  }

  const copy = localizedCopy(locale);
  const queues = context.cohorts.slice(0, 4).map((cohort) => ({
    queueId: cohort.cohortId,
    title: cohort.label,
    description: `${cohort.count} customers • avg overdue ${cohort.avgOverdueDays}d`,
    count: cohort.count,
    customerIds: cohort.sampleCustomerIds,
    priority: cohort.riskLevel,
  }));

  const actionIntents: ActionIntent[] = [];
  const cards: RecommendationCard[] = [];
  const internalAlerts: HomeBrainPlan['internalAlerts'] = [];
  const flowBlueprints: CollectionFlowBlueprint[] = [];

  const firstQueue = queues[0];
  if (firstQueue) {
    const openQueueIntentId = `intent_open_${firstQueue.queueId}`;
    actionIntents.push({
      id: openQueueIntentId,
      type: 'open_queue',
      title: copy.reviewCustomers,
      requiresApproval: false,
      payload: { queueId: firstQueue.queueId },
    });
    cards.push({
      cardId: `card_queue_${firstQueue.queueId}`,
      type: 'queue',
      title: copy.queueCardTitle,
      body: copy.queueCardBody,
      priority: firstQueue.priority,
      badges: [`${firstQueue.count} customers`],
      targetCustomerIds: firstQueue.customerIds,
      queueRef: firstQueue.queueId,
      actionIntentIds: [openQueueIntentId],
      explainability: {
        whyNow: copy.whyNow,
        keySignals: copy.kpiSignals,
      },
    });
  }

  const highRiskCustomers = context.customers.filter((customer) => customer.riskScore >= 60).slice(0, 20);
  if (highRiskCustomers.length > 0) {
    const customerIds = highRiskCustomers.map((customer) => customer.id);
    const sendIntentId = 'intent_send_bulk_reminders';
    const language = pickTemplateLanguage(context, customerIds);
    const tone = pickToneForCustomers(context, customerIds);
    const channel = pickChannelForCustomers(context, customerIds);
    actionIntents.push({
      id: sendIntentId,
      type: 'send_bulk_reminders',
      title: copy.sendReminders,
      requiresApproval: true,
      payload: {
        customerIds,
        channel,
        language,
        tone,
        templateKey: 'debt_reminder',
      },
    });
    cards.push({
      cardId: 'card_bulk_high_risk',
      type: 'bulk_action',
      title: copy.reminderCardTitle,
      body: copy.reminderCardBody,
      priority: highRiskCustomers[0]?.riskLevel || 'high',
      badges: [`${customerIds.length} customers`, channel.toUpperCase(), language.toUpperCase()],
      targetCustomerIds: customerIds,
      actionIntentIds: [sendIntentId],
      explainability: {
        whyNow: locale === 'he' ? 'פיגור מצטבר וסיכון גבוה מצביעים על צורך בפעולה מיידית.' : 'Compounding overdue exposure and risk concentration warrant immediate outreach.',
        keySignals: highRiskCustomers.slice(0, 3).flatMap((customer) => customer.recentCommSummary).slice(0, 4),
      },
    });
  }

  const switchCandidates = context.customers
    .filter((customer) => customer.failedDeliveries > 0 && customer.eligibleChannels.includes('sms'))
    .slice(0, 20);
  if (switchCandidates.length > 0) {
    const customerIds = switchCandidates.map((customer) => customer.id);
    const switchIntentId = 'intent_switch_channel';
    actionIntents.push({
      id: switchIntentId,
      type: 'switch_channel_for_cohort',
      title: copy.switchChannel,
      requiresApproval: true,
      payload: {
        customerIds,
        fromChannel: 'whatsapp',
        toChannel: 'sms',
        language: pickTemplateLanguage(context, customerIds),
        tone: pickToneForCustomers(context, customerIds),
        templateKey: 'debt_reminder',
      },
    });
    cards.push({
      cardId: 'card_switch_channel',
      type: 'bulk_action',
      title: copy.switchCardTitle,
      body: copy.switchCardBody,
      priority: 'high',
      badges: [`${customerIds.length} customers`, 'SMS'],
      targetCustomerIds: customerIds,
      actionIntentIds: [switchIntentId],
      explainability: {
        whyNow: locale === 'he' ? 'חוסר מענה חוזר מרמז שערוץ אחר עשוי להצליח יותר.' : 'Repeated non-response suggests a channel shift may recover engagement faster.',
        keySignals: ['failed_delivery', 'reachable_phone', 'overdue_balance'],
      },
    });
  }

  const flowAudience = context.customers.filter((customer) => customer.overdueDays >= 14).slice(0, 8);
  if (flowAudience.length > 0) {
    const blueprintId = 'blueprint_escalation_1';
    const audienceIds = flowAudience.map((customer) => customer.id);
    const language = pickTemplateLanguage(context, audienceIds);
    const tone = pickToneForCustomers(context, audienceIds);
    flowBlueprints.push({
      blueprintId,
      name: locale === 'he' ? 'הסלמת פיגורים 14 יום' : '14-day delinquency escalation',
      description: locale === 'he' ? 'תהליך AI להסלמה מדורגת ללקוחות בפיגור.' : 'AI-generated escalation draft for overdue accounts.',
      audienceCustomerIds: audienceIds,
      steps: [
        {
          stepKey: 'day0_whatsapp',
          dayOffset: 0,
          actionType: 'send_whatsapp',
          explicitChannel: 'whatsapp',
          languageMode: 'explicit',
          language,
          toneMode: 'explicit',
          tone,
          templateKey: 'debt_reminder',
          expectedOutcome: locale === 'he' ? 'יצירת מגע ראשון' : 'Initial engagement',
        },
        {
          stepKey: 'day3_sms',
          dayOffset: 3,
          actionType: 'send_sms',
          explicitChannel: 'sms',
          languageMode: 'explicit',
          language,
          toneMode: 'explicit',
          tone: tone === 'calm' ? 'medium' : tone,
          templateKey: 'debt_reminder',
          expectedOutcome: locale === 'he' ? 'הסלמה לאחר אי תגובה' : 'Escalate after non-response',
        },
        {
          stepKey: 'day7_voice',
          dayOffset: 7,
          actionType: 'voice_call',
          explicitChannel: 'call_task',
          languageMode: 'preferred',
          toneMode: 'explicit',
          tone: 'heavy',
          templateKey: 'debt_reminder',
          expectedOutcome: locale === 'he' ? 'העבר למעקב אנושי' : 'Escalate to human follow-up',
        },
      ],
    });

    const materializeIntentId = 'intent_materialize_flow';
    actionIntents.push({
      id: materializeIntentId,
      type: 'materialize_collection_flow',
      title: copy.materializeFlow,
      requiresApproval: true,
      payload: {
        blueprintId,
        flowName: locale === 'he' ? 'טיוטת הסלמה AI' : 'AI escalation draft',
        description: locale === 'he' ? 'טיוטת תהליך חדשה שנוצרה מהום בריין.' : 'New draft flow generated by Home Brain.',
      },
    });
    cards.push({
      cardId: 'card_flow_blueprint',
      type: 'flow',
      title: copy.flowCardTitle,
      body: copy.flowCardBody,
      priority: 'medium',
      badges: [`${audienceIds.length} customers`, 'flow'],
      targetCustomerIds: audienceIds,
      actionIntentIds: [materializeIntentId],
      explainability: {
        whyNow: locale === 'he' ? 'רצף פעולות עקבי מפחית עיכובים בצוות הגבייה.' : 'A reusable escalation flow reduces manual delay for the collections team.',
        keySignals: ['overdue>14', 'multi-step_follow_up', 'flow_reuse'],
      },
    });
  }

  const criticalCount = context.customers.filter((customer) => customer.riskLevel === 'critical').length;
  if (criticalCount > 0) {
    const alertIntentId = 'intent_create_alert';
    actionIntents.push({
      id: alertIntentId,
      type: 'create_internal_alert',
      title: copy.managementAlert,
      requiresApproval: true,
      payload: {
        severity: criticalCount >= 8 ? 'critical' : 'high',
        audience: 'management',
        title: copy.alertsTitle,
        body: copy.alertBody,
        metadata: {
          criticalCustomers: criticalCount,
          overdueBalance: context.metrics.totalOverdueBalance,
        },
      },
    });
    internalAlerts.push({
      id: 'draft_alert_management',
      severity: criticalCount >= 8 ? 'critical' : 'high',
      audience: 'management',
      title: copy.alertsTitle,
      body: copy.alertBody,
      metadata: {
        criticalCustomers: criticalCount,
      },
    });
    cards.push({
      cardId: 'card_management_alert',
      type: 'alert',
      title: copy.alertsTitle,
      body: copy.alertBody,
      priority: criticalCount >= 8 ? 'critical' : 'high',
      badges: [`${criticalCount} critical`],
      targetCustomerIds: context.customers.filter((customer) => customer.riskLevel === 'critical').slice(0, 12).map((customer) => customer.id),
      actionIntentIds: [alertIntentId],
      explainability: {
        whyNow: locale === 'he' ? 'ריכוז חשבונות קריטיים מצריך מודעות הנהלתית.' : 'The concentration of critical accounts warrants management visibility.',
        keySignals: ['critical_accounts', 'overdue_balance', 'operational_risk'],
      },
    });
  }

  const limitedCards = sortCards(cards).slice(0, Math.min(maxCards, 12));
  return homeBrainPlanSchema.parse({
    planVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    contextVersion: context.contextVersion,
    reasoningSummary:
      locale === 'he'
        ? 'התוכנית מתמקדת בלקוחות בעלי סיכון גבוה, אי-תגובה אחרונה ואפשרויות גבייה ניתנות לביצוע.'
        : 'The plan prioritizes high-risk accounts, recent non-response, and executable collection actions.',
    dashboard: {
      title: copy.dashboardTitle,
      subtitle: copy.dashboardSubtitle,
      kpis: [
        { key: 'total_overdue_balance', label: copy.totalOverdue, value: context.metrics.totalOverdueBalance, format: 'currency' },
        { key: 'overdue_customers', label: copy.overdueCustomers, value: context.metrics.overdueCustomers, format: 'number' },
        { key: 'collected_today', label: copy.collectedToday, value: context.metrics.collectedToday, format: 'currency' },
        {
          key: 'critical_accounts',
          label: copy.criticalAccounts,
          value: criticalCount,
          format: 'number',
          trend: { direction: criticalCount > 0 ? 'up' : 'flat', label: copy.overdueTrend },
        },
      ],
      queues,
      filters: [
        {
          key: 'segment',
          label: copy.filterSegment,
          type: 'select',
          options: [
            { label: 'All', value: 'all' },
            { label: 'High Risk', value: 'high_risk' },
            { label: 'Overdue', value: 'overdue' },
            { label: 'No Response', value: 'no_response' },
          ],
        },
        {
          key: 'language',
          label: copy.filterLanguage,
          type: 'select',
          options: [
            { label: 'English', value: 'en' },
            { label: 'Hebrew', value: 'he' },
            { label: 'Arabic', value: 'ar' },
          ],
        },
        {
          key: 'minOverdueDays',
          label: copy.filterMinOverdue,
          type: 'select',
          options: [
            { label: '0', value: '0' },
            { label: '7', value: '7' },
            { label: '14', value: '14' },
            { label: '30', value: '30' },
          ],
        },
      ],
      groupings: [
        { key: 'riskLevel', label: copy.groupingRisk, supportedValues: ['critical', 'high', 'medium', 'low'] },
        { key: 'preferredLanguage', label: copy.groupingLanguage, supportedValues: ['en', 'he', 'ar'] },
      ],
    },
    cards: limitedCards,
    flowBlueprints,
    actionIntents,
    internalAlerts,
  });
}

class HomeBrainService {
  private async getFreshCachedPlan(locale: SupportedLocale, filters: HomeBrainFilters) {
    const filtersJson = normalizeFilters(filters) as Prisma.InputJsonValue;
    return db.aiPlanSnapshot.findFirst({
      where: {
        surface: PLAN_SURFACE,
        locale,
        filtersJson: { equals: filtersJson },
        createdAt: {
          gte: new Date(Date.now() - CACHE_WINDOW_MS),
        },
        status: { in: ['generated', 'approved', 'modified', 'resolved'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getLastGoodPlan(locale: SupportedLocale, filters: HomeBrainFilters) {
    const filtersJson = normalizeFilters(filters) as Prisma.InputJsonValue;
    return db.aiPlanSnapshot.findFirst({
      where: {
        surface: PLAN_SURFACE,
        locale,
        filtersJson: { equals: filtersJson },
        status: { in: ['generated', 'approved', 'modified', 'resolved'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private parseStoredPlan(snapshot: { outputJson: Prisma.JsonValue }): HomeBrainPlan {
    return homeBrainPlanSchema.parse(snapshot.outputJson);
  }

  private async persistSnapshot(params: {
    locale: SupportedLocale;
    filters: HomeBrainFilters;
    context: HomeBrainContext;
    plan: HomeBrainPlan;
    generatedBy: string;
    status?: 'generated' | 'failed';
  }) {
    return db.aiPlanSnapshot.create({
      data: {
        surface: PLAN_SURFACE,
        promptVersion: PROMPT_VERSION,
        contextVersion: params.context.contextVersion,
        locale: params.locale,
        filtersJson: normalizeFilters(params.filters) as Prisma.InputJsonValue,
        contextSummary: params.context as unknown as Prisma.InputJsonValue,
        outputJson: params.plan as unknown as Prisma.InputJsonValue,
        reasoningSummary: params.plan.reasoningSummary,
        status: params.status || 'generated',
        generatedBy: params.generatedBy,
      },
    });
  }

  private buildPrompt(context: HomeBrainContext, locale: SupportedLocale, maxCards: number): string {
    return [
      'You are the PayDay AI Home Brain.',
      'Generate a strict JSON object only. No markdown, no prose outside JSON.',
      `Locale: ${locale}.`,
      `Use at most ${maxCards} cards.`,
      'Never reference customers outside the provided context.',
      'Never use unavailable channels.',
      'Every card must include explainability and valid actionIntentIds.',
      'Flow blueprints must be compatible with an existing collection-flow engine and remain drafts only.',
      'If there are no urgent recommendations, return an empty plan shape.',
      'Context:',
      JSON.stringify(context),
    ].join('\n');
  }

  private async generateWithAi(context: HomeBrainContext, locale: SupportedLocale, maxCards: number): Promise<HomeBrainPlan> {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(this.buildPrompt(context, locale, maxCards));
    const responseText = result.response.text();
    if (!responseText) {
      throw new AppError('AI service unavailable', 502);
    }
    return cleanJsonResponse(responseText) as HomeBrainPlan;
  }

  private shouldUseMockPlanner(): boolean {
    return process.env.HOME_BRAIN_USE_MOCK === '1' || !process.env.GEMINI_API_KEY;
  }

  private async generateCandidatePlan(context: HomeBrainContext, locale: SupportedLocale, maxCards: number): Promise<HomeBrainPlan> {
    if (this.shouldUseMockPlanner()) {
      return buildMockPlan(context, locale, maxCards);
    }

    try {
      return await this.generateWithAi(context, locale, maxCards);
    } catch (error) {
      console.warn('Home Brain AI generation failed, falling back to deterministic planner:', error);
      return buildMockPlan(context, locale, maxCards);
    }
  }

  async generatePlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
    const filters = normalizeFilters(input.filters);
    const maxCards = Math.min(Math.max(input.maxCards || 8, 1), 12);

    if (!input.forceRefresh) {
      const cached = await this.getFreshCachedPlan(input.locale, filters);
      if (cached) {
        return {
          planId: cached.id,
          status: 'generated',
          plan: this.parseStoredPlan(cached),
          cachedAt: cached.createdAt.toISOString(),
        };
      }
    }

    try {
      const assembly = await contextAssemblerService.assemble(filters);
      const candidatePlan = await this.generateCandidatePlan(assembly.context, input.locale, maxCards);
      const validatedPlan = validateHomeBrainPlan(candidatePlan, {
        knownCustomerIds: assembly.knownCustomerIds,
        availableChannels: assembly.availableChannels,
      });

      const snapshot = await this.persistSnapshot({
        locale: input.locale,
        filters,
        context: assembly.context,
        plan: validatedPlan,
        generatedBy: this.shouldUseMockPlanner() ? 'mock_home_brain' : 'home_brain',
      });

      return {
        planId: snapshot.id,
        status: 'generated',
        plan: validatedPlan,
      };
    } catch (error) {
      const fallback = await this.getLastGoodPlan(input.locale, filters);
      if (fallback) {
        return {
          planId: fallback.id,
          status: 'generated',
          plan: this.parseStoredPlan(fallback),
          cachedAt: fallback.createdAt.toISOString(),
        };
      }

      const assembly = await contextAssemblerService.assemble(filters);
      const plan = emptyPlan(
        input.locale === 'he' ? 'לא ניתן לייצר המלצות כרגע.' : 'Unable to generate recommendations at this time.'
      );
      const snapshot = await this.persistSnapshot({
        locale: input.locale,
        filters,
        context: assembly.context,
        plan,
        generatedBy: 'home_brain',
        status: 'failed',
      });

      return {
        planId: snapshot.id,
        status: 'generated',
        plan,
      };
    }
  }

  async getPlan(planId: string) {
    const snapshot = await db.aiPlanSnapshot.findUnique({
      where: { id: planId },
      include: {
        actions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundError('Plan');
    }

    return {
      planId: snapshot.id,
      status: snapshot.status,
      plan: this.parseStoredPlan(snapshot),
      createdAt: snapshot.createdAt.toISOString(),
      actions: snapshot.actions,
    };
  }

  private async loadPlanCard(planId: string, cardId: string) {
    const snapshot = await db.aiPlanSnapshot.findUnique({
      where: { id: planId },
    });
    if (!snapshot) {
      throw new NotFoundError('Plan');
    }
    if (Date.now() - snapshot.createdAt.getTime() > CARD_EXPIRATION_MS) {
      throw new ValidationError('This Home Brain plan has expired. Refresh Home to get a fresh plan.');
    }

    const plan = this.parseStoredPlan(snapshot);
    const card = plan.cards.find((item) => item.cardId === cardId);
    if (!card) {
      throw new NotFoundError('Card');
    }

    const primaryIntent = card.actionIntentIds.length
      ? plan.actionIntents.find((intent) => intent.id === card.actionIntentIds[0]) || null
      : null;

    return { snapshot, plan, card, primaryIntent };
  }

  private applyIntentModifications(intent: ActionIntent, modifications: Record<string, unknown> = {}): ActionIntent {
    if (!Object.keys(modifications).length) {
      return intent;
    }

    switch (intent.type) {
      case 'send_bulk_reminders':
        return homeBrainPlanSchema.shape.actionIntents.element.parse({
          ...intent,
          payload: {
            ...intent.payload,
            channel: modifications.channel ?? intent.payload.channel,
            language: modifications.language ?? intent.payload.language,
            tone: modifications.tone ?? intent.payload.tone,
            customerIds: Array.isArray(modifications.customerIds) ? modifications.customerIds : intent.payload.customerIds,
          },
        });
      case 'switch_channel_for_cohort':
        return homeBrainPlanSchema.shape.actionIntents.element.parse({
          ...intent,
          payload: {
            ...intent.payload,
            toChannel: modifications.toChannel ?? intent.payload.toChannel,
            language: modifications.language ?? intent.payload.language,
            tone: modifications.tone ?? intent.payload.tone,
            customerIds: Array.isArray(modifications.customerIds) ? modifications.customerIds : intent.payload.customerIds,
          },
        });
      case 'materialize_collection_flow':
        return homeBrainPlanSchema.shape.actionIntents.element.parse({
          ...intent,
          payload: {
            ...intent.payload,
            flowName: modifications.flowName ?? intent.payload.flowName,
            description: modifications.description ?? intent.payload.description,
          },
        });
      case 'assign_flow_to_customers':
        return homeBrainPlanSchema.shape.actionIntents.element.parse({
          ...intent,
          payload: {
            ...intent.payload,
            customerIds: Array.isArray(modifications.customerIds) ? modifications.customerIds : intent.payload.customerIds,
          },
        });
      case 'notify_management':
        return homeBrainPlanSchema.shape.actionIntents.element.parse({
          ...intent,
          payload: {
            ...intent.payload,
            severity: modifications.severity ?? intent.payload.severity,
            title: modifications.title ?? intent.payload.title,
            body: modifications.body ?? intent.payload.body,
          },
        });
      case 'create_internal_alert':
        return homeBrainPlanSchema.shape.actionIntents.element.parse({
          ...intent,
          payload: {
            ...intent.payload,
            severity: modifications.severity ?? intent.payload.severity,
            audience: modifications.audience ?? intent.payload.audience,
            title: modifications.title ?? intent.payload.title,
            body: modifications.body ?? intent.payload.body,
          },
        });
      case 'open_queue':
        if (Object.keys(modifications).length > 0) {
          throw new ValidationError('open_queue intents are not editable');
        }
        return intent;
      default:
        throw new ValidationError(`Unsupported intent type: ${(intent as ActionIntent).type}`);
    }
  }

  private async logDispatchActivities(
    customerIds: string[],
    execution: { channel: string; success: boolean; notificationId?: string; renderedText?: string; tone?: string; error?: string },
    createdBy: string
  ) {
    const customers = await db.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, fullName: true },
    });

    await Promise.all(
      customers.map((customer) =>
        activityService
          .logNotification({
            channel: execution.channel,
            customerId: customer.id,
            customerName: customer.fullName,
            status: execution.success ? 'success' : 'failed',
            notificationId: execution.notificationId,
            messageText: execution.renderedText,
            tone: execution.tone,
            error: execution.error,
            createdBy,
          })
          .catch(() => undefined)
      )
    );
  }

  private async executeSendBulk(intent: Extract<ActionIntent, { type: 'send_bulk_reminders' }>, createdBy: string) {
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as Array<{ customerId: string; error: string }>,
      notificationIds: [] as string[],
    };

    for (const customerId of intent.payload.customerIds) {
      const dispatch = await notificationDispatchService.send({
        customerId,
        channel: intent.payload.channel,
        templateKey: intent.payload.templateKey,
        language: intent.payload.language as TemplateLanguage,
        tone: intent.payload.tone,
        createdBy,
      });

      await this.logDispatchActivities([customerId], {
        channel: intent.payload.channel,
        success: dispatch.success,
        notificationId: dispatch.notificationId,
        renderedText: dispatch.renderedText,
        tone: dispatch.tone,
        error: dispatch.error,
      }, createdBy);

      if (dispatch.success) {
        results.sent += 1;
        if (dispatch.notificationId) {
          results.notificationIds.push(dispatch.notificationId);
        }
      } else {
        results.failed += 1;
        results.errors.push({ customerId, error: dispatch.error || 'Unknown error' });
      }
    }

    return results;
  }

  private async executeSwitchChannel(intent: Extract<ActionIntent, { type: 'switch_channel_for_cohort' }>, createdBy: string) {
    return this.executeSendBulk(
      {
        ...intent,
        type: 'send_bulk_reminders',
        payload: {
          customerIds: intent.payload.customerIds,
          channel: intent.payload.toChannel,
          language: intent.payload.language,
          tone: intent.payload.tone,
          templateKey: intent.payload.templateKey,
        },
      },
      createdBy
    );
  }

  private async executeMaterializeFlow(
    planId: string,
    cardId: string,
    plan: HomeBrainPlan,
    payload: MaterializeFlowPayload
  ) {
    const blueprint = plan.flowBlueprints.find((item) => item.blueprintId === payload.blueprintId);
    if (!blueprint) {
      throw new ValidationError(`Blueprint ${payload.blueprintId} not found`);
    }
    const flow = await flowMaterializerService.materialize({
      planId,
      cardId,
      blueprint,
      flowName: payload.flowName,
      description: payload.description,
    });
    await activityService.logCollectionFlowCreated({
      flowId: flow.id,
      flowName: flow.name,
      status: 'success',
      createdBy: 'home_brain',
    });
    return {
      flowId: flow.id,
      flowName: flow.name,
      status: flow.status,
    };
  }

  private async executeAssignFlow(intent: Extract<ActionIntent, { type: 'assign_flow_to_customers' }>) {
    const results = [];
    for (const customerId of intent.payload.customerIds) {
      results.push(await flowRuntimeService.assignFlowToCustomer(customerId, intent.payload.flowId));
    }
    return {
      assigned: results.length,
      results,
    };
  }

  private async executeInternalAlert(
    intent: Extract<ActionIntent, { type: 'notify_management' | 'create_internal_alert' }>,
    createdBy: string
  ) {
    const payload =
      intent.type === 'notify_management'
        ? { ...intent.payload, audience: 'management' as const }
        : intent.payload;

    const alert = await db.internalAlert.create({
      data: {
        severity: payload.severity,
        audience: payload.audience,
        title: payload.title,
        body: payload.body,
        metadata: (payload.metadata || {}) as Prisma.InputJsonValue,
        createdBy,
      },
    });

    return {
      alertId: alert.id,
      severity: alert.severity,
      audience: alert.audience,
      status: alert.status,
    };
  }

  private async executeIntent(planId: string, cardId: string, plan: HomeBrainPlan, intent: ActionIntent, createdBy: string) {
    switch (intent.type) {
      case 'open_queue':
        return {
          queueId: intent.payload.queueId,
          opened: true,
        };
      case 'send_bulk_reminders':
        return this.executeSendBulk(intent, createdBy);
      case 'switch_channel_for_cohort':
        return this.executeSwitchChannel(intent, createdBy);
      case 'materialize_collection_flow':
        return this.executeMaterializeFlow(planId, cardId, plan, intent.payload);
      case 'assign_flow_to_customers':
        return this.executeAssignFlow(intent);
      case 'notify_management':
      case 'create_internal_alert':
        return this.executeInternalAlert(intent, createdBy);
      default:
        throw new ValidationError(`Unsupported intent type: ${(intent as ActionIntent).type}`);
    }
  }

  async approveCard(cardId: string, input: CardMutationInput) {
    const actor = input.performedBy || 'ui';
    const { snapshot, plan, primaryIntent } = await this.loadPlanCard(input.planId, cardId);
    const effectiveIntent = primaryIntent ? this.applyIntentModifications(primaryIntent, input.modifications) : null;

    const executionResult = effectiveIntent
      ? await this.executeIntent(snapshot.id, cardId, plan, effectiveIntent, actor)
      : { approved: true, note: 'Card had no executable action intent' };

    const failed =
      typeof executionResult === 'object' &&
      executionResult !== null &&
      'failed' in executionResult &&
      typeof executionResult.failed === 'number' &&
      executionResult.failed > 0 &&
      'sent' in executionResult &&
      typeof executionResult.sent === 'number' &&
      executionResult.sent === 0;

    await prisma.$transaction([
      db.aiPlanAction.create({
        data: {
          planId: snapshot.id,
          cardId,
          intentId: effectiveIntent?.id || null,
          actionType: effectiveIntent?.type || 'approve_card',
          status: failed ? 'failed' : 'approved',
          modifiedPayload: input.modifications ? (input.modifications as Prisma.InputJsonValue) : undefined,
          executionResult: executionResult as Prisma.InputJsonValue,
          performedBy: actor,
        },
      }),
      db.aiPlanSnapshot.update({
        where: { id: snapshot.id },
        data: { status: failed ? 'failed' : 'approved' },
      }),
    ]);

    return {
      cardId,
      planId: snapshot.id,
      status: failed ? 'failed' : 'approved',
      executionResult,
      intent: effectiveIntent,
    };
  }

  async modifyCard(cardId: string, input: CardMutationInput) {
    const actor = input.performedBy || 'ui';
    const { snapshot, card, primaryIntent } = await this.loadPlanCard(input.planId, cardId);
    if (!primaryIntent) {
      throw new ValidationError('This card has no editable action intent');
    }

    const modifiedIntent = this.applyIntentModifications(primaryIntent, input.modifications);
    const preview = {
      cardId: card.cardId,
      intentId: modifiedIntent.id,
      type: modifiedIntent.type,
      payload: modifiedIntent.payload,
    };

    await prisma.$transaction([
      db.aiPlanAction.create({
        data: {
          planId: snapshot.id,
          cardId,
          intentId: modifiedIntent.id,
          actionType: modifiedIntent.type,
          status: 'modified',
          modifiedPayload: input.modifications ? (input.modifications as Prisma.InputJsonValue) : undefined,
          executionResult: preview as Prisma.InputJsonValue,
          performedBy: actor,
        },
      }),
      db.aiPlanSnapshot.update({
        where: { id: snapshot.id },
        data: { status: 'modified' },
      }),
    ]);

    return {
      cardId,
      planId: snapshot.id,
      status: 'modified',
      preview,
      intent: modifiedIntent,
    };
  }

  async skipCard(cardId: string, input: CardMutationInput) {
    const actor = input.performedBy || 'ui';
    const { snapshot, primaryIntent } = await this.loadPlanCard(input.planId, cardId);

    await prisma.$transaction([
      db.aiPlanAction.create({
        data: {
          planId: snapshot.id,
          cardId,
          intentId: primaryIntent?.id || null,
          actionType: primaryIntent?.type || 'skip_card',
          status: 'skipped',
          executionResult: { reason: input.reason || null } as Prisma.InputJsonValue,
          performedBy: actor,
        },
      }),
      db.aiPlanSnapshot.update({
        where: { id: snapshot.id },
        data: { status: 'skipped' },
      }),
    ]);

    return {
      cardId,
      planId: snapshot.id,
      status: 'skipped',
    };
  }

  async resolveCard(cardId: string, input: CardMutationInput) {
    const actor = input.performedBy || 'ui';
    const { snapshot, primaryIntent } = await this.loadPlanCard(input.planId, cardId);

    await prisma.$transaction([
      db.aiPlanAction.create({
        data: {
          planId: snapshot.id,
          cardId,
          intentId: primaryIntent?.id || null,
          actionType: primaryIntent?.type || 'resolve_card',
          status: 'resolved',
          executionResult: { reason: input.reason || null } as Prisma.InputJsonValue,
          performedBy: actor,
        },
      }),
      db.aiPlanSnapshot.update({
        where: { id: snapshot.id },
        data: { status: 'resolved' },
      }),
    ]);

    return {
      cardId,
      planId: snapshot.id,
      status: 'resolved',
    };
  }
}

export default new HomeBrainService();
