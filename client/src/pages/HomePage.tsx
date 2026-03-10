import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { AutoAwesome as SparkleIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import AiKpiRail from '../components/home/AiKpiRail';
import CardDetailDrawer from '../components/home/CardDetailDrawer';
import FlowPromptAssistantDialog from '../components/flows/FlowPromptAssistantDialog';
import InternalAlertsList from '../components/home/InternalAlertsList';
import PriorityQueues from '../components/home/PriorityQueues';
import RecommendationCard from '../components/home/RecommendationCard';
import { useChatVisibility } from '../context/ChatVisibilityContext';
import { useSystemMode } from '../context/SystemModeContext';
import { homeBrain } from '../services/api';
import type {
  GenerateHomeBrainPlanRequest,
  HomeBrainActionIntent,
  HomeBrainRecommendationCard,
} from '../types/home-brain';

type CardStatus = 'approved' | 'modified' | 'skipped' | 'resolved' | 'failed';
type HomePageFilters = NonNullable<GenerateHomeBrainPlanRequest['filters']>;

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setChatHidden } = useChatVisibility();
  const { mode } = useSystemMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planState, setPlanState] = useState<Awaited<ReturnType<typeof homeBrain.generatePlan>> | null>(null);
  const [cardStatuses, setCardStatuses] = useState<Record<string, CardStatus>>({});
  const [drawerCardId, setDrawerCardId] = useState<string | null>(null);
  const [flowPromptOpen, setFlowPromptOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const locale = i18n.language.startsWith('he') ? 'he' : 'en';
  const filters = useMemo<HomePageFilters>(
    () => ({
      segment: (searchParams.get('segment') as HomePageFilters['segment']) || 'all',
      language: (searchParams.get('language') as HomePageFilters['language']) || undefined,
      minOverdueDays: searchParams.get('minOverdueDays')
        ? Number(searchParams.get('minOverdueDays'))
        : undefined,
    }),
    [searchParams]
  );

  useEffect(() => {
    setChatHidden(true);
    return () => setChatHidden(false);
  }, [setChatHidden]);

  const fetchPlan = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const data = await homeBrain.generatePlan({
          locale,
          filters,
          forceRefresh,
          maxCards: 8,
        });
        setPlanState(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Home Brain plan');
      } finally {
        setLoading(false);
      }
    },
    [filters, locale]
  );

  useEffect(() => {
    void fetchPlan();
  }, [fetchPlan]);

  const plan = planState?.plan || null;
  const selectedCard = drawerCardId ? plan?.cards.find((card) => card.cardId === drawerCardId) || null : null;
  const selectedIntent = selectedCard?.actionIntentIds.length
    ? plan?.actionIntents.find((intent) => intent.id === selectedCard.actionIntentIds[0]) || null
    : null;

  const visibleCards = useMemo(
    () =>
      plan?.cards.filter(
        (card) => !['approved', 'skipped', 'resolved'].includes(cardStatuses[card.cardId] || '')
      ) || [],
    [cardStatuses, plan?.cards]
  );

  const updateFilter = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all' || value === '0') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  const mutateCard = async (
    card: HomeBrainRecommendationCard,
    action: 'approve' | 'modify' | 'skip' | 'resolve',
    modifications?: Record<string, unknown>,
    reason?: string
  ) => {
    if (!planState) return;

    try {
      const request = {
        planId: planState.planId,
        performedBy: 'ui',
        modifications,
        reason,
      };
      const response =
        action === 'approve'
          ? await homeBrain.approveCard(card.cardId, request)
          : action === 'modify'
            ? await homeBrain.modifyCard(card.cardId, request)
            : action === 'skip'
              ? await homeBrain.skipCard(card.cardId, request)
              : await homeBrain.resolveCard(card.cardId, request);

      setCardStatuses((current) => ({
        ...current,
        [card.cardId]: response.status,
      }));
      setSnackbar({
        message: `${card.title} ${response.status}`,
        severity: response.status === 'failed' ? 'error' : 'success',
      });
      if (action !== 'modify') {
        setDrawerCardId(null);
      }
    } catch (err) {
      setSnackbar({
        message: err instanceof Error ? err.message : 'Action failed',
        severity: 'error',
      });
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          background: 'linear-gradient(135deg, rgba(30,58,95,0.04), rgba(79,195,247,0.08))',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography
                sx={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.12em', color: 'text.secondary' }}
              >
                PAYDAY AI
              </Typography>
              <SparkleIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.75 }}>
              {plan?.dashboard.title || t('home.welcome')}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 760 }}>
              {plan?.dashboard.subtitle || plan?.reasoningSummary || t('home.subtitle')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="flex-start" useFlexGap flexWrap="wrap">
            <Chip label={`${t('homeBrain.mode')}: ${mode}`} />
            {planState?.cachedAt && (
              <Chip label={`Cached ${new Date(planState.cachedAt).toLocaleTimeString()}`} variant="outlined" />
            )}
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => void fetchPlan(true)}
              disabled={loading}
            >
              {t('common.refresh')}
            </Button>
            <Button variant="contained" onClick={() => setFlowPromptOpen(true)}>
              {locale === 'he' ? 'צור תהליך מפרומפט' : 'Create flow from prompt'}
            </Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 3 }}>
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>{t('homeBrain.segment')}</InputLabel>
            <Select
              label={t('homeBrain.segment')}
              value={filters?.segment || 'all'}
              onChange={(event) => updateFilter('segment', event.target.value)}
            >
              <MenuItem value="all">{t('common.all')}</MenuItem>
              <MenuItem value="high_risk">{t('homeBrain.highRisk')}</MenuItem>
              <MenuItem value="overdue">{t('homeBrain.overdue')}</MenuItem>
              <MenuItem value="no_response">{t('homeBrain.noResponse')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>{t('homeBrain.language')}</InputLabel>
            <Select
              label={t('homeBrain.language')}
              value={filters?.language || ''}
              onChange={(event) => updateFilter('language', event.target.value)}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="he">Hebrew</MenuItem>
              <MenuItem value="ar">Arabic</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>{t('homeBrain.minOverdueDays')}</InputLabel>
            <Select
              label={t('homeBrain.minOverdueDays')}
              value={filters?.minOverdueDays ? String(filters.minOverdueDays) : '0'}
              onChange={(event) => updateFilter('minOverdueDays', event.target.value)}
            >
              <MenuItem value="0">{t('homeBrain.any')}</MenuItem>
              <MenuItem value="7">7+</MenuItem>
              <MenuItem value="14">14+</MenuItem>
              <MenuItem value="30">30+</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : plan ? (
        <>
          <AiKpiRail kpis={plan.dashboard.kpis} />

          <PriorityQueues
            title={t('homeBrain.priorityQueues')}
            queues={plan.dashboard.queues}
            onOpenQueue={() => navigate('/customers')}
          />
          

          <Box>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              {t('homeBrain.recommendations')}
            </Typography>
            {visibleCards.length === 0 ? (
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body1">{plan.reasoningSummary}</Typography>
              </Paper>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {visibleCards.map((card) => (
                  <RecommendationCard
                    key={card.cardId}
                    card={card}
                    status={cardStatuses[card.cardId]}
                    onApprove={(selected) => void mutateCard(selected, 'approve')}
                    onModify={(selected) => setDrawerCardId(selected.cardId)}
                    onSkip={(selected) => void mutateCard(selected, 'skip')}
                    onResolve={(selected) => void mutateCard(selected, 'resolve')}
                  />
                ))}
              </Box>
            )}
          </Box>

          <InternalAlertsList alerts={plan.internalAlerts} />
        </>
      ) : null}

      <CardDetailDrawer
        open={Boolean(selectedCard)}
        card={selectedCard}
        intent={selectedIntent as HomeBrainActionIntent | null}
        onClose={() => setDrawerCardId(null)}
        onModify={async (modifications) => {
          if (selectedCard) {
            await mutateCard(selectedCard, 'modify', modifications);
          }
        }}
        onApprove={async (modifications) => {
          if (selectedCard) {
            await mutateCard(selectedCard, 'approve', modifications);
          }
        }}
      />

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? <Alert severity={snackbar.severity}>{snackbar.message}</Alert> : <span />}
      </Snackbar>

      <FlowPromptAssistantDialog
        open={flowPromptOpen}
        onClose={() => setFlowPromptOpen(false)}
        onFlowSaved={(flow) => {
          setSnackbar({
            message:
              locale === 'he'
                ? `נוצרה טיוטת תהליך: ${flow.name}`
                : `Draft flow created: ${flow.name}`,
            severity: 'success',
          });
        }}
        onOpenFlow={(flowId) => {
          setFlowPromptOpen(false);
          navigate(`/flows?flowId=${flowId}`);
        }}
      />
    </Box>
  );
}
