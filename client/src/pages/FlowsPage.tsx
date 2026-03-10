import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
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
  Edit as EditIcon,
  Publish as PublishIcon,
  Star as StarIcon,
  ContentCopy as VersionIcon,
  Refresh as RefreshIcon,
  PlayArrow as RunIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import GraphFlowBuilder from '../components/FlowBuilder/GraphFlowBuilder';
import FlowDiagramView from '../components/FlowBuilder/FlowDiagramView';
import FlowPromptAssistantDialog from '../components/flows/FlowPromptAssistantDialog';
import {
  assignCustomerFlow,
  createFlow,
  createNewFlowVersion,
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
  const [editingFlow, setEditingFlow] = useState<FlowDefinitionDto | null>(null);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerFlow, setCustomerFlow] = useState<CustomerCollectionFlowDto | null>(null);
  const [assignFlowId, setAssignFlowId] = useState<string>('');

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
        message: error instanceof Error ? error.message : 'Failed to load flows',
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
        message: error instanceof Error ? error.message : 'Failed to load flow',
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
        message: error instanceof Error ? error.message : 'Failed to load customers',
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
        message: error instanceof Error ? error.message : 'Failed to load customer flow',
        severity: 'error',
      });
    }
  };

  useEffect(() => {
    refreshFlows(searchParams.get('flowId'));
    refreshCustomers();
  }, []);

  useEffect(() => {
    if (tab !== 1 || !selectedCustomerId) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchCustomerFlow(selectedCustomerId).catch(() => undefined);
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
        message: 'Only draft flows can be edited directly. Create a new version first.',
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
        setSnackbar({ open: true, message: 'Flow updated successfully', severity: 'success' });
      } else {
        const created = await createFlow({
          ...payload,
          createdBy: 'ui',
        });
        setSelectedFlowId(created.id);
        setSnackbar({ open: true, message: 'Flow created successfully', severity: 'success' });
      }
      setBuilderOpen(false);
      setEditingFlow(null);
      await refreshFlows();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to save flow',
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
      setSnackbar({ open: true, message: 'Flow published', severity: 'success' });
      await refreshFlows();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Publish failed',
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
        message: `Default flow updated. Reassigned ${result.reassignedDefaultCustomers} customers.`,
        severity: 'success',
      });
      await refreshFlows();
      await refreshCustomers();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Set default failed',
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
      setSnackbar({ open: true, message: 'Draft version created', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Version creation failed',
        severity: 'error',
      });
    }
  };

  const runExecutor = async () => {
    try {
      const result = await runFlowExecutorOnce(100);
      setSnackbar({
        open: true,
        message: `Executor: advanced ${result.advanced}, completed ${result.completedPaid + result.completedEnd}, failed ${result.failed}`,
        severity: 'info',
      });
      if (selectedCustomerId) {
        await loadCustomerFlow(selectedCustomerId);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Executor run failed',
        severity: 'error',
      });
    }
  };

  const assignFlowToCustomer = async () => {
    if (!selectedCustomerId || !assignFlowId) return;
    try {
      await assignCustomerFlow(selectedCustomerId, assignFlowId);
      await loadCustomerFlow(selectedCustomerId);
      setSnackbar({ open: true, message: 'Customer flow reassigned', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Assignment failed',
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
          <Chip size="small" label={`${flows.length} flows`} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void refreshFlows()} disabled={loading}>
            Refresh
          </Button>
          <Button variant="outlined" startIcon={<FlowsIcon />} onClick={openPromptCreate}>
            Create with Prompt
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Create Flow
          </Button>
        </Stack>
      </Box>

      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label="Definitions" />
        <Tab label="Customer Monitor" />
      </Tabs>

      {tab === 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 2, flex: 1, minHeight: 0 }}>
          <Paper sx={{ border: '1px solid', borderColor: 'divider', overflow: 'auto' }}>
            <List disablePadding>
              {flows.map((flow) => (
                <ListItemButton
                  key={flow.id}
                  selected={selectedFlowId === flow.id}
                  onClick={() => loadFlowDetail(flow.id)}
                >
                  <ListItemText
                    primary={flow.name}
                    secondary={`v${flow.version} • ${flow.flowKey}`}
                  />
                  <Stack direction="row" spacing={0.5}>
                    {flow.isDefault && <Chip size="small" label="Default" color="warning" />}
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
                      Key: {selectedFlow.flowKey} • Version: {selectedFlow.version}
                    </Typography>
                    {selectedFlow.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {selectedFlow.description}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Edit Draft">
                      <span>
                        <IconButton onClick={openEdit} disabled={selectedFlow.status !== 'draft'}>
                          <EditIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Publish">
                      <span>
                        <IconButton onClick={publishSelected} disabled={selectedFlow.status !== 'draft'} color="success">
                          <PublishIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Set Default">
                      <span>
                        <IconButton onClick={setDefaultSelected} disabled={selectedFlow.status !== 'published'} color="warning">
                          <StarIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Create New Version">
                      <span>
                        <IconButton onClick={createVersionFromSelected} disabled={selectedFlow.status !== 'published'}>
                          <VersionIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip size="small" label={`${selectedFlow.states.length} states`} />
                  <Chip size="small" label={`${selectedFlow.transitions.length} transitions`} />
                </Stack>

                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <FlowDiagramView
                    states={selectedFlow.states}
                    transitions={selectedFlow.transitions}
                  />
                </Box>
              </>
            ) : (
              <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
                <Typography>Select a flow to view details</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 2, flex: 1, minHeight: 0 }}>
          <Paper sx={{ border: '1px solid', borderColor: 'divider', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Customer</InputLabel>
              <Select
                value={selectedCustomerId}
                label="Customer"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) {
                    loadCustomerFlow(value);
                  }
                }}
              >
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>{customer.fullName}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Assign Flow</InputLabel>
              <Select
                value={assignFlowId}
                label="Assign Flow"
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
              <Button variant="outlined" onClick={assignFlowToCustomer} disabled={!selectedCustomerId || !assignFlowId}>
                Assign
              </Button>
              <Button variant="contained" startIcon={<RunIcon />} onClick={runExecutor}>
                Run Executor Once
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ border: '1px solid', borderColor: 'divider', p: 2, overflow: 'auto' }}>
            {customerFlow ? (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" fontWeight={600}>{customerFlow.customer.fullName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Assigned flow: {customerFlow.assignment?.flow.name || 'None'}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Chip label={`Source: ${customerFlow.assignment?.source || 'n/a'}`} size="small" />
                  {customerFlow.instance && (
                    <Chip
                      label={`Instance: ${customerFlow.instance.status}`}
                      size="small"
                      color={instanceStatusColor[customerFlow.instance.status]}
                    />
                  )}
                </Stack>

                {customerFlow.instance ? (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>State Timeline</Typography>
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
                                due: {stateStatus.dueAt ? new Date(stateStatus.dueAt).toLocaleString() : 'n/a'}
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
                  <Alert severity="info">No running instance for this customer.</Alert>
                )}
              </Stack>
            ) : (
              <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
                <Typography>Select a customer to monitor flow state</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

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
          {editingFlow ? `Edit Flow: ${editingFlow.name}` : 'Create New Flow'}
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



