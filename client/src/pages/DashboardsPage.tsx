import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardsIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
  AccountTree as FlowIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  CircularGauge,
  DonutChart,
  StatCard,
  LinearScale,
  RiskHeatScale,
  DashboardAIPromptBar,
  DashboardBuilder,
  DashboardClientList,
  DashboardRecentActivities,
} from '../components/Dashboard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface DashboardStats {
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

interface CustomDashboard {
  id: string;
  title: string;
  description: string | null;
  chartType: string;
  chartConfig: Record<string, unknown>;
  createdAt: string;
}

export default function DashboardsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [customDashboards, setCustomDashboards] = useState<CustomDashboard[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderPrompt, setBuilderPrompt] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboards/stats`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load stats');
      setStats(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCustomDashboards = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/dashboards`);
      const body = await res.json();
      if (res.ok) setCustomDashboards(body.data || []);
    } catch {
      // non-critical
    }
  }, []);

  const deleteCustomDashboard = async (id: string) => {
    try {
      await fetch(`${API_BASE_URL}/dashboards/${id}`, { method: 'DELETE' });
      setCustomDashboards((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCustomDashboards();
  }, [fetchStats, fetchCustomDashboards]);

  const handleGeneratePrompt = (prompt: string) => {
    setBuilderPrompt(prompt);
    setBuilderOpen(true);
  };

  const handlePublished = () => {
    fetchCustomDashboards();
  };

  const calculateMetric = (config: Record<string, unknown>): number => {
    if (!stats) return 0;
    const metric = config.metric as string;
    switch (metric) {
      case 'collection_rate':
        return stats.collectionRate;
      case 'total_debt':
        return stats.totalDebt;
      case 'total_debt_recovered':
        return stats.collectedAmount;
      case 'recovery_volume':
        return stats.totalDebt;
      case 'avg_overdue_days':
        return stats.avgOverdueDays;
      case 'invoices_paid':
        return stats.paidInvoices;
      case 'active_clients':
        return stats.activeCustomers;
      default:
        return 0;
    }
  };

  const renderCustomDashboard = (dashboard: CustomDashboard) => {
    const value = calculateMetric(dashboard.chartConfig);

    switch (dashboard.chartType) {
      case 'circular-gauge':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularGauge
              value={value}
              maxValue={(dashboard.chartConfig.max as number) || 100}
              label={dashboard.title}
              color={value > 50 ? '#2e7d32' : value > 25 ? '#ed6c02' : '#d32f2f'}
              size={140}
              formatValue={(v) => `${v.toFixed(1)}${(dashboard.chartConfig.unit as string) || '%'}`}
              showPercentage={false}
            />
          </Box>
        );
      case 'linear-scale':
        return (
          <LinearScale
            value={value}
            max={(dashboard.chartConfig.max as number) || 500000}
            label={(dashboard.chartConfig.label as string) || dashboard.title}
            unit={(dashboard.chartConfig.unit as string) || '$'}
            thresholds={
              (dashboard.chartConfig.thresholds as { low: number; medium: number }) || {
                low: 0.5,
                medium: 0.8,
              }
            }
          />
        );
      case 'donut-progress':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <DonutChart
              title={dashboard.title}
              segments={[
                { label: 'Completed', value, color: '#2e7d32' },
                {
                  label: 'Remaining',
                  value: Math.max(((dashboard.chartConfig.max as number) || 100) - value, 0),
                  color: '#e0e0e0',
                },
              ]}
              centerValue={`${((value / ((dashboard.chartConfig.max as number) || 100)) * 100).toFixed(0)}%`}
              centerLabel={(dashboard.chartConfig.subtitle as string) || ''}
              size={140}
            />
          </Box>
        );
      case 'risk-heat-scale':
        return (
          <RiskHeatScale
            value={value}
            label={(dashboard.chartConfig.label as string) || dashboard.title}
            subtitle={(dashboard.chartConfig.subtitle as string) || ''}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* AI Prompt Bar */}
      <Box sx={{ mb: 3 }}>
        <DashboardAIPromptBar onGenerate={handleGeneratePrompt} />
      </Box>

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          <DashboardsIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {t('pages.dashboards.title')}
          </Typography>
          <Chip label="Live" color="success" size="small" />
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            fetchStats();
            fetchCustomDashboards();
          }}
          disabled={loading}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : stats ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* KPI Stat Cards */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
              <StatCard
                title={t('dashboards.totalDebt', 'Total Debt')}
                value={`₪${stats.totalDebt.toLocaleString()}`}
                subtitle={t('dashboards.outstanding', 'Outstanding balance')}
                icon={<MoneyIcon />}
                color="#1976d2"
                trend={{ value: 12.3, label: t('dashboards.thisMonth', 'this month') }}
              />
            </Box>
            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
              <StatCard
                title={t('dashboards.overdueInvoices', 'Overdue Invoices')}
                value={stats.overdueCustomers}
                subtitle={t('dashboards.needsAttention', 'Needs attention')}
                icon={<WarningIcon />}
                color="#d32f2f"
                trend={{ value: -8.1, isPositiveGood: false }}
              />
            </Box>
            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
              <StatCard
                title={t('dashboards.activeClients', 'Active Clients')}
                value={stats.activeCustomers}
                subtitle={`${t('dashboards.of', 'of')} ${stats.totalCustomers} ${t('dashboards.total', 'total')}`}
                icon={<PeopleIcon />}
                color="#2e7d32"
                trend={{ value: 5.2 }}
              />
            </Box>
            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
              <StatCard
                title={t('dashboards.activeFlows', 'Active Flows')}
                value={stats.activeFlows}
                subtitle={t('dashboards.publishedFlows', 'Published flows')}
                icon={<FlowIcon />}
                color="#7b1fa2"
                trend={{ value: 2.4 }}
              />
            </Box>
          </Box>

          {/* Gauge Row 1: CircularGauge + LinearScale */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
              <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 3 }}>
                  {t('dashboards.collectionRate', 'Collection Rate')}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <CircularGauge
                    value={stats.collectionRate}
                    maxValue={100}
                    label={t('dashboards.ofDebtCollected', 'of total debt collected')}
                    color={
                      stats.collectionRate > 50
                        ? '#2e7d32'
                        : stats.collectionRate > 25
                          ? '#ed6c02'
                          : '#d32f2f'
                    }
                    size={160}
                    formatValue={(v) => `${v.toFixed(1)}%`}
                    showPercentage={false}
                  />
                </Box>
              </Paper>
            </Box>
            <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
              <LinearScale
                value={stats.totalDebt}
                max={stats.targetDebt}
                label={t('dashboards.dailyRecovery', 'Debt Recovery Volume')}
                unit="₪"
                thresholds={{ low: 0.5, medium: 0.8 }}
              />
            </Box>
          </Box>

          {/* Gauge Row 2: DonutChart + RiskHeatScale */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
              <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }}>
                <DonutChart
                  title={t('dashboards.overallDebt', 'Overall Collection Progress')}
                  segments={[
                    {
                      label: t('dashboards.paid', 'Paid'),
                      value: stats.paidInvoices,
                      color: '#2e7d32',
                    },
                    {
                      label: t('dashboards.remaining', 'Remaining'),
                      value: Math.max(stats.totalInvoices - stats.paidInvoices, 0),
                      color: '#e0e0e0',
                    },
                  ]}
                  centerValue={`${stats.totalInvoices > 0 ? ((stats.paidInvoices / stats.totalInvoices) * 100).toFixed(0) : 0}%`}
                  centerLabel={`${stats.paidInvoices} / ${stats.totalInvoices}`}
                  size={160}
                />
              </Paper>
            </Box>
            <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
              <RiskHeatScale
                value={stats.avgOverdueDays}
                label={t('dashboards.avgOverdue', 'Average Overdue Days')}
                subtitle={t('dashboards.portfolioHealth', 'Portfolio risk indicator')}
              />
            </Box>
          </Box>

          {/* Custom AI Dashboards */}
          {customDashboards.length > 0 && (
            <>
              <Box sx={{ pt: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {t('dashboards.customDashboards', 'My Custom Dashboards')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t(
                    'dashboards.customDashboardsDesc',
                    'AI-generated dashboards you have created'
                  )}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {customDashboards.map((dashboard) => (
                  <Box key={dashboard.id} sx={{ flex: '1 1 400px', minWidth: 300, position: 'relative' }}>
                    <Paper
                      sx={{
                        p: 3,
                        borderRadius: 2,
                        height: '100%',
                        position: 'relative',
                        '&:hover .delete-btn': { opacity: 1 },
                      }}
                    >
                      <Tooltip title={t('common.delete', 'Delete')}>
                        <IconButton
                          className="delete-btn"
                          size="small"
                          onClick={() => deleteCustomDashboard(dashboard.id)}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            ...(isRTL ? { left: 8 } : { right: 8 }),
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            color: 'error.main',
                            bgcolor: 'error.light',
                            '&:hover': { bgcolor: 'error.main', color: 'white' },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        {dashboard.title}
                      </Typography>
                      {dashboard.description && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                          {dashboard.description}
                        </Typography>
                      )}
                      {renderCustomDashboard(dashboard)}
                    </Paper>
                  </Box>
                ))}
              </Box>
            </>
          )}

          {/* Bottom Row: ClientList + RecentActivities */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
              <DashboardClientList clients={stats.recentCustomers} />
            </Box>
            <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
              <DashboardRecentActivities activities={stats.recentActivities} />
            </Box>
          </Box>
        </Box>
      ) : null}

      {/* Dashboard Builder Dialog */}
      <DashboardBuilder
        open={builderOpen}
        onClose={() => {
          setBuilderOpen(false);
          setBuilderPrompt('');
        }}
        initialPrompt={builderPrompt}
        onPublished={handlePublished}
        statsData={
          stats
            ? {
                collectionRate: stats.collectionRate,
                totalDebt: stats.totalDebt,
                collectedAmount: stats.collectedAmount,
                avgOverdueDays: stats.avgOverdueDays,
                paidInvoices: stats.paidInvoices,
                totalInvoices: stats.totalInvoices,
                activeCustomers: stats.activeCustomers,
                totalCustomers: stats.totalCustomers,
              }
            : undefined
        }
      />
    </Box>
  );
}
