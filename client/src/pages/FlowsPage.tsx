import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  AccountTree as FlowsIcon,
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { FlowBuilder } from '../components/FlowBuilder';
import type { FlowNodeData } from '../components/FlowBuilder/types';

interface Flow {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'draft';
  targetSegment: string;
  stepsCount: number;
  createdAt: string;
  lastRun?: string;
  nodes?: FlowNodeData[];
}

const sampleFlows: Flow[] = [
  {
    id: '1',
    name: 'Standard Collection Flow',
    status: 'active',
    targetSegment: 'All',
    stepsCount: 5,
    createdAt: '2026-01-15',
    lastRun: '2026-01-30',
  },
  {
    id: '2',
    name: 'High Value Reminder',
    status: 'active',
    targetSegment: 'Heavy (>₪50K)',
    stepsCount: 7,
    createdAt: '2026-01-10',
    lastRun: '2026-01-29',
  },
  {
    id: '3',
    name: 'Gentle Reminder - Light',
    status: 'paused',
    targetSegment: 'Light (<₪5K)',
    stepsCount: 3,
    createdAt: '2026-01-05',
  },
  {
    id: '4',
    name: 'WhatsApp Priority Flow',
    status: 'draft',
    targetSegment: 'Medium',
    stepsCount: 4,
    createdAt: '2026-01-28',
  },
];

const statusColors: Record<Flow['status'], 'success' | 'warning' | 'default'> = {
  active: 'success',
  paused: 'warning',
  draft: 'default',
};

export default function FlowsPage() {
  const { t } = useTranslation();
  const [flows, setFlows] = useState<Flow[]>(sampleFlows);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleCreateFlow = () => {
    setEditingFlow(null);
    setShowBuilder(true);
  };

  const handleEditFlow = (flow: Flow) => {
    setEditingFlow(flow);
    setShowBuilder(true);
  };

  const handleSaveFlow = (name: string, nodes: FlowNodeData[]) => {
    if (editingFlow) {
      // Update existing flow
      setFlows(flows.map(f => 
        f.id === editingFlow.id 
          ? { ...f, name, stepsCount: nodes.length, nodes }
          : f
      ));
      setSnackbar({ open: true, message: 'Flow updated successfully!', severity: 'success' });
    } else {
      // Create new flow
      const newFlow: Flow = {
        id: `flow-${Date.now()}`,
        name,
        status: 'draft',
        targetSegment: 'All',
        stepsCount: nodes.length,
        createdAt: new Date().toISOString().split('T')[0],
        nodes,
      };
      setFlows([newFlow, ...flows]);
      setSnackbar({ open: true, message: 'Flow created successfully!', severity: 'success' });
    }
    setShowBuilder(false);
    setEditingFlow(null);
  };

  const handleToggleStatus = (flow: Flow) => {
    const newStatus = flow.status === 'active' ? 'paused' : 'active';
    setFlows(flows.map(f => 
      f.id === flow.id ? { ...f, status: newStatus } : f
    ));
    setSnackbar({ 
      open: true, 
      message: `Flow ${newStatus === 'active' ? 'activated' : 'paused'}!`, 
      severity: 'info' 
    });
  };

  const handleDeleteFlow = (id: string) => {
    setFlows(flows.filter(f => f.id !== id));
    if (selectedFlow?.id === id) {
      setSelectedFlow(null);
    }
    setSnackbar({ open: true, message: 'Flow deleted!', severity: 'success' });
  };

  const handleDuplicateFlow = (flow: Flow) => {
    const duplicatedFlow: Flow = {
      ...flow,
      id: `flow-${Date.now()}`,
      name: `${flow.name} (Copy)`,
      status: 'draft',
      createdAt: new Date().toISOString().split('T')[0],
      lastRun: undefined,
    };
    setFlows([duplicatedFlow, ...flows]);
    setSnackbar({ open: true, message: 'Flow duplicated!', severity: 'success' });
  };

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FlowsIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {t('pages.flows.title')}
          </Typography>
          <Chip label={`${flows.length} flows`} size="small" />
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateFlow}
        >
          Create Flow
        </Button>
      </Box>

      {/* Main Content */}
      <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}>
        {/* Flows List */}
        <Paper
          elevation={0}
          sx={{
            width: 360,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Your Flows
            </Typography>
          </Box>
          <List sx={{ flex: 1, overflow: 'auto', p: 1 }}>
            {flows.map((flow) => (
              <ListItemButton
                key={flow.id}
                selected={selectedFlow?.id === flow.id}
                onClick={() => setSelectedFlow(flow)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    '&:hover': {
                      bgcolor: 'primary.light',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <FlowsIcon sx={{ color: flow.status === 'active' ? 'success.main' : 'text.disabled' }} />
                </ListItemIcon>
                <ListItemText
                  primary={flow.name}
                  secondary={`${flow.stepsCount} steps • ${flow.targetSegment}`}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
                <Chip
                  size="small"
                  label={flow.status}
                  color={statusColors[flow.status]}
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* Flow Details / Empty State */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {selectedFlow ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {selectedFlow.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Target: {selectedFlow.targetSegment} • Created: {selectedFlow.createdAt}
                    {selectedFlow.lastRun && ` • Last run: ${selectedFlow.lastRun}`}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title={selectedFlow.status === 'active' ? 'Pause' : 'Activate'}>
                    <IconButton
                      onClick={() => handleToggleStatus(selectedFlow)}
                      color={selectedFlow.status === 'active' ? 'warning' : 'success'}
                    >
                      {selectedFlow.status === 'active' ? <PauseIcon /> : <PlayIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton onClick={() => handleEditFlow(selectedFlow)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Duplicate">
                    <IconButton onClick={() => handleDuplicateFlow(selectedFlow)}>
                      <DuplicateIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton color="error" onClick={() => handleDeleteFlow(selectedFlow.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px dashed',
                  borderColor: 'divider',
                }}
              >
                <FlowsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                  Flow Preview
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedFlow.stepsCount} steps configured
                </Typography>
                <Button variant="outlined" onClick={() => handleEditFlow(selectedFlow)}>
                  Open in Editor
                </Button>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
              }}
            >
              <FlowsIcon sx={{ fontSize: 64, color: 'divider', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Select a flow to view details
              </Typography>
              <Typography variant="body2" sx={{ mb: 3 }}>
                Or create a new collection flow to get started
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateFlow}>
                Create New Flow
              </Button>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Flow Builder Dialog */}
      <Dialog
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' },
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          {editingFlow ? `Edit Flow: ${editingFlow.name}` : 'Create New Flow'}
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
          <FlowBuilder
            initialName={editingFlow?.name || ''}
            initialNodes={editingFlow?.nodes}
            onSave={handleSaveFlow}
          />
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
