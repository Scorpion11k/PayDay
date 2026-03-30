import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  AccountTree as BrainViewIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import FlowDiagramView from '../FlowBuilder/FlowDiagramView';
import { getCustomerCollectionFlow } from '../../services/api';
import type {
  CollectionFlowStateStatusDto,
  CustomerCollectionFlowDto,
  FlowChannel,
  FlowInstanceStatus,
  FlowTone,
} from '../../types/flows';

type SupportedLanguage = 'en' | 'he' | 'ar';
type StatusChipColor = 'default' | 'success' | 'warning' | 'error';

export interface BrainViewCustomer {
  id: string;
  fullName: string;
  totalDebtAmount: number;
  preferredChannel: FlowChannel | null;
  preferredTone: FlowTone | null;
}

interface BrainViewDialogProps {
  open: boolean;
  customer: BrainViewCustomer | null;
  language: SupportedLanguage;
  onClose: () => void;
}

function getLocale(language: SupportedLanguage): string {
  switch (language) {
    case 'he':
      return 'he-IL';
    case 'ar':
      return 'ar';
    default:
      return 'en-US';
  }
}

function formatDateTime(value: string | null | undefined, language: SupportedLanguage, fallback: string): string {
  if (!value) return fallback;

  return new Intl.DateTimeFormat(getLocale(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatCurrency(amount: number, language: SupportedLanguage): string {
  return new Intl.NumberFormat(getLocale(language), {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getChannelKey(channel: FlowChannel | null): string {
  switch (channel) {
    case 'email':
      return 'email';
    case 'sms':
      return 'sms';
    case 'whatsapp':
      return 'whatsapp';
    case 'call_task':
      return 'voiceCall';
    default:
      return 'auto';
  }
}

function getToneKey(tone: FlowTone | null | undefined): string {
  switch (tone) {
    case 'calm':
      return 'calm';
    case 'medium':
      return 'medium';
    case 'heavy':
      return 'heavy';
    default:
      return 'auto';
  }
}

function resolveStateChannel(
  state: Pick<CollectionFlowStateStatusDto['state'], 'actionType' | 'explicitChannel'> | null | undefined,
  fallbackChannel: FlowChannel | null
): FlowChannel | null {
  if (!state) {
    return fallbackChannel;
  }

  if (state.explicitChannel) {
    return state.explicitChannel;
  }

  switch (state.actionType) {
    case 'send_email':
      return 'email';
    case 'send_sms':
      return 'sms';
    case 'send_whatsapp':
      return 'whatsapp';
    case 'voice_call':
      return 'call_task';
    default:
      return fallbackChannel;
  }
}

function getFlowStatusKey(
  instanceStatus: FlowInstanceStatus | null | undefined,
  hasFlow: boolean
): { key: string; color: StatusChipColor } {
  if (!hasFlow) {
    return { key: 'noFlow', color: 'default' };
  }

  if (!instanceStatus) {
    return { key: 'notStarted', color: 'default' };
  }

  switch (instanceStatus) {
    case 'completed_end':
      return { key: 'completed', color: 'success' };
    case 'completed_paid':
      return { key: 'paid', color: 'success' };
    case 'failed':
      return { key: 'escalated', color: 'error' };
    case 'running':
    default:
      return { key: 'active', color: 'warning' };
  }
}

function getStepStatusMeta(status: CollectionFlowStateStatusDto['status']) {
  switch (status) {
    case 'completed':
      return {
        key: 'completed',
        color: 'success' as StatusChipColor,
        accent: '#2e7d32',
        background: '#f1f8f4',
      };
    case 'waiting':
      return {
        key: 'waiting',
        color: 'warning' as StatusChipColor,
        accent: '#ed6c02',
        background: '#fff8f1',
      };
    case 'failed':
      return {
        key: 'failed',
        color: 'error' as StatusChipColor,
        accent: '#c62828',
        background: '#fff5f5',
      };
    case 'upcoming':
    default:
      return {
        key: 'upcoming',
        color: 'default' as StatusChipColor,
        accent: '#607d8b',
        background: '#f8fafc',
      };
  }
}

function getStepDateKey(step: CollectionFlowStateStatusDto): string {
  switch (step.status) {
    case 'completed':
    case 'failed':
      return 'executionDate';
    case 'waiting':
    case 'upcoming':
    default:
      return 'scheduledDate';
  }
}

function getStepDateValue(step: CollectionFlowStateStatusDto): string | null {
  switch (step.status) {
    case 'completed':
      return step.completedAt || step.executedAt || step.enteredAt || step.dueAt || null;
    case 'failed':
      return step.failedAt || step.executedAt || step.enteredAt || step.dueAt || null;
    case 'waiting':
    case 'upcoming':
    default:
      return step.dueAt || step.enteredAt || null;
  }
}

function getLastStep(steps: CollectionFlowStateStatusDto[]): CollectionFlowStateStatusDto | null {
  if (steps.length === 0) {
    return null;
  }

  return steps[steps.length - 1];
}

function SummaryMetric({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        borderRadius: 2,
        borderColor: 'divider',
        bgcolor: '#fff',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        {label}
      </Typography>
      <Typography
        variant="subtitle1"
        fontWeight={emphasize ? 700 : 600}
        color={emphasize ? 'error.main' : 'text.primary'}
      >
        {value}
      </Typography>
    </Paper>
  );
}

function StepQueueList({
  title,
  steps,
  language: _language,
  emptyMessage,
  stepStatusLabels,
  dateLabelFn,
  dateFormatFn,
}: {
  title: string;
  steps: CollectionFlowStateStatusDto[];
  language: SupportedLanguage;
  emptyMessage: string;
  stepStatusLabels: Record<string, string>;
  dateLabelFn: (step: CollectionFlowStateStatusDto) => string;
  dateFormatFn: (value: string | null | undefined, fallback: string) => string;
}) {
  const { t } = useTranslation();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.25,
        borderRadius: 3,
        borderColor: 'divider',
        bgcolor: '#fff',
      }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('brainView.stepCount', { count: steps.length })}
          </Typography>
        </Box>

        {steps.length === 0 ? (
          <Alert severity="info">{emptyMessage}</Alert>
        ) : (
          steps.map((step) => {
            const statusMeta = getStepStatusMeta(step.status);
            return (
              <Box
                key={step.id}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: statusMeta.background,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {step.state.stateName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dateLabelFn(step)}:{' '}
                      {dateFormatFn(
                        getStepDateValue(step),
                        step.status === 'completed' || step.status === 'failed'
                          ? t('brainView.dates.notRecorded')
                          : t('brainView.dates.notScheduled')
                      )}
                    </Typography>
                  </Box>
                  <Chip size="small" label={stepStatusLabels[statusMeta.key]} color={statusMeta.color} />
                </Stack>
              </Box>
            );
          })
        )}
      </Stack>
    </Paper>
  );
}

export default function BrainViewDialog({
  open,
  customer,
  language,
  onClose,
}: BrainViewDialogProps) {
  const { t } = useTranslation();
  const customerId = customer?.id ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerFlow, setCustomerFlow] = useState<CustomerCollectionFlowDto | null>(null);

  const isRtl = language === 'he' || language === 'ar';

  const loadBrainView = useCallback(
    async (background = false) => {
      if (!customerId) {
        return;
      }

      if (!background) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await getCustomerCollectionFlow(customerId);
        setCustomerFlow(data);
        if (!background) {
          setError(null);
        }
      } catch (loadError) {
        if (!background) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load Brain View');
        }
      } finally {
        if (!background) {
          setLoading(false);
        }
      }
    },
    [customerId]
  );

  useEffect(() => {
    if (!open || !customerId) {
      setLoading(false);
      setError(null);
      setCustomerFlow(null);
      return;
    }

    setCustomerFlow(null);
    void loadBrainView();
  }, [customerId, loadBrainView, open]);

  useEffect(() => {
    if (!open || !customerId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadBrainView(true);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [customerId, loadBrainView, open]);

  const assignedFlow = customerFlow?.assignment?.flow ?? null;
  const instance = customerFlow?.instance ?? null;
  const stateStatuses = instance?.stateStatuses ?? [];
  const executedSteps = useMemo(
    () => stateStatuses.filter((step) => step.status === 'completed' || step.status === 'failed'),
    [stateStatuses]
  );
  const pendingSteps = useMemo(
    () => stateStatuses.filter((step) => step.status === 'waiting' || step.status === 'upcoming'),
    [stateStatuses]
  );

  const currentStep = useMemo(() => {
    if (instance?.currentState?.id) {
      const currentStateMatch = stateStatuses.find((step) => step.state.id === instance.currentState?.id);
      if (currentStateMatch) {
        return currentStateMatch;
      }
    }

    return (
      stateStatuses.find((step) => step.status === 'waiting') ||
      pendingSteps[0] ||
      getLastStep(executedSteps)
    );
  }, [executedSteps, instance?.currentState?.id, pendingSteps, stateStatuses]);

  const lastExecutedStep = useMemo(() => getLastStep(executedSteps), [executedSteps]);
  const nextScheduledStep = pendingSteps[0] ?? null;
  const fallbackChannel = customerFlow?.customer.preferredChannel ?? customer?.preferredChannel ?? null;
  const fallbackTone = customerFlow?.customer.preferredTone ?? customer?.preferredTone ?? null;
  const currentChannel = resolveStateChannel(currentStep?.state, fallbackChannel);
  const flowStatus = getFlowStatusKey(instance?.status, Boolean(assignedFlow || instance));
  const flowStatusLabel = t(`brainView.statuses.${flowStatus.key}`);
  const flowName = assignedFlow?.name ?? instance?.flow.name ?? null;
  const flowVersion = assignedFlow?.version ?? instance?.flow.version ?? null;
  const currentStage =
    instance?.currentState?.stateName ||
    currentStep?.state.stateName ||
    (assignedFlow || instance ? t('brainView.notStarted') : t('brainView.noAssignedFlow'));

  const channelLabel = t(`brainView.channels.${getChannelKey(currentChannel)}`);
  const toneLabel = t(`brainView.tones.${getToneKey(currentStep?.state.tone ?? fallbackTone)}`);

  const stepStatusLabels: Record<string, string> = useMemo(() => ({
    completed: t('brainView.stepStatuses.completed'),
    waiting: t('brainView.stepStatuses.waiting'),
    failed: t('brainView.stepStatuses.failed'),
    upcoming: t('brainView.stepStatuses.upcoming'),
  }), [t]);

  const dateLabelFn = useCallback(
    (step: CollectionFlowStateStatusDto) => t(`brainView.dates.${getStepDateKey(step)}`),
    [t]
  );

  const dateFormatFn = useCallback(
    (value: string | null | undefined, fallback: string) => formatDateTime(value, language, fallback),
    [language]
  );

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <Box dir={isRtl ? 'rtl' : 'ltr'} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DialogTitle
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <BrainViewIcon sx={{ fontSize: 30, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" fontWeight={700}>
                {t('brainView.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {customer?.fullName || t('brainView.customer')} {flowName ? `• ${flowName}` : ''}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ ml: { sm: 'auto' } }}>
            <Button
              variant="outlined"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
              onClick={() => void loadBrainView()}
              disabled={!customerId || loading}
            >
              {t('brainView.refresh')}
            </Button>
            <IconButton onClick={onClose} aria-label={t('brainView.closeBrainView')}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 2, md: 3 }, py: 3, bgcolor: '#f8fafc' }}>
        {!customer ? null : loading ? (
          <Box sx={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
            <Stack spacing={2} alignItems="center">
              <CircularProgress />
              <Typography color="text.secondary">{t('brainView.loadingBrainView')}</Typography>
            </Stack>
          </Box>
        ) : error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void loadBrainView()}>
                {t('brainView.refresh')}
              </Button>
            }
          >
            {error}
          </Alert>
        ) : (
          <Stack spacing={3}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 3,
                borderColor: 'divider',
                background: 'linear-gradient(135deg, #ffffff 0%, #f7fbff 55%, #eef6ff 100%)',
              }}
            >
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', lg: 'center' }}
                  spacing={2}
                >
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
                      {t('brainView.customerFlowOverview')}
                    </Typography>
                    <Typography variant="h4" fontWeight={700}>
                      {customer.fullName}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {flowName ?? t('brainView.noAssignedFlow')}
                      {flowVersion ? ` • v${flowVersion}` : ''}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip label={t('brainView.flowStatusLabel', { status: flowStatusLabel })} color={flowStatus.color} />
                    {instance && <Chip label={t('brainView.runtimeLabel', { status: instance.status })} variant="outlined" />}
                    {assignedFlow && <Chip label={t('brainView.flowKeyLabel', { key: assignedFlow.flowKey })} variant="outlined" />}
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(5, minmax(0, 1fr))',
                    },
                    gap: 2,
                  }}
                >
                  <SummaryMetric label={t('brainView.customerName')} value={customer.fullName} />
                  <SummaryMetric
                    label={t('brainView.totalOutstandingAmount')}
                    value={formatCurrency(customer.totalDebtAmount, language)}
                    emphasize={customer.totalDebtAmount > 0}
                  />
                  <SummaryMetric label={t('brainView.channel')} value={channelLabel} />
                  <SummaryMetric label={t('brainView.currentStage')} value={currentStage} />
                  <SummaryMetric label={t('brainView.flowStatus')} value={flowStatusLabel} />
                </Box>
              </Stack>
            </Paper>

            {!assignedFlow && !instance && (
              <Alert severity="info">{t('brainView.noActiveFlow')}</Alert>
            )}

            {assignedFlow && !instance && (
              <Alert severity="info">{t('brainView.flowNotStarted')}</Alert>
            )}

            {instance?.status === 'completed_paid' && (
              <Alert severity="success">
                {t('brainView.flowStoppedPaid')}
              </Alert>
            )}

            {instance?.lastError && <Alert severity="warning">{instance.lastError}</Alert>}

            {assignedFlow && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    xl: 'minmax(0, 1.2fr) minmax(340px, 0.8fr)',
                  },
                  gap: 3,
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    borderRadius: 3,
                    borderColor: 'divider',
                    bgcolor: '#fff',
                  }}
                >
                  <Typography variant="h6" fontWeight={700}>
                    {t('brainView.assignedFlow')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('brainView.stageHighlightingNote')}
                  </Typography>
                  <FlowDiagramView
                    states={assignedFlow.states}
                    transitions={assignedFlow.transitions}
                    currentStateId={instance?.currentState?.id ?? null}
                    stateStatuses={stateStatuses}
                    layout="vertical"
                    runtimeMode
                  />
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    borderColor: 'divider',
                    bgcolor: '#fff',
                  }}
                >
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        {t('brainView.runtimeSnapshot')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('brainView.runtimeSnapshotDesc')}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 1.5,
                      }}
                    >
                      <SummaryMetric label={t('brainView.executedSteps')} value={String(executedSteps.length)} />
                      <SummaryMetric label={t('brainView.pendingSteps')} value={String(pendingSteps.length)} />
                    </Box>

                    <Divider />

                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('brainView.currentChannel')}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {channelLabel}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('brainView.currentTone')}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {toneLabel}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('brainView.nextScheduledStep')}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {nextScheduledStep?.state.stateName || t('brainView.noScheduledStep')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateTime(
                            nextScheduledStep ? getStepDateValue(nextScheduledStep) : null,
                            language,
                            t('brainView.dates.notScheduled')
                          )}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('brainView.lastExecutedStep')}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {lastExecutedStep?.state.stateName || t('brainView.noExecutedStepYet')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateTime(
                            lastExecutedStep ? getStepDateValue(lastExecutedStep) : null,
                            language,
                            t('brainView.dates.notRecorded')
                          )}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </Paper>
              </Box>
            )}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: 'minmax(0, 1.35fr) minmax(320px, 0.65fr)',
                },
                gap: 3,
              }}
            >
              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderRadius: 3,
                  borderColor: 'divider',
                  bgcolor: '#fff',
                }}
              >
                <Typography variant="h6" fontWeight={700}>
                  {t('brainView.timelineTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                  {t('brainView.timelineDesc')}
                </Typography>

                {stateStatuses.length === 0 ? (
                  <Alert severity="info">
                    {t('brainView.noRuntimeHistory')}
                  </Alert>
                ) : (
                  <Stack spacing={1.75}>
                    {stateStatuses.map((step, index) => {
                      const statusMeta = getStepStatusMeta(step.status);
                      const isCurrent = currentStep?.id === step.id;
                      const stepChannel = resolveStateChannel(step.state, fallbackChannel);
                      const stepTone = step.state.tone ?? fallbackTone;

                      return (
                        <Box
                          key={step.id}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '28px minmax(0, 1fr)',
                            gap: 1.5,
                          }}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box
                              sx={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                bgcolor: statusMeta.accent,
                                boxShadow: `0 0 0 4px ${statusMeta.background}`,
                                mt: 1,
                              }}
                            />
                            {index < stateStatuses.length - 1 && (
                              <Box
                                sx={{
                                  width: 2,
                                  flex: 1,
                                  minHeight: 56,
                                  bgcolor: 'divider',
                                  mt: 0.75,
                                }}
                              />
                            )}
                          </Box>

                          <Paper
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 2.5,
                              borderColor: isCurrent ? statusMeta.accent : 'divider',
                              bgcolor: statusMeta.background,
                            }}
                          >
                            <Stack spacing={1.5}>
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                justifyContent="space-between"
                                spacing={1}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                                    <Typography variant="subtitle1" fontWeight={700}>
                                      {step.state.stateName}
                                    </Typography>
                                    {isCurrent && <Chip size="small" label={t('brainView.currentStageBadge')} color="warning" />}
                                  </Stack>
                                  <Typography variant="body2" color="text.secondary">
                                    {step.state.actionName}
                                  </Typography>
                                </Box>

                                <Chip size="small" label={stepStatusLabels[statusMeta.key]} color={statusMeta.color} />
                              </Stack>

                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={t('brainView.toneLabel', { tone: t(`brainView.tones.${getToneKey(stepTone)}`) })}
                                />
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={t('brainView.channelLabel', { channel: t(`brainView.channels.${getChannelKey(stepChannel)}`) })}
                                />
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`${t(`brainView.dates.${getStepDateKey(step)}`)}: ${formatDateTime(
                                    getStepDateValue(step),
                                    language,
                                    step.status === 'completed' || step.status === 'failed'
                                      ? t('brainView.dates.notRecorded')
                                      : t('brainView.dates.notScheduled')
                                  )}`}
                                />
                              </Stack>

                              {step.errorMessage && <Alert severity="error">{step.errorMessage}</Alert>}
                            </Stack>
                          </Paper>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              <Stack spacing={3}>
                <StepQueueList
                  title={t('brainView.executedSteps')}
                  steps={executedSteps}
                  language={language}
                  emptyMessage={t('brainView.noStepsExecuted')}
                  stepStatusLabels={stepStatusLabels}
                  dateLabelFn={dateLabelFn}
                  dateFormatFn={dateFormatFn}
                />
                <StepQueueList
                  title={t('brainView.upcomingSteps')}
                  steps={pendingSteps}
                  language={language}
                  emptyMessage={t('brainView.noPendingSteps')}
                  stepStatusLabels={stepStatusLabels}
                  dateLabelFn={dateLabelFn}
                  dateFormatFn={dateFormatFn}
                />
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>
      </Box>
    </Dialog>
  );
}
