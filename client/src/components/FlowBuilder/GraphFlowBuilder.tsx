import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FlowActionType, FlowChannel, FlowStateNode, FlowTransitionEdge } from '../../types/flows';

interface FlowNodeData extends Record<string, unknown> {
  stateName: string;
  actionName: string;
  actionType: FlowActionType;
  tone: 'calm' | 'medium' | 'heavy' | null;
  explicitChannel: FlowChannel | null;
  isStart: boolean;
  isEnd: boolean;
}

interface FlowEdgeData extends Record<string, unknown> {
  waitSeconds: number;
  waitUnit?: DurationUnit;
  priority: number;
  conditionType: 'time_elapsed';
  label?: string | null;
}

type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';
type FlowVisualNode = Node<FlowNodeData>;

const DURATION_UNIT_SECONDS: Record<DurationUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

function getPreferredDurationUnit(waitSeconds: number): DurationUnit {
  if (waitSeconds > 0 && waitSeconds % DURATION_UNIT_SECONDS.days === 0) return 'days';
  if (waitSeconds > 0 && waitSeconds % DURATION_UNIT_SECONDS.hours === 0) return 'hours';
  if (waitSeconds > 0 && waitSeconds % DURATION_UNIT_SECONDS.minutes === 0) return 'minutes';
  return 'seconds';
}

function resolveDurationUnit(waitSeconds: number, unit?: unknown): DurationUnit {
  if (unit === 'seconds' || unit === 'minutes' || unit === 'hours' || unit === 'days') {
    return unit;
  }
  return getPreferredDurationUnit(waitSeconds);
}

function toDurationValue(waitSeconds: number, unit: DurationUnit): number {
  return waitSeconds / DURATION_UNIT_SECONDS[unit];
}

function toDurationSeconds(value: number, unit: DurationUnit): number {
  return Math.max(0, Math.round(value * DURATION_UNIT_SECONDS[unit]));
}

function formatDurationLabel(waitSeconds: number): string {
  const unit = getPreferredDurationUnit(waitSeconds);
  const value = toDurationValue(waitSeconds, unit);
  const normalizedValue = Number.isInteger(value) ? value : Number(value.toFixed(2));

  if (unit === 'seconds') return `${normalizedValue}s`;
  if (unit === 'minutes') return `${normalizedValue}m`;
  if (unit === 'hours') return `${normalizedValue}h`;
  return `${normalizedValue}d`;
}

function FlowStateVisualNode({ data, selected }: NodeProps<FlowVisualNode>) {
  const visual = data.isStart
    ? {
        border: '#2e7d32',
        background: '#e8f5e9',
        badge: '#2e7d32',
        role: 'Start',
      }
    : data.isEnd
      ? {
          border: '#1565c0',
          background: '#e3f2fd',
          badge: '#1565c0',
          role: 'End',
        }
      : {
          border: '#90a4ae',
          background: '#ffffff',
          badge: '#546e7a',
          role: 'State',
        };

  return (
    <Box
      sx={{
        minWidth: 200,
        maxWidth: 240,
        minHeight: 110,
        px: 1.5,
        py: 1.25,
        borderRadius: 1.5,
        border: '2px solid',
        borderColor: visual.border,
        backgroundColor: visual.background,
        boxShadow: selected ? 5 : 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      {!data.isStart && <Handle type="target" position={Position.Left} />}
      <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
        {data.stateName || 'Unnamed state'}
      </Typography>
      <Chip
        size="small"
        label={visual.role}
        sx={{
          mt: 1,
          height: 22,
          bgcolor: visual.badge,
          color: '#fff',
          fontWeight: 600,
        }}
      />
      {!data.isEnd && <Handle type="source" position={Position.Right} />}
    </Box>
  );
}

const nodeTypes = {
  flowState: FlowStateVisualNode,
};

interface GraphFlowBuilderProps {
  initialName?: string;
  initialDescription?: string | null;
  initialStates?: FlowStateNode[];
  initialTransitions?: FlowTransitionEdge[];
  onSave: (payload: {
    name: string;
    description?: string | null;
    states: FlowStateNode[];
    transitions: FlowTransitionEdge[];
  }) => void;
  onCancel?: () => void;
  saving?: boolean;
}

function toNode(state: FlowStateNode, index: number): Node<FlowNodeData> {
  return {
    id: state.stateKey,
    position: {
      x: state.positionX ?? 100 + index * 220,
      y: state.positionY ?? 120,
    },
    data: {
      stateName: state.stateName,
      actionName: state.actionName,
      actionType: state.actionType,
      tone: state.tone || null,
      explicitChannel: state.explicitChannel || null,
      isStart: Boolean(state.isStart),
      isEnd: Boolean(state.isEnd),
    },
    type: 'flowState',
  };
}

function toEdge(transition: FlowTransitionEdge, index: number): Edge<FlowEdgeData> {
  const waitSeconds = Math.max(0, transition.waitSeconds || 0);
  const waitUnit = getPreferredDurationUnit(waitSeconds);
  return {
    id: `edge-${transition.fromStateKey}-${transition.toStateKey}-${index}`,
    source: transition.fromStateKey,
    target: transition.toStateKey,
    label: transition.label || formatDurationLabel(waitSeconds),
    markerEnd: { type: MarkerType.ArrowClosed },
    data: {
      waitSeconds,
      waitUnit,
      priority: transition.priority || 1,
      conditionType: transition.conditionType || 'time_elapsed',
      label: transition.label || null,
    },
  };
}

export default function GraphFlowBuilder({
  initialName = '',
  initialDescription = '',
  initialStates = [],
  initialTransitions = [],
  onSave,
  onCancel,
  saving = false,
}: GraphFlowBuilderProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || '');
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>(
    initialStates.length > 0
      ? initialStates.map(toNode)
      : [
          toNode(
            {
              stateKey: 'state_start',
              stateName: 'Start Reminder',
              actionName: 'Start Reminder',
              actionType: 'none',
              tone: null,
              isStart: true,
              isEnd: false,
              positionX: 120,
              positionY: 120,
            },
            0
          ),
          toNode(
            {
              stateKey: 'state_end',
              stateName: 'End',
              actionName: 'End',
              actionType: 'none',
              tone: null,
              isStart: false,
              isEnd: true,
              positionX: 520,
              positionY: 120,
            },
            1
          ),
        ]
  );
  const [edges, setEdges] = useState<Edge<FlowEdgeData>[]>(
    initialTransitions.map(toEdge)
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) || null,
    [edges, selectedEdgeId]
  );
  const selectedEdgeUnit: DurationUnit = selectedEdge
    ? resolveDurationUnit(selectedEdge.data?.waitSeconds || 0, selectedEdge.data?.waitUnit)
    : 'seconds';
  const selectedEdgeDurationValue = selectedEdge
    ? toDurationValue(selectedEdge.data?.waitSeconds || 0, selectedEdgeUnit)
    : 0;

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current as Node[]) as Node<FlowNodeData>[]);
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current as Edge[]) as Edge<FlowEdgeData>[]);
  };

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);

    if (sourceNode?.data.isEnd) {
      setError('End state cannot have outgoing transitions');
      return;
    }
    if (targetNode?.data.isStart) {
      setError('Start state cannot have incoming transitions');
      return;
    }

    const sourceOutgoingCount = edges.filter((edge) => edge.source === connection.source).length;
    if (sourceNode?.data.isStart && sourceOutgoingCount >= 1) {
      setError('Start state can have only one outgoing transition');
      return;
    }

    const targetIncomingCount = edges.filter((edge) => edge.target === connection.target).length;
    if (targetNode?.data.isEnd && targetIncomingCount >= 1) {
      setError('End state can have only one incoming transition');
      return;
    }

    setError(null);
    setEdges((current) =>
      addEdge(
        {
          ...connection,
          id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
          markerEnd: { type: MarkerType.ArrowClosed },
          label: formatDurationLabel(0),
          data: {
            waitSeconds: 0,
            waitUnit: 'seconds',
            priority: 1,
            conditionType: 'time_elapsed',
            label: null,
          },
        } as Edge<FlowEdgeData>,
        current
      )
    );
  };

  const updateSelectedNode = (updater: (current: Node<FlowNodeData>) => Node<FlowNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((current) =>
      current.map((node) => (node.id === selectedNodeId ? updater(node) : node))
    );
  };

  const updateSelectedEdge = (updater: (current: Edge<FlowEdgeData>) => Edge<FlowEdgeData>) => {
    if (!selectedEdgeId) return;
    setEdges((current) =>
      current.map((edge) => (edge.id === selectedEdgeId ? updater(edge) : edge))
    );
  };

  const addState = () => {
    const key = `state_${Date.now()}`;
    const newNode: Node<FlowNodeData> = {
      id: key,
      position: { x: 180 + nodes.length * 80, y: 220 },
      data: {
        stateName: 'New State',
        actionName: 'New State',
        actionType: 'none',
        tone: null,
        explicitChannel: null,
        isStart: false,
        isEnd: false,
      },
      type: 'flowState',
    };
    setNodes((current) => [...current, newNode]);
    setSelectedNodeId(key);
  };

  const removeSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedNodeId));
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId)
    );
    setSelectedNodeId(null);
  };

  const removeSelectedEdge = () => {
    if (!selectedEdgeId) return;
    setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  };

  const save = () => {
    setError(null);
    if (!name.trim()) {
      setError('Flow name is required');
      return;
    }
    if (nodes.length < 2) {
      setError('Flow must contain at least two states');
      return;
    }
    const starts = nodes.filter((node) => node.data.isStart);
    const ends = nodes.filter((node) => node.data.isEnd);
    if (starts.length !== 1) {
      setError('Flow must contain exactly one start state');
      return;
    }
    if (ends.length !== 1) {
      setError('Flow must contain exactly one end state');
      return;
    }

    const startState = starts[0];
    const endState = ends[0];
    const startOutgoingCount = edges.filter((edge) => edge.source === startState.id).length;
    if (startOutgoingCount !== 1) {
      setError('Start state must have exactly one outgoing transition');
      return;
    }
    const startIncomingCount = edges.filter((edge) => edge.target === startState.id).length;
    if (startIncomingCount !== 0) {
      setError('Start state cannot have incoming transitions');
      return;
    }

    const endIncomingCount = edges.filter((edge) => edge.target === endState.id).length;
    if (endIncomingCount !== 1) {
      setError('End state must have exactly one incoming transition');
      return;
    }
    const endOutgoingCount = edges.filter((edge) => edge.source === endState.id).length;
    if (endOutgoingCount !== 0) {
      setError('End state cannot have outgoing transitions');
      return;
    }

    const states: FlowStateNode[] = nodes.map((node) => ({
      stateKey: node.id,
      stateName: node.data.stateName,
      actionName: (node.data.actionName || node.data.stateName || '').trim(),
      actionType: node.data.actionType,
      tone: node.data.tone,
      explicitChannel: node.data.explicitChannel,
      isStart: node.data.isStart,
      isEnd: node.data.isEnd,
      positionX: node.position.x,
      positionY: node.position.y,
    }));

    const transitions: FlowTransitionEdge[] = edges.map((edge) => ({
      fromStateKey: edge.source,
      toStateKey: edge.target,
      conditionType: edge.data?.conditionType || 'time_elapsed',
      waitSeconds: edge.data?.waitSeconds || 0,
      label: edge.data?.label || edge.label?.toString() || null,
      priority: edge.data?.priority || 1,
    }));

    onSave({
      name: name.trim(),
      description: description.trim() || null,
      states,
      transitions,
    });
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '300px 1fr 320px', gap: 2, height: '100%' }}>
      <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>Flow Definition</Typography>
        <TextField
          label="Flow Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          size="small"
          fullWidth
          multiline
          rows={3}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip label={`${nodes.length} states`} size="small" />
          <Chip label={`${edges.length} transitions`} size="small" />
        </Stack>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={addState}>
          Add State
        </Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={save} disabled={saving}>
          Save Flow
        </Button>
        {onCancel && (
          <Button variant="text" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </Paper>

      <Paper sx={{ height: '100%', minHeight: 520 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
          }}
          fitView
          deleteKeyCode={['Delete', 'Backspace']}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </Paper>

      <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {selectedNode ? 'State Properties' : selectedEdge ? 'Transition Properties' : 'Select a state or transition'}
        </Typography>

        {selectedNode && (
          <Stack spacing={1.5}>
            <TextField
              label="State Key"
              size="small"
              value={selectedNode.id}
              disabled
            />
            <TextField
              label="State Name"
              size="small"
              value={selectedNode.data.stateName}
              onChange={(event) =>
                updateSelectedNode((node) => ({
                  ...node,
                  data: { ...node.data, stateName: event.target.value, actionName: event.target.value },
                }))
              }
            />
            <FormControl size="small">
              <InputLabel>Action Type</InputLabel>
              <Select
                label="Action Type"
                value={selectedNode.data.actionType}
                onChange={(event) =>
                  updateSelectedNode((node) => ({
                    ...node,
                    data: {
                      ...node.data,
                      actionType: event.target.value as FlowActionType,
                      tone: event.target.value === 'none' ? null : node.data.tone,
                    },
                  }))
                }
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="assigned_channel">Assigned Channel</MenuItem>
                <MenuItem value="send_email">Send Email</MenuItem>
                <MenuItem value="send_sms">Send SMS</MenuItem>
                <MenuItem value="send_whatsapp">Send WhatsApp</MenuItem>
                <MenuItem value="voice_call">Voice Call</MenuItem>
              </Select>
            </FormControl>
            {selectedNode.data.actionType !== 'none' && (
              <FormControl size="small">
                <InputLabel>Tone</InputLabel>
                <Select
                  label="Tone"
                  value={selectedNode.data.tone || ''}
                  onChange={(event) =>
                    updateSelectedNode((node) => ({
                      ...node,
                      data: {
                        ...node.data,
                        tone: (event.target.value || null) as FlowNodeData['tone'],
                      },
                    }))
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="calm">Calm</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="heavy">Escalated</MenuItem>
                </Select>
              </FormControl>
            )}
            <FormControl size="small">
              <InputLabel>State Role</InputLabel>
              <Select
                label="State Role"
                value={selectedNode.data.isStart ? 'start' : selectedNode.data.isEnd ? 'end' : 'normal'}
                onChange={(event) => {
                  const role = event.target.value as 'normal' | 'start' | 'end';

                  if (role === 'start') {
                    const outgoingCount = edges.filter((edge) => edge.source === selectedNode.id).length;
                    const incomingCount = edges.filter((edge) => edge.target === selectedNode.id).length;
                    if (outgoingCount > 1) {
                      setError('Start state can have only one outgoing transition');
                      return;
                    }
                    if (incomingCount > 0) {
                      setError('Start state cannot have incoming transitions');
                      return;
                    }
                  }

                  if (role === 'end') {
                    const incomingCount = edges.filter((edge) => edge.target === selectedNode.id).length;
                    const outgoingCount = edges.filter((edge) => edge.source === selectedNode.id).length;
                    if (incomingCount > 1) {
                      setError('End state can have only one incoming transition');
                      return;
                    }
                    if (outgoingCount > 0) {
                      setError('End state cannot have outgoing transitions');
                      return;
                    }
                  }

                  setError(null);
                  setNodes((current) =>
                    current.map((node) => {
                      if (role === 'start') {
                        if (node.id === selectedNode.id) {
                          return { ...node, data: { ...node.data, isStart: true, isEnd: false } };
                        }
                        return { ...node, data: { ...node.data, isStart: false } };
                      }

                      if (role === 'end') {
                        if (node.id === selectedNode.id) {
                          return { ...node, data: { ...node.data, isEnd: true, isStart: false } };
                        }
                        return { ...node, data: { ...node.data, isEnd: false } };
                      }

                      if (node.id === selectedNode.id) {
                        return { ...node, data: { ...node.data, isStart: false, isEnd: false } };
                      }
                      return node;
                    })
                  );
                }}
              >
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="start">Start (Green)</MenuItem>
                <MenuItem value="end">End (Blue)</MenuItem>
              </Select>
            </FormControl>
            <Button color="error" variant="outlined" onClick={removeSelectedNode}>
              Remove State
            </Button>
          </Stack>
        )}

        {selectedEdge && (
          <Stack spacing={1.5}>
            <TextField label="From" size="small" value={selectedEdge.source} disabled />
            <TextField label="To" size="small" value={selectedEdge.target} disabled />
            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.25 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Duration Time
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <TextField
                  label="Value"
                  size="small"
                  type="number"
                  inputProps={{ min: 0, step: 'any' }}
                  value={Number.isInteger(selectedEdgeDurationValue) ? selectedEdgeDurationValue : Number(selectedEdgeDurationValue.toFixed(2))}
                  onChange={(event) => {
                    const numeric = Number(event.target.value || 0);
                    const safeValue = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
                    const waitSeconds = toDurationSeconds(safeValue, selectedEdgeUnit);

                    updateSelectedEdge((edge) => ({
                      ...edge,
                      label: formatDurationLabel(waitSeconds),
                      data: {
                        waitSeconds,
                        waitUnit: selectedEdgeUnit,
                        priority: edge.data?.priority || 1,
                        conditionType: edge.data?.conditionType || 'time_elapsed',
                        label: edge.data?.label || null,
                      },
                    }));
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    label="Unit"
                    value={selectedEdgeUnit}
                    onChange={(event) => {
                      const unit = event.target.value as DurationUnit;
                      const currentSeconds = selectedEdge.data?.waitSeconds || 0;

                      updateSelectedEdge((edge) => ({
                        ...edge,
                        label: formatDurationLabel(currentSeconds),
                        data: {
                          waitSeconds: currentSeconds,
                          waitUnit: unit,
                          priority: edge.data?.priority || 1,
                          conditionType: edge.data?.conditionType || 'time_elapsed',
                          label: edge.data?.label || null,
                        },
                      }));
                    }}
                  >
                    <MenuItem value="seconds">Seconds</MenuItem>
                    <MenuItem value="minutes">Minutes</MenuItem>
                    <MenuItem value="hours">Hours</MenuItem>
                    <MenuItem value="days">Days</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Box>
            <TextField
              label="Priority"
              size="small"
              type="number"
              value={selectedEdge.data?.priority || 1}
              onChange={(event) =>
                updateSelectedEdge((edge) => ({
                  ...edge,
                  data: {
                    waitSeconds: edge.data?.waitSeconds || 0,
                    waitUnit: resolveDurationUnit(edge.data?.waitSeconds || 0, edge.data?.waitUnit),
                    priority: Math.max(1, Number(event.target.value || 1)),
                    conditionType: edge.data?.conditionType || 'time_elapsed',
                    label: edge.data?.label || null,
                  },
                }))
              }
            />
            <TextField
              label="Label"
              size="small"
              value={selectedEdge.data?.label || ''}
              onChange={(event) =>
                updateSelectedEdge((edge) => ({
                  ...edge,
                  label: event.target.value,
                  data: {
                    waitSeconds: edge.data?.waitSeconds || 0,
                    waitUnit: resolveDurationUnit(edge.data?.waitSeconds || 0, edge.data?.waitUnit),
                    priority: edge.data?.priority || 1,
                    conditionType: edge.data?.conditionType || 'time_elapsed',
                    label: event.target.value || null,
                  },
                }))
              }
            />
            <Button color="error" variant="outlined" onClick={removeSelectedEdge}>
              Remove Transition
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
