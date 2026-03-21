import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AccountTree as FlowsIcon,
  Add as AddIcon,
  ContentCopy as VersionIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as RunIcon,
  Publish as PublishIcon,
  Refresh as RefreshIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import GraphFlowBuilder from '../components/FlowBuilder/GraphFlowBuilder';
import FlowDiagramView from '../components/FlowBuilder/FlowDiagramView';
import FlowPromptAssistantDialog from '../components/flows/FlowPromptAssistantDialog';
import {
  assignCustomerFlow,
  createFlow,
  createNewFlowVersion,
  deleteFlow,
  getCustomerCollectionFlow,
  getFlowById,
  listCustomersForFlowMonitor,
  listFlows,
  publishFlow,
  runFlowExecutorOnce,
  setDefaultFlow,
  updateFlow,
  type CreateFlowPayload,
  type CustomerListItem,
} from '../services/api';
import type {
  CustomerCollectionFlowDto,
  FlowDefinitionDto,
  FlowStateInstanceStatus,
  FlowSummaryDto,
} from '../types/flows';

const flowStatusColor: Record<string, 'default' | 'success' | 'warning'> = {
  draft: 'default',
  published: 'success',
  archived: 'warning',
};

const instanceStatusColor: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  running: 'warning',
  completed_paid: 'success',
  completed_end: 'success',
  failed: 'error',
};

const stepStatusColor: Record<FlowStateInstanceStatus, 'default' | 'success' | 'warning' | 'error'> = {
  upcoming: 'default',
  waiting: 'warning',
  completed: 'success',
  failed: 'error',
};

export default function FlowsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const [flows, setFlows] = useState<FlowSummaryDto[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<FlowDefinitionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<FlowDefinitionDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerFlow, setCustomerFlow] = useState<CustomerCollectionFlowDto | null>(null);
  const [assignFlowId, setAssignFlowId] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const refreshFlows = async (preferredFlowId?: string | null) => {
    setLoading(true);
    try {
      const data = await listFlows();
      setFlows(data);

      const queryFlowId = searchParams.get('flowId');
      const requestedId = preferredFlowId || queryFlowId || selectedFlowId;
      const activeId = requestedId && data.some((flow) => flow.id === requestedId)
        ? requestedId
        : data[0]?.id || null;

      setSelectedFlowId(activeId);
      if (activeId) {
        const detail = await getFlowById(activeId);
        setSelectedFlow(detail);
      } else {
        setSelectedFlow(null);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.loadFlows'),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFlowDetail = async (id: string) => {
    setSelectedFlowId(id);
    try {
      const detail = await getFlowById(id);
      setSelectedFlow(detail);
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.loadFlow'),
        severity: 'error',
      });
    }
  };

  const refreshCustomers = async () => {
    try {
      const data = await listCustomersForFlowMonitor(100);
      setCustomers(data);
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.loadCustomers'),
        severity: 'error',
      });
    }
  };

  const fetchCustomerFlow = useCallback(async (customerId: string) => {
    const data = await getCustomerCollectionFlow(customerId);
    setCustomerFlow(data);
    return data;
  }, []);

  const loadCustomerFlow = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    try {
      const data = await fetchCustomerFlow(customerId);
      setAssignFlowId(data.assignment?.flowId || '');
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.loadCustomerFlow'),
        severity: 'error',
      });
    }
  };

  useEffect(() => {
    void refreshFlows(searchParams.get('flowId'));
    void refreshCustomers();
  }, []);

  useEffect(() => {
    if (tab !== 1 || !selectedCustomerId) {
      return;
    }

    const intervalId = setInterval(() => {
      void fetchCustomerFlow(selectedCustomerId);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [tab, selectedCustomerId, fetchCustomerFlow]);

  const openCreate = () => {
    setEditingFlow(null);
    setBuilderOpen(true);
  };

  const openPromptCreate = () => {
    setPromptDialogOpen(true);
  };

  const openEdit = () => {
    if (!selectedFlow) return;
    if (selectedFlow.status !== 'draft') {
      setSnackbar({
        open: true,
        message: t('pages.flows.onlyDraftCanEdit'),
        severity: 'info',
      });
      return;
    }
    setEditingFlow(selectedFlow);
    setBuilderOpen(true);
  };

  const saveDefinition = async (payload: CreateFlowPayload) => {
    setSaving(true);
    try {
      if (editingFlow) {
        await updateFlow(editingFlow.id, {
          ...payload,
          updatedBy: 'ui',
        });
        setSnackbar({ open: true, message: t('pages.flows.messages.flowUpdated'), severity: 'success' });
      } else {
        const created = await createFlow({
          ...payload,
          createdBy: 'ui',
        });
        setSelectedFlowId(created.id);
        setSnackbar({ open: true, message: t('pages.flows.messages.flowCreated'), severity: 'success' });
      }
      setBuilderOpen(false);
      setEditingFlow(null);
      await refreshFlows();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.saveFlow'),
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const publishSelected = async () => {
    if (!selectedFlow) return;
    try {
      await publishFlow(selectedFlow.id, 'ui');
      setSnackbar({ open: true, message: t('pages.flows.messages.flowPublished'), severity: 'success' });
      await refreshFlows();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.publishFailed'),
        severity: 'error',
      });
    }
  };

  const setDefaultSelected = async () => {
    if (!selectedFlow) return;
    try {
      const result = await setDefaultFlow(selectedFlow.id, 'ui');
      setSnackbar({
        open: true,
        message: t('pages.flows.messages.defaultFlowUpdated', { count: result.reassignedDefaultCustomers }),
        severity: 'success',
      });
      await refreshFlows();
      await refreshCustomers();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.setDefaultFailed'),
        severity: 'error',
      });
    }
  };

  const createVersionFromSelected = async () => {
    if (!selectedFlow) return;
    try {
      const cloned = await createNewFlowVersion(selectedFlow.id, 'ui');
      setEditingFlow(cloned);
      setSelectedFlowId(cloned.id);
      setBuilderOpen(true);
      await refreshFlows();
      await loadFlowDetail(cloned.id);
      setSnackbar({ open: true, message: t('pages.flows.messages.draftVersionCreated'), severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.versionCreationFailed'),
        severity: 'error',
      });
    }
  };

  const deleteSelected = async () => {
    if (!selectedFlow) return;
    setDeleting(true);
    try {
      const deleted = await deleteFlow(selectedFlow.id);
      setDeleteDialogOpen(false);
      setSnackbar({
        open: true,
        message: t('pages.flows.messages.flowDeleted', { name: deleted.name }),
        severity: 'success',
      });
      await refreshFlows();
      await refreshCustomers();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.deleteFailed'),
        severity: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  const runExecutor = async () => {
    try {
      const result = await runFlowExecutorOnce(100);
      setSnackbar({
        open: true,
        message: t('pages.flows.messages.executorResult', { advanced: result.advanced, completed: result.completedPaid + result.completedEnd, failed: result.failed }),
        severity: 'info',
      });
      if (selectedCustomerId) {
        await loadCustomerFlow(selectedCustomerId);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.executorFailed'),
        severity: 'error',
      });
    }
  };

  const assignFlowToCustomer = async () => {
    if (!selectedCustomerId || !assignFlowId) return;
    try {
      await assignCustomerFlow(selectedCustomerId, assignFlowId);
      await loadCustomerFlow(selectedCustomerId);
      setSnackbar({ open: true, message: t('pages.flows.messages.customerFlowReassigned'), severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('pages.flows.errors.assignmentFailed'),
        severity: 'error',
      });
    }
  };

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FlowsIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {t('pages.flows.title')}
          </Typography>
          <Chip size="small" label={t('pages.flows.flowCount', { count: flows.length })} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void refreshFlows()} disabled={loading}>
            {t('pages.flows.refresh')}
          </Button>
          <Button variant="outlined" startIcon={<FlowsIcon />} onClick={openPromptCreate}>
            {t('pages.flows.createWithPrompt')}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {t('pages.flows.createFlow')}
          </Button>
        </Stack>
      </Box>

      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label={t('pages.flows.tabs.definitions')} />
        <Tab label={t('pages.flows.tabs.customerMonitor')} />
      </Tabs>

      {tab === 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 2, flex: 1, minHeight: 0 }}>
          <Paper sx={{ border: '1px solid', borderColor: 'divider', overflow: 'auto' }}>
            <List disablePadding>
              {flows.map((flow) => (
                <ListItemButton
                  key={flow.id}
                  selected={selectedFlowId === flow.id}
                  onClick={() => void loadFlowDetail(flow.id)}
                >
                  <ListItemText
                    primary={flow.name}
                    secondary={`v${flow.version} - ${flow.flowKey}`}
                  />
                  <Stack direction="row" spacing={0.5}>
                    {flow.isDefault && <Chip size="small" label={t('pages.flows.default')} color="warning" />}
                    <Chip size="small" label={flow.status} color={flowStatusColor[flow.status]} />
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          </Paper>

          <Paper sx={{ border: '1px solid', borderColor: 'divider', p: 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {selectedFlow ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>{selectedFlow.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('pages.flows.key')}: {selectedFlow.flowKey} - {t('pages.flows.version')}: {selectedFlow.version}
                    </Typography>
                    {selectedFlow.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {selectedFlow.description}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title={t('pages.flows.tooltips.editDraft')}>
                      <span>
                        <IconButton onClick={openEdit} disabled={selectedFlow.status !== 'draft'}>
                          <EditIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('pages.flows.tooltips.delete')}>
                      <span>
                        <IconButton onClick={() => setDeleteDialogOpen(true)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('pages.flows.tooltips.publish')}>
                      <span>
                        <IconButton onClick={() => void publishSelected()} disabled={selectedFlow.status !== 'draft'} color="success">
                          <PublishIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('pages.flows.tooltips.setDefault')}>
                      <span>
                        <IconButton onClick={() => void setDefaultSelected()} disabled={selectedFlow.status !== 'published'} color="warning">
                          <StarIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('pages.flows.tooltips.createNewVersion')}>
                      <span>
                        <IconButton onClick={() => void createVersionFromSelected()} disabled={selectedFlow.status !== 'published'}>
                          <VersionIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip size="small" label={t('pages.flows.statesCount', { count: selectedFlow.states.length })} />
                  <Chip size="small" label={t('pages.flows.transitionsCount', { count: selectedFlow.transitions.length })} />
                </Stack>

                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <FlowDiagramView
                    states={selectedFlow.states}
                    transitions={selectedFlow.transitions}
                    layout="vertical"
                  />
                </Box>
              </>
            ) : (
              <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
                <Typography>{loading ? t('pages.flows.loadingFlows') : t('pages.flows.selectFlowToView')}</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 2, flex: 1, minHeight: 0 }}>
          <Paper sx={{ border: '1px solid', borderColor: 'divider', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>{t('pages.flows.customer')}</InputLabel>
              <Select
                value={selectedCustomerId}
                label={t('pages.flows.customer')}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) {
                    void loadCustomerFlow(value);
                  }
                }}
              >
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>{customer.fullName}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>{t('pages.flows.assignFlow')}</InputLabel>
              <Select
                value={assignFlowId}
                label={t('pages.flows.assignFlow')}
                onChange={(event) => setAssignFlowId(event.target.value)}
                disabled={!selectedCustomerId}
              >
                {flows
                  .filter((flow) => flow.status === 'published')
                  .map((flow) => (
                    <MenuItem key={flow.id} value={flow.id}>
                      {flow.name} (v{flow.version})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => void assignFlowToCustomer()} disabled={!selectedCustomerId || !assignFlowId}>
                {t('pages.flows.assign')}
              </Button>
              <Button variant="contained" startIcon={<RunIcon />} onClick={() => void runExecutor()}>
                {t('pages.flows.runExecutorOnce')}
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ border: '1px solid', borderColor: 'divider', p: 2, overflow: 'auto' }}>
            {customerFlow ? (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" fontWeight={600}>{customerFlow.customer.fullName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('pages.flows.assignedFlow')}: {customerFlow.assignment?.flow.name || t('pages.flows.none')}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Chip label={`${t('pages.flows.source')}: ${customerFlow.assignment?.source || 'n/a'}`} size="small" />
                  {customerFlow.instance && (
                    <Chip
                      label={`${t('pages.flows.instance')}: ${customerFlow.instance.status}`}
                      size="small"
                      color={instanceStatusColor[customerFlow.instance.status]}
                    />
                  )}
                </Stack>

                {customerFlow.instance ? (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>{t('pages.flows.stateTimeline')}</Typography>
                    <List dense>
                      {customerFlow.instance.stateStatuses.map((stateStatus) => (
                        <ListItemText
                          key={stateStatus.id}
                          primary={`${stateStatus.state.stateName} (${stateStatus.state.actionName})`}
                          secondary={
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                              <Chip
                                size="small"
                                label={stateStatus.status}
                                color={stepStatusColor[stateStatus.status]}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {t('pages.flows.due')}: {stateStatus.dueAt ? new Date(stateStatus.dueAt).toLocaleString() : 'n/a'}
                              </Typography>
                              {stateStatus.errorMessage && (
                                <Typography variant="caption" color="error.main">
                                  {stateStatus.errorMessage}
                                </Typography>
                              )}
                            </Stack>
                          }
                        />
                      ))}
                    </List>
                  </Box>
                ) : (
                  <Alert severity="info">{t('pages.flows.noRunningInstance')}</Alert>
                )}
              </Stack>
            ) : (
              <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
                <Typography>{t('pages.flows.selectCustomerToMonitor')}</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteDialogOpen(false);
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('pages.flows.deleteFlow')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {t('pages.flows.deleteConfirmMessage', { name: selectedFlow?.name })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('pages.flows.deleteWarning')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit" disabled={deleting}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void deleteSelected()}
            color="error"
            variant="contained"
            disabled={deleting || !selectedFlow}
            startIcon={deleting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={builderOpen}
        onClose={() => {
          if (!saving) {
            setBuilderOpen(false);
            setEditingFlow(null);
          }
        }}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { height: '90vh' } }}
      >
        <DialogTitle>
          {editingFlow ? t('pages.flows.editFlow', { name: editingFlow.name }) : t('pages.flows.createNewFlow')}
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <GraphFlowBuilder
            initialName={editingFlow?.name || ''}
            initialDescription={editingFlow?.description || ''}
            initialStates={
              editingFlow?.states.map((state) => ({
                stateKey: state.stateKey,
                stateName: state.stateName,
                actionName: state.actionName,
                actionType: state.actionType,
                tone: state.tone,
                explicitChannel: state.explicitChannel,
                isStart: state.isStart,
                isEnd: state.isEnd,
                positionX: state.positionX,
                positionY: state.positionY,
              })) || []
            }
            initialTransitions={
              editingFlow?.transitions.map((transition) => ({
                fromStateKey: transition.fromState.stateKey,
                toStateKey: transition.toState.stateKey,
                conditionType: transition.conditionType,
                waitSeconds: transition.waitSeconds,
                label: transition.label,
                priority: transition.priority,
              })) || []
            }
            onSave={saveDefinition}
            onCancel={() => {
              setBuilderOpen(false);
              setEditingFlow(null);
            }}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      <FlowPromptAssistantDialog
        open={promptDialogOpen}
        onClose={() => setPromptDialogOpen(false)}
        initialFlowId={null}
        onFlowSaved={(flow) => {
          setSelectedFlowId(flow.id);
          setSelectedFlow(flow);
          void refreshFlows(flow.id);
        }}
        onOpenFlow={(flowId) => {
          setPromptDialogOpen(false);
          void refreshFlows(flowId);
          navigate(`/flows?flowId=${flowId}`);
        }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
