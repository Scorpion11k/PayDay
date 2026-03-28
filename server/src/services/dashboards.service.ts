import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface DashboardStatsResult {
  totalDebt: number;
  collectedAmount: number;
  overdueCustomers: number;
  activeCustomers: number;
  totalCustomers: number;
  activeFlows: number;
  collectionRate: number;
  totalInvoices: number;
  paidInvoices: number;
  avgOverdueDays: number;
  targetDebt: number;
  recentCustomers: Array<{
    id: string;
    fullName: string;
    totalDebt: number;
    overdueCount: number;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    activityName: string;
    description: string | null;
    customerName: string | null;
    createdAt: string;
  }>;
}

export interface GeneratedDashboardConfig {
  title: string;
  description: string;
  chart_type: 'circular-gauge' | 'linear-scale' | 'donut-progress' | 'risk-heat-scale';
  chart_config: {
    metric: string;
    label: string;
    data_source: string;
    max?: number;
    unit?: string;
    thresholds?: { low: number; medium: number };
    color?: string;
    subtitle?: string;
  };
}

const GENERATE_DASHBOARD_PROMPT = `You are a dashboard configuration generator for a debt collection management system.
Given a user's natural language request, generate a JSON configuration for a dashboard widget.

Available chart types:
- "circular-gauge": Semi-circular gauge with needle, best for percentages and rates
- "linear-scale": Vertical bar gauge with gradient, best for value vs target comparisons
- "donut-progress": Circular donut progress ring, best for completion/count ratios
- "risk-heat-scale": Horizontal risk band (green/yellow/red), best for risk/days metrics

Available metrics (these map to real data):
- "collection_rate": Percentage of paid invoices vs total (0-100)
- "total_debt": Total outstanding debt amount in currency
- "total_debt_recovered": Total amount from paid invoices
- "recovery_volume": Same as total_debt (volume being tracked)
- "avg_overdue_days": Average days overdue across overdue installments
- "invoices_paid": Count of paid installments
- "active_clients": Count of active customers

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "title": "Widget Title",
  "description": "Brief description",
  "chart_type": "one of the 4 types above",
  "chart_config": {
    "metric": "one of the metrics above",
    "label": "Display label",
    "data_source": "customers or installments or payments",
    "max": 100,
    "unit": "%" or "$" or "",
    "thresholds": { "low": 60, "medium": 80 },
    "subtitle": "Optional subtitle"
  }
}`;

class DashboardsService {
  async getStats(): Promise<DashboardStatsResult> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalCustomers,
      activeCustomers,
      overdueCustomers,
      activeFlows,
      overdueDebts,
      collectedAgg,
      totalInstallments,
      paidInstallments,
      overdueInstallments,
      recentCustomersRaw,
      recentActivitiesRaw,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { status: 'active' } }),
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
      prisma.collectionFlow.count({ where: { status: 'published' } }),
      prisma.debt.findMany({
        where: {
          status: { in: ['open', 'in_collection'] },
          customer: { status: 'active' },
        },
        select: { currentBalance: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'received' },
        _sum: { amount: true },
      }),
      prisma.installment.count(),
      prisma.installment.count({ where: { status: 'paid' } }),
      prisma.installment.findMany({
        where: { status: 'overdue' },
        select: { dueDate: true },
      }),
      prisma.customer.findMany({
        where: { status: 'active' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          debts: {
            where: { status: { in: ['open', 'in_collection'] } },
            select: {
              currentBalance: true,
              installments: {
                where: { status: 'overdue' },
                select: { id: true },
              },
            },
          },
        },
      }),
      prisma.activityLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          activityName: true,
          description: true,
          createdAt: true,
          customer: { select: { fullName: true } },
        },
      }),
    ]);

    const totalDebt = overdueDebts.reduce(
      (sum, d) => sum + Number(d.currentBalance),
      0
    );
    const collectedAmount = Number(collectedAgg._sum.amount || 0);
    const collectionRate =
      totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0;

    const now = Date.now();
    const avgOverdueDays =
      overdueInstallments.length > 0
        ? overdueInstallments.reduce((sum, inst) => {
            const days = Math.floor(
              (now - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + Math.max(days, 0);
          }, 0) / overdueInstallments.length
        : 0;

    const recentCustomers = recentCustomersRaw.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      totalDebt: c.debts.reduce(
        (sum, d) => sum + Number(d.currentBalance),
        0
      ),
      overdueCount: c.debts.reduce(
        (sum, d) => sum + d.installments.length,
        0
      ),
    }));

    const recentActivities = recentActivitiesRaw.map((a) => ({
      id: a.id,
      type: a.type,
      activityName: a.activityName,
      description: a.description,
      customerName: a.customer?.fullName || null,
      createdAt: a.createdAt.toISOString(),
    }));

    return {
      totalDebt,
      collectedAmount,
      overdueCustomers,
      activeCustomers,
      totalCustomers,
      activeFlows,
      collectionRate,
      totalInvoices: totalInstallments,
      paidInvoices: paidInstallments,
      avgOverdueDays: Math.round(avgOverdueDays),
      targetDebt: 500000,
      recentCustomers,
      recentActivities,
    };
  }

  async generateDashboard(prompt: string): Promise<GeneratedDashboardConfig> {
    if (!process.env.GEMINI_API_KEY) {
      throw new AppError('AI service unavailable: GEMINI_API_KEY not set', 502);
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: GENERATE_DASHBOARD_PROMPT }],
        },
        {
          role: 'model',
          parts: [
            {
              text: 'I understand. I will generate dashboard widget configurations as valid JSON based on user prompts. I will only use the specified chart types and metrics.',
            },
          ],
        },
      ],
    });

    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();

    if (!responseText) {
      throw new AppError('AI returned empty response', 502);
    }

    try {
      const parsed = JSON.parse(responseText) as GeneratedDashboardConfig;

      const validChartTypes = [
        'circular-gauge',
        'linear-scale',
        'donut-progress',
        'risk-heat-scale',
      ];
      if (!validChartTypes.includes(parsed.chart_type)) {
        parsed.chart_type = 'circular-gauge';
      }

      return parsed;
    } catch {
      throw new AppError('AI returned invalid JSON', 502);
    }
  }

  async listCustomDashboards() {
    return prisma.customDashboard.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCustomDashboard(data: {
    title: string;
    description?: string;
    chartType: string;
    chartConfig: Prisma.InputJsonValue;
    filters?: Prisma.InputJsonValue;
    isPublished?: boolean;
  }) {
    return prisma.customDashboard.create({
      data: {
        title: data.title,
        description: data.description,
        chartType: data.chartType,
        chartConfig: data.chartConfig,
        filters: data.filters || {},
        isPublished: data.isPublished ?? true,
      },
    });
  }

  async deleteCustomDashboard(id: string) {
    return prisma.customDashboard.delete({ where: { id } });
  }
}

export const dashboardsService = new DashboardsService();
