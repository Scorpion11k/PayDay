import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import AiKpiRail from '../components/home/AiKpiRail';
import CardDetailDrawer from '../components/home/CardDetailDrawer';
import FlowPromptAssistantDialog from '../components/flows/FlowPromptAssistantDialog';
import InternalAlertsList from '../components/home/InternalAlertsList';
import PriorityQueues from '../components/home/PriorityQueues';
import RecommendationCard from '../components/home/RecommendationCard';
import { useChatVisibility } from '../context/ChatVisibilityContext';
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
  const [searchParams] = useSearchParams();
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

  const openQueue = (queue: { queueId: string; title: string; description?: string; priority: string; count: number; customerIds: string[] }) => {
    const params = new URLSearchParams();
    params.set('queueId', queue.queueId);
    params.set('queueTitle', queue.title);
    params.set('queuePriority', queue.priority);
    params.set('queueCount', String(queue.count));
    if (queue.description) {
      params.set('queueDescription', queue.description);
    }
    if (queue.customerIds.length > 0) {
      params.set('queueCustomerIds', queue.customerIds.join(','));
    }
    navigate({
      pathname: '/customers',
      search: params.toString(),
    });
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
            onOpenQueue={openQueue}
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
