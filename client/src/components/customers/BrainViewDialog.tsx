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

function formatChannelLabel(channel: FlowChannel | null): string {
  switch (channel) {
    case 'email':
      return 'Email';
    case 'sms':
      return 'SMS';
    case 'whatsapp':
      return 'WhatsApp';
    case 'call_task':
      return 'Voice Call';
    default:
      return 'Auto';
  }
}

function formatToneLabel(tone: FlowTone | null | undefined): string {
  switch (tone) {
    case 'calm':
      return 'Calm';
    case 'medium':
      return 'Medium';
    case 'heavy':
      return 'Heavy';
    default:
      return 'Auto';
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

function getFlowStatusMeta(
  instanceStatus: FlowInstanceStatus | null | undefined,
  hasFlow: boolean
): { label: string; color: StatusChipColor } {
  if (!hasFlow) {
    return { label: 'No Flow', color: 'default' };
  }

  if (!instanceStatus) {
    return { label: 'Not Started', color: 'default' };
  }

  switch (instanceStatus) {
    case 'completed_end':
      return { label: 'Completed', color: 'success' };
    case 'completed_paid':
      return { label: 'Paid', color: 'success' };
    case 'failed':
      return { label: 'Escalated', color: 'error' };
    case 'running':
    default:
      return { label: 'Active', color: 'warning' };
  }
}

function getStepStatusMeta(status: CollectionFlowStateStatusDto['status']) {
  switch (status) {
    case 'completed':
      return {
        label: 'Completed',
        color: 'success' as StatusChipColor,
        accent: '#2e7d32',
        background: '#f1f8f4',
      };
    case 'waiting':
      return {
        label: 'Waiting',
        color: 'warning' as StatusChipColor,
        accent: '#ed6c02',
        background: '#fff8f1',
      };
    case 'failed':
      return {
        label: 'Failed',
        color: 'error' as StatusChipColor,
        accent: '#c62828',
        background: '#fff5f5',
      };
    case 'upcoming':
    default:
      return {
        label: 'Upcoming',
        color: 'default' as StatusChipColor,
        accent: '#607d8b',
        background: '#f8fafc',
      };
  }
}

function getStepDateLabel(step: CollectionFlowStateStatusDto): string {
  switch (step.status) {
    case 'completed':
    case 'failed':
      return 'Execution Date';
    case 'waiting':
    case 'upcoming':
    default:
      return 'Scheduled Date';
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
  language,
  emptyMessage,
}: {
  title: string;
  steps: CollectionFlowStateStatusDto[];
  language: SupportedLanguage;
  emptyMessage: string;
}) {
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
            {steps.length} step{steps.length === 1 ? '' : 's'}
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
                      {getStepDateLabel(step)}:{' '}
                      {formatDateTime(
                        getStepDateValue(step),
                        language,
                        step.status === 'completed' || step.status === 'failed' ? 'Not recorded' : 'Not scheduled'
                      )}
                    </Typography>
                  </Box>
                  <Chip size="small" label={statusMeta.label} color={statusMeta.color} />
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
  const customerId = customer?.id ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerFlow, setCustomerFlow] = useState<CustomerCollectionFlowDto | null>(null);

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
  const flowStatus = getFlowStatusMeta(instance?.status, Boolean(assignedFlow || instance));
  const flowName = assignedFlow?.name ?? instance?.flow.name ?? 'No assigned flow';
  const flowVersion = assignedFlow?.version ?? instance?.flow.version ?? null;
  const currentStage =
    instance?.currentState?.stateName ||
    currentStep?.state.stateName ||
    (assignedFlow || instance ? 'Not started' : 'No assigned flow');

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
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
                Brain View
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {customer?.fullName || 'Customer'} {flowName !== 'No assigned flow' ? `• ${flowName}` : ''}
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
              Refresh
            </Button>
            <IconButton onClick={onClose} aria-label="Close Brain View">
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
              <Typography color="text.secondary">Loading Brain View...</Typography>
            </Stack>
          </Box>
        ) : error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void loadBrainView()}>
                Retry
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
                      Customer Flow Overview
                    </Typography>
                    <Typography variant="h4" fontWeight={700}>
                      {customer.fullName}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {flowName}
                      {flowVersion ? ` • v${flowVersion}` : ''}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip label={`Flow Status: ${flowStatus.label}`} color={flowStatus.color} />
                    {instance && <Chip label={`Runtime: ${instance.status}`} variant="outlined" />}
                    {assignedFlow && <Chip label={`Flow Key: ${assignedFlow.flowKey}`} variant="outlined" />}
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
                  <SummaryMetric label="Customer Name" value={customer.fullName} />
                  <SummaryMetric
                    label="Total Outstanding Amount"
                    value={formatCurrency(customer.totalDebtAmount, language)}
                    emphasize={customer.totalDebtAmount > 0}
                  />
                  <SummaryMetric label="Channel" value={formatChannelLabel(currentChannel)} />
                  <SummaryMetric label="Current Stage" value={currentStage} />
                  <SummaryMetric label="Flow Status" value={flowStatus.label} />
                </Box>
              </Stack>
            </Paper>

            {!assignedFlow && !instance && (
              <Alert severity="info">No active collection flow is assigned to this customer.</Alert>
            )}

            {assignedFlow && !instance && (
              <Alert severity="info">This customer has an assigned flow, but it has not started yet.</Alert>
            )}

            {instance?.status === 'completed_paid' && (
              <Alert severity="success">
                This flow stopped automatically because the customer paid the debt.
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
                    Assigned Flow
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Current stage highlighting is based on the customer&apos;s live collection runtime.
                  </Typography>
                  <FlowDiagramView
                    states={assignedFlow.states}
                    transitions={assignedFlow.transitions}
                    currentStateId={instance?.currentState?.id ?? null}
                    stateStatuses={stateStatuses}
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
                        Runtime Snapshot
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Quick view of what already ran and what comes next.
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 1.5,
                      }}
                    >
                      <SummaryMetric label="Executed Steps" value={String(executedSteps.length)} />
                      <SummaryMetric label="Pending Steps" value={String(pendingSteps.length)} />
                    </Box>

                    <Divider />

                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Current Channel
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {formatChannelLabel(currentChannel)}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Current Tone
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {formatToneLabel(currentStep?.state.tone ?? fallbackTone)}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Next Scheduled Step
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {nextScheduledStep?.state.stateName || 'No scheduled step'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateTime(
                            nextScheduledStep ? getStepDateValue(nextScheduledStep) : null,
                            language,
                            'Not scheduled'
                          )}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Last Executed Step
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {lastExecutedStep?.state.stateName || 'No executed step yet'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateTime(
                            lastExecutedStep ? getStepDateValue(lastExecutedStep) : null,
                            language,
                            'Not recorded'
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
                  Timeline of Flow Steps
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                  Completed, waiting, failed, and upcoming steps in execution order.
                </Typography>

                {stateStatuses.length === 0 ? (
                  <Alert severity="info">
                    This customer has a flow definition, but no runtime step history is available yet.
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
                                    {isCurrent && <Chip size="small" label="Current Stage" color="warning" />}
                                  </Stack>
                                  <Typography variant="body2" color="text.secondary">
                                    {step.state.actionName}
                                  </Typography>
                                </Box>

                                <Chip size="small" label={statusMeta.label} color={statusMeta.color} />
                              </Stack>

                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                <Chip size="small" variant="outlined" label={`Tone: ${formatToneLabel(stepTone)}`} />
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`Channel: ${formatChannelLabel(stepChannel)}`}
                                />
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`${getStepDateLabel(step)}: ${formatDateTime(
                                    getStepDateValue(step),
                                    language,
                                    step.status === 'completed' || step.status === 'failed'
                                      ? 'Not recorded'
                                      : 'Not scheduled'
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
                  title="Executed Steps"
                  steps={executedSteps}
                  language={language}
                  emptyMessage="No steps were executed yet."
                />
                <StepQueueList
                  title="Upcoming Steps"
                  steps={pendingSteps}
                  language={language}
                  emptyMessage="No pending or scheduled steps remain."
                />
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
