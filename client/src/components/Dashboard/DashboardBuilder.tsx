import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Paper,
  Alert,
} from '@mui/material';
import {
  AutoAwesome as SparkleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import CircularGauge from './CircularGauge';
import LinearScale from './LinearScale';
import DonutChart from './DonutChart';
import RiskHeatScale from './RiskHeatScale';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface DashboardBuilderProps {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string;
  onPublished: () => void;
  statsData?: {
    collectionRate: number;
    totalDebt: number;
    collectedAmount: number;
    avgOverdueDays: number;
    paidInvoices: number;
    totalInvoices: number;
    activeCustomers: number;
    totalCustomers: number;
  };
}

interface GeneratedConfig {
  title: string;
  description: string;
  chart_type: string;
  chart_config: Record<string, unknown>;
}

export default function DashboardBuilder({
  open,
  onClose,
  initialPrompt = '',
  onPublished,
  statsData,
}: DashboardBuilderProps) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<GeneratedConfig | null>(null);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrompt && open) {
      setPrompt(initialPrompt);
      handleGenerate(initialPrompt);
    }
  }, [initialPrompt, open]);

  const handleGenerate = async (promptText?: string) => {
    const text = promptText || prompt;
    if (!text.trim()) return;

    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboards/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Generation failed');
      setPreview(body.data.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!preview) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: preview.title,
          description: preview.description,
          chartType: preview.chart_type,
          chartConfig: preview.chart_config,
          isPublished: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Publish failed');
      }
      setPreview(null);
      setPrompt('');
      onPublished();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setPrompt('');
    setError(null);
    onClose();
  };

  const calculateMetric = (config: Record<string, unknown>): number => {
    if (!statsData) return 75;
    const metric = config.metric as string;
    switch (metric) {
      case 'collection_rate':
        return statsData.collectionRate;
      case 'total_debt':
        return statsData.totalDebt;
      case 'total_debt_recovered':
        return statsData.collectedAmount;
      case 'recovery_volume':
        return statsData.totalDebt;
      case 'avg_overdue_days':
        return statsData.avgOverdueDays;
      case 'invoices_paid':
        return statsData.paidInvoices;
      case 'active_clients':
        return statsData.activeCustomers;
      default:
        return 75;
    }
  };

  const renderPreview = () => {
    if (!preview) return null;
    const { chart_type, chart_config } = preview;
    const value = calculateMetric(chart_config);

    switch (chart_type) {
      case 'circular-gauge':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularGauge
              value={value}
              maxValue={(chart_config.max as number) || 100}
              label={(chart_config.label as string) || preview.title}
              color={value > 50 ? '#2e7d32' : value > 25 ? '#ed6c02' : '#d32f2f'}
              size={160}
              formatValue={(v) => `${v.toFixed(1)}${(chart_config.unit as string) || '%'}`}
              showPercentage={false}
            />
          </Box>
        );
      case 'linear-scale':
        return (
          <LinearScale
            value={value}
            max={(chart_config.max as number) || 500000}
            label={(chart_config.label as string) || preview.title}
            unit={(chart_config.unit as string) || '$'}
            thresholds={
              (chart_config.thresholds as { low: number; medium: number }) || {
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
              title={(chart_config.label as string) || preview.title}
              segments={[
                { label: 'Completed', value, color: '#2e7d32' },
                {
                  label: 'Remaining',
                  value: Math.max(((chart_config.max as number) || 100) - value, 0),
                  color: '#e0e0e0',
                },
              ]}
              centerValue={`${((value / ((chart_config.max as number) || 100)) * 100).toFixed(0)}%`}
              centerLabel={(chart_config.subtitle as string) || ''}
              size={140}
            />
          </Box>
        );
      case 'risk-heat-scale':
        return (
          <RiskHeatScale
            value={value}
            label={(chart_config.label as string) || preview.title}
            subtitle={(chart_config.subtitle as string) || ''}
          />
        );
      default:
        return (
          <Typography variant="body2" sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            {t('dashboards.chartComingSoon', `Chart type "${chart_type}" preview coming soon`)}
          </Typography>
        );
    }
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SparkleIcon sx={{ color: 'primary.main' }} />
        {t('dashboards.buildDashboard', 'Build Dashboard on the Fly')}
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!preview ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {t('dashboards.whatDashboard', 'What kind of dashboard would you like to create?')}
            </Typography>
            <TextField
              multiline
              minRows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t(
                'dashboards.examplePrompts',
                'Example: Show me total collections by segment\nCreate a risk indicator for overdue invoices\nBuild a gauge showing collection rate'
              )}
              disabled={generating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleGenerate();
                }
              }}
            />
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={handleCancel}>
                {t('common.close', 'Close')}
              </Button>
              <Button
                variant="contained"
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || generating}
                startIcon={generating ? <CircularProgress size={16} /> : <SparkleIcon />}
              >
                {generating
                  ? t('dashboards.generating', 'Generating...')
                  : t('dashboards.generate', 'Generate Dashboard')}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {preview.title}
              </Typography>
              {preview.description && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  {preview.description}
                </Typography>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
                {t('dashboards.preview', 'Dashboard Preview')}
              </Typography>
              {renderPreview()}
            </Paper>
          </Box>
        )}
      </DialogContent>

      {preview && (
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="outlined" onClick={handleCancel} startIcon={<CloseIcon />}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handlePublish}
            disabled={publishing}
            startIcon={publishing ? <CircularProgress size={16} /> : undefined}
          >
            {publishing
              ? t('dashboards.publishing', 'Publishing...')
              : t('dashboards.publish', 'Publish to My Dashboards')}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
