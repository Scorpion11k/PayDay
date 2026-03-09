import {
  NotificationChannel,
  TemplateLanguage,
  TemplateTone,
  type MessageTemplate,
  type SystemMode,
} from '@prisma/client';
import prisma from '../../config/database';
import emailService from '../email.service';
import kolKasherService from '../kol-kasher.service';
import smsService from '../sms.service';
import systemSettingsService from '../system-settings.service';
import whatsappService from '../whatsapp.service';
import {
  getDefaultTone,
  isEligibleForChannel,
  recommendChannelByAge,
  recommendLanguageByRegion,
} from '../preference.service';

type SupportedChannel = 'sms' | 'email' | 'whatsapp' | 'call_task';
type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface HomeBrainFilters {
  segment?: 'all' | 'high_risk' | 'overdue' | 'no_response';
  language?: 'en' | 'he' | 'ar';
  minOverdueDays?: number;
}

export interface HomeBrainContext {
  generatedAt: string;
  mode: SystemMode;
  filters: HomeBrainFilters;
  metrics: {
    totalCustomers: number;
    totalOverdueBalance: number;
    collectedToday: number;
    overdueCustomers: number;
  };
  channelAvailability: Record<SupportedChannel, boolean>;
  templateCoverage: Array<{
    key: string;
    channel: SupportedChannel;
    language: TemplateLanguage;
    tone: TemplateTone;
    available: boolean;
  }>;
  cohorts: Array<{
    cohortId: string;
    label: string;
    count: number;
    totalBalance: number;
    avgOverdueDays: number;
    languages: string[];
    recommendedChannelOptions: SupportedChannel[];
    riskLevel: RiskLevel;
    sampleCustomerIds: string[];
  }>;
  customers: Array<{
    id: string;
    fullName: string;
    balance: number;
    overdueDays: number;
    preferredLanguage?: string | null;
    preferredChannel?: string | null;
    preferredTone?: string | null;
    eligibleChannels: SupportedChannel[];
    recentCommSummary: string[];
    riskScore: number;
    riskLevel: RiskLevel;
    failedDeliveries: number;
    unansweredCalls: number;
  }>;
  communicationOutcomes: Array<{
    channel: SupportedChannel;
    status: string;
    count: number;
  }>;
  publishedDefaultFlow: {
    id: string;
    name: string;
  } | null;
  contextVersion: string;
}

export interface HomeBrainAssemblyResult {
  context: HomeBrainContext;
  knownCustomerIds: Set<string>;
  availableChannels: Set<SupportedChannel>;
}

interface CustomerAggregate {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  region: string | null;
  dateOfBirth: Date | null;
  preferredChannel: NotificationChannel | null;
  preferredLanguage: TemplateLanguage | null;
  preferredTone: TemplateTone | null;
  balance: number;
  overdueDays: number;
  failedDeliveries: number;
  unansweredCalls: number;
  activeDebtCount: number;
  eligibleChannels: SupportedChannel[];
  recentCommSummary: string[];
  riskScore: number;
  riskLevel: RiskLevel;
}

const MAX_CUSTOMERS = 100;
const MAX_COHORTS = 20;
const MAX_TEMPLATE_COVERAGE = 50;

function getRiskLevel(score: number): RiskLevel {
  if (score >= 85) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function getRecommendedChannels(
  customer: Pick<CustomerAggregate, 'eligibleChannels' | 'preferredChannel' | 'dateOfBirth'>
): SupportedChannel[] {
  const preferred = customer.preferredChannel || recommendChannelByAge(customer.dateOfBirth);
  const ordered = [preferred, 'whatsapp', 'sms', 'email', 'call_task'] as SupportedChannel[];
  return ordered.filter((channel, index) => customer.eligibleChannels.includes(channel) && ordered.indexOf(channel) === index);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildRecentCommSummary(failedDeliveries: number, deliveredCount: number, unansweredCalls: number): string[] {
  const summary: string[] = [];
  if (failedDeliveries > 0) {
    summary.push(`${failedDeliveries} failed deliveries in 30d`);
  }
  if (deliveredCount > 0) {
    summary.push(`${deliveredCount} delivered notifications in 30d`);
  }
  if (unansweredCalls > 0) {
    summary.push(`${unansweredCalls} unanswered voice calls in 30d`);
  }
  if (summary.length === 0) {
    summary.push('No recent outreach activity');
  }
  return summary;
}

async function getChannelAvailability(mode: SystemMode): Promise<Record<SupportedChannel, boolean>> {
  await Promise.all([
    emailService.initialize(),
    smsService.initialize(),
    whatsappService.initialize(),
    kolKasherService.initialize(),
  ]);

  const simulated = mode === 'development';
  return {
    email: simulated || emailService.isAvailable(),
    sms: simulated || smsService.isAvailable(),
    whatsapp: simulated || whatsappService.isAvailable(),
    call_task: simulated || kolKasherService.isAvailable(),
  };
}

function buildTemplateCoverage(
  templates: Array<Pick<MessageTemplate, 'key' | 'channel' | 'language' | 'tone'>>
): HomeBrainContext['templateCoverage'] {
  return templates.slice(0, MAX_TEMPLATE_COVERAGE).map((template) => ({
    key: template.key,
    channel: template.channel,
    language: template.language,
    tone: template.tone,
    available: true,
  }));
}

function computeRiskScore(input: {
  balance: number;
  overdueDays: number;
  failedDeliveries: number;
  unansweredCalls: number;
  activeDebtCount: number;
}): number {
  const score =
    Math.min(input.balance / 1000, 40) +
    Math.min(input.overdueDays, 30) +
    input.failedDeliveries * 6 +
    input.unansweredCalls * 8 +
    input.activeDebtCount * 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function applyCustomerFilters(customers: CustomerAggregate[], filters: HomeBrainFilters): CustomerAggregate[] {
  return customers.filter((customer) => {
    if (filters.language) {
      const resolvedLanguage = customer.preferredLanguage || recommendLanguageByRegion(customer.region);
      if (resolvedLanguage !== filters.language) {
        return false;
      }
    }
    if (filters.minOverdueDays && customer.overdueDays < filters.minOverdueDays) {
      return false;
    }
    if (filters.segment === 'high_risk' && customer.riskScore < 60) {
      return false;
    }
    if (filters.segment === 'overdue' && customer.overdueDays === 0) {
      return false;
    }
    if (filters.segment === 'no_response' && customer.failedDeliveries === 0 && customer.unansweredCalls === 0) {
      return false;
    }
    return true;
  });
}

function buildCohorts(customers: CustomerAggregate[]): HomeBrainContext['cohorts'] {
  const cohortSpecs = [
    {
      cohortId: 'critical_high_risk',
      label: 'Critical high-risk accounts',
      predicate: (customer: CustomerAggregate) => customer.riskLevel === 'critical',
      riskLevel: 'critical' as const,
    },
    {
      cohortId: 'recent_non_response',
      label: 'Recent non-response follow-ups',
      predicate: (customer: CustomerAggregate) => customer.failedDeliveries > 0 || customer.unansweredCalls > 0,
      riskLevel: 'high' as const,
    },
    {
      cohortId: 'overdue_accounts',
      label: 'Overdue accounts requiring action',
      predicate: (customer: CustomerAggregate) => customer.overdueDays > 0,
      riskLevel: 'high' as const,
    },
    {
      cohortId: 'hebrew_accounts',
      label: 'Hebrew-preferred active debtors',
      predicate: (customer: CustomerAggregate) =>
        (customer.preferredLanguage || recommendLanguageByRegion(customer.region)) === 'he',
      riskLevel: 'medium' as const,
    },
    {
      cohortId: 'english_accounts',
      label: 'English-preferred active debtors',
      predicate: (customer: CustomerAggregate) =>
        (customer.preferredLanguage || recommendLanguageByRegion(customer.region)) === 'en',
      riskLevel: 'medium' as const,
    },
  ];

  return cohortSpecs
    .map((spec) => {
      const members = customers.filter(spec.predicate);
      if (members.length === 0) {
        return null;
      }
      const channelOptions = new Set<SupportedChannel>();
      const languages = new Set<string>();
      for (const member of members) {
        getRecommendedChannels(member).forEach((channel) => channelOptions.add(channel));
        languages.add(member.preferredLanguage || recommendLanguageByRegion(member.region));
      }
      return {
        cohortId: spec.cohortId,
        label: spec.label,
        count: members.length,
        totalBalance: members.reduce((sum, member) => sum + member.balance, 0),
        avgOverdueDays: Math.round(average(members.map((member) => member.overdueDays))),
        languages: Array.from(languages).slice(0, 4),
        recommendedChannelOptions: Array.from(channelOptions).slice(0, 4),
        riskLevel: spec.riskLevel,
        sampleCustomerIds: members.slice(0, 8).map((member) => member.id),
      };
    })
    .filter((cohort): cohort is NonNullable<typeof cohort> => cohort !== null)
    .slice(0, MAX_COHORTS);
}

class ContextAssemblerService {
  async assemble(filters: HomeBrainFilters = {}): Promise<HomeBrainAssemblyResult> {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const mode = await systemSettingsService.getMode();
    const channelAvailability = await getChannelAvailability(mode);
    const availableChannels = new Set(
      (Object.entries(channelAvailability) as Array<[SupportedChannel, boolean]>)
        .filter(([, available]) => available)
        .map(([channel]) => channel)
    );

    const [
      totalCustomers,
      overdueDebts,
      collectedTodayAgg,
      overdueCustomers,
      activeTemplates,
      publishedDefaultFlow,
      customers,
      recentDeliveries,
    ] = await Promise.all([
      prisma.customer.count({ where: { status: 'active' } }),
      prisma.debt.findMany({
        where: {
          status: { in: ['open', 'in_collection'] },
          customer: { status: 'active' },
          installments: { some: { status: 'overdue' } },
        },
        select: { currentBalance: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'received', receivedAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      prisma.customer.count({
        where: {
          status: 'active',
          debts: {
            some: {
              status: { in: ['open', 'in_collection'] },
              installments: { some: { status: 'overdue' } },
            },
          },
        },
      }),
      prisma.messageTemplate.findMany({
        where: { status: 'active' },
        select: { key: true, channel: true, language: true, tone: true },
        orderBy: [{ key: 'asc' }, { channel: 'asc' }, { language: 'asc' }, { tone: 'asc' }],
        take: MAX_TEMPLATE_COVERAGE,
      }),
      prisma.collectionFlow.findFirst({
        where: { isDefault: true, status: 'published' },
        select: { id: true, name: true },
      }),
      prisma.customer.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          region: true,
          dateOfBirth: true,
          preferredChannel: true,
          preferredLanguage: true,
          preferredTone: true,
          debts: {
            where: { status: { in: ['open', 'in_collection'] } },
            select: {
              id: true,
              currentBalance: true,
              installments: {
                select: {
                  status: true,
                  dueDate: true,
                },
              },
            },
          },
          notifications: {
            where: { createdAt: { gte: since } },
            select: {
              channel: true,
              deliveries: {
                select: { status: true },
              },
            },
          },
          voiceCallLogs: {
            where: { createdAt: { gte: since } },
            select: {
              answeredBy: true,
            },
          },
        },
      }),
      prisma.notificationDelivery.findMany({
        where: {
          createdAt: { gte: since },
          notification: { customer: { status: 'active' } },
        },
        select: {
          status: true,
          notification: {
            select: {
              channel: true,
            },
          },
        },
      }),
    ]);

    const customerAggregates = customers
      .map<CustomerAggregate>((customer) => {
        const balance = customer.debts.reduce((sum, debt) => sum + Number(debt.currentBalance), 0);
        const overdueDays = customer.debts.reduce((maxDays, debt) => {
          const overdueInstallments = debt.installments.filter((installment) => installment.status === 'overdue');
          for (const installment of overdueInstallments) {
            const diffDays = Math.max(
              0,
              Math.floor((now.getTime() - new Date(installment.dueDate).getTime()) / (1000 * 60 * 60 * 24))
            );
            if (diffDays > maxDays) {
              maxDays = diffDays;
            }
          }
          return maxDays;
        }, 0);

        let failedDeliveries = 0;
        let deliveredCount = 0;
        for (const notification of customer.notifications) {
          for (const delivery of notification.deliveries) {
            if (delivery.status === 'failed' || delivery.status === 'queued') {
              failedDeliveries++;
            }
            if (delivery.status === 'delivered') {
              deliveredCount++;
            }
          }
        }

        const unansweredCalls = customer.voiceCallLogs.filter((log) => !log.answeredBy).length;

        const eligibleChannels = (['email', 'sms', 'whatsapp', 'call_task'] as SupportedChannel[]).filter(
          (channel) => channelAvailability[channel] && isEligibleForChannel(customer, channel)
        );

        const riskScore = computeRiskScore({
          balance,
          overdueDays,
          failedDeliveries,
          unansweredCalls,
          activeDebtCount: customer.debts.length,
        });

        return {
          id: customer.id,
          fullName: customer.fullName,
          phone: customer.phone,
          email: customer.email,
          region: customer.region,
          dateOfBirth: customer.dateOfBirth,
          preferredChannel: customer.preferredChannel,
          preferredLanguage: customer.preferredLanguage,
          preferredTone: customer.preferredTone,
          balance,
          overdueDays,
          failedDeliveries,
          unansweredCalls,
          activeDebtCount: customer.debts.length,
          eligibleChannels,
          recentCommSummary: buildRecentCommSummary(failedDeliveries, deliveredCount, unansweredCalls),
          riskScore,
          riskLevel: getRiskLevel(riskScore),
        };
      })
      .filter((customer) => customer.balance > 0);

    const filteredCustomers = applyCustomerFilters(customerAggregates, filters)
      .sort((a, b) => b.riskScore - a.riskScore || b.balance - a.balance)
      .slice(0, MAX_CUSTOMERS);

    const communicationOutcomesMap = new Map<string, { channel: SupportedChannel; status: string; count: number }>();
    for (const delivery of recentDeliveries) {
      const key = `${delivery.notification.channel}:${delivery.status}`;
      const existing = communicationOutcomesMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        communicationOutcomesMap.set(key, {
          channel: delivery.notification.channel as SupportedChannel,
          status: delivery.status,
          count: 1,
        });
      }
    }

    const contextVersion = `ctx_${now.toISOString().replace(/[-:.TZ]/g, '')}`;
    const context: HomeBrainContext = {
      generatedAt: now.toISOString(),
      mode,
      filters,
      metrics: {
        totalCustomers,
        totalOverdueBalance: overdueDebts.reduce((sum, debt) => sum + Number(debt.currentBalance), 0),
        collectedToday: Number(collectedTodayAgg._sum.amount || 0),
        overdueCustomers,
      },
      channelAvailability,
      templateCoverage: buildTemplateCoverage(activeTemplates),
      cohorts: buildCohorts(filteredCustomers),
      customers: filteredCustomers.map((customer) => ({
        id: customer.id,
        fullName: customer.fullName,
        balance: customer.balance,
        overdueDays: customer.overdueDays,
        preferredLanguage: customer.preferredLanguage || recommendLanguageByRegion(customer.region),
        preferredChannel: customer.preferredChannel || recommendChannelByAge(customer.dateOfBirth),
        preferredTone: customer.preferredTone || getDefaultTone(),
        eligibleChannels: customer.eligibleChannels,
        recentCommSummary: customer.recentCommSummary,
        riskScore: customer.riskScore,
        riskLevel: customer.riskLevel,
        failedDeliveries: customer.failedDeliveries,
        unansweredCalls: customer.unansweredCalls,
      })),
      communicationOutcomes: Array.from(communicationOutcomesMap.values()).sort((a, b) => b.count - a.count),
      publishedDefaultFlow,
      contextVersion,
    };

    return {
      context,
      knownCustomerIds: new Set(filteredCustomers.map((customer) => customer.id)),
      availableChannels,
    };
  }
}

export default new ContextAssemblerService();
