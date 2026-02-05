import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Save as SaveIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import FlowCanvas from './FlowCanvas';
import ActionLibrary, { type ActionItem } from './ActionLibrary';
import type { FlowNodeData } from './types';

interface FlowBuilderProps {
  initialName?: string;
  initialNodes?: FlowNodeData[];
  onSave?: (name: string, nodes: FlowNodeData[]) => void;
}

const defaultNodes: FlowNodeData[] = [
  {
    id: 'start',
    type: 'start',
    title: 'Start',
    description: 'Flow begins here',
  },
  {
    id: 'end',
    type: 'end',
    title: 'End',
    description: 'Flow ends here',
  },
];

export default function FlowBuilder({
  initialName = '',
  initialNodes,
  onSave,
}: FlowBuilderProps) {
  const [flowName, setFlowName] = useState(initialName);
  const [nodes, setNodes] = useState<FlowNodeData[]>(initialNodes || defaultNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const waitDuration = '1';
  const waitUnit = 'days';

  const handleAddNode = (afterId: string) => {
    setInsertAfterId(afterId);
  };

  const handleSelectAction = (item: ActionItem) => {
    if (item.type === 'wait') {
      // Show wait duration dialog - for now just insert with default
      handleInsertNode(item);
    } else {
      handleInsertNode(item);
    }
  };

  const handleInsertNode = (item: ActionItem) => {
    if (!insertAfterId) return;

    const newNode: FlowNodeData = {
      id: `node-${Date.now()}`,
      type: item.type,
      action: item.action,
      title: item.title,
      description: item.description,
      duration: item.type === 'wait' ? `${waitDuration} ${waitUnit}` : undefined,
    };

    const insertIndex = nodes.findIndex((n) => n.id === insertAfterId);
    if (insertIndex === -1) return;

    const newNodes = [...nodes];
    newNodes.splice(insertIndex + 1, 0, newNode);
    setNodes(newNodes);
    setInsertAfterId(null);
  };

  const handleDeleteNode = (id: string) => {
    setNodes(nodes.filter((n) => n.id !== id));
    if (selectedNodeId === id) {
      setSelectedNodeId(undefined);
    }
  };

  const handleSave = () => {
    if (!flowName.trim()) {
      setSnackbar({ open: true, message: 'Please enter a flow name', severity: 'error' });
      return;
    }
    
    if (onSave) {
      onSave(flowName, nodes);
    }
    setSnackbar({ open: true, message: 'Flow saved successfully!', severity: 'success' });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <TextField
          size="small"
          placeholder="Flow Name"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          sx={{ minWidth: 250 }}
        />
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={<PlayIcon />}
          disabled={nodes.length <= 2}
        >
          Test Flow
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!flowName.trim()}
        >
          Save Flow
        </Button>
      </Paper>

      {/* Main Content */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* Action Library */}
        <ActionLibrary
          onSelectAction={(item) => {
            // If no insert point selected, add after start
            if (!insertAfterId) {
              setInsertAfterId(nodes[0]?.id || 'start');
            }
            handleSelectAction(item);
          }}
        />

        {/* Flow Canvas */}
        <FlowCanvas
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onNodeSelect={setSelectedNodeId}
          onNodeDelete={handleDeleteNode}
          onAddNode={handleAddNode}
        />

        {/* Properties Panel - Optional */}
        {selectedNodeId && (
          <Paper
            elevation={0}
            sx={{
              width: 280,
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              height: 'fit-content',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Node Properties
            </Typography>
            {(() => {
              const node = nodes.find((n) => n.id === selectedNodeId);
              if (!node) return null;
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    size="small"
                    label="Title"
                    value={node.title}
                    onChange={(e) => {
                      setNodes(
                        nodes.map((n) =>
                          n.id === selectedNodeId ? { ...n, title: e.target.value } : n
                        )
                      );
                    }}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Description"
                    value={node.description || ''}
                    onChange={(e) => {
                      setNodes(
                        nodes.map((n) =>
                          n.id === selectedNodeId ? { ...n, description: e.target.value } : n
                        )
                      );
                    }}
                    fullWidth
                    multiline
                    rows={2}
                  />
                  {node.type === 'wait' && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        size="small"
                        label="Duration"
                        type="number"
                        value={node.duration?.split(' ')[0] || '1'}
                        onChange={(e) => {
                          const unit = node.duration?.split(' ')[1] || 'days';
                          setNodes(
                            nodes.map((n) =>
                              n.id === selectedNodeId
                                ? { ...n, duration: `${e.target.value} ${unit}` }
                                : n
                            )
                          );
                        }}
                        sx={{ flex: 1 }}
                      />
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <InputLabel>Unit</InputLabel>
                        <Select
                          value={node.duration?.split(' ')[1] || 'days'}
                          label="Unit"
                          onChange={(e) => {
                            const value = node.duration?.split(' ')[0] || '1';
                            setNodes(
                              nodes.map((n) =>
                                n.id === selectedNodeId
                                  ? { ...n, duration: `${value} ${e.target.value}` }
                                  : n
                              )
                            );
                          }}
                        >
                          <MenuItem value="hours">Hours</MenuItem>
                          <MenuItem value="days">Days</MenuItem>
                          <MenuItem value="weeks">Weeks</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  )}
                </Box>
              );
            })()}
          </Paper>
        )}
      </Box>

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
