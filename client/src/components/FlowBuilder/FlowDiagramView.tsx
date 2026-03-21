import { Box, Chip, Stack, Typography } from '@mui/material';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import type {
  CollectionFlowStateStatusDto,
  FlowChannel,
  FlowStateDto,
  FlowStateInstanceStatus,
  FlowTransitionDto,
} from '../../types/flows';
import { getFlowLayout, type FlowLayoutDirection, type FlowPosition } from './layout';

interface FlowDiagramNodeData extends Record<string, unknown> {
  stateName: string;
  actionName: string;
  channelLabel: string;
  isStart: boolean;
  isEnd: boolean;
  runtimeStatus?: FlowStateInstanceStatus | null;
  isCurrent: boolean;
  flowStarted: boolean;
  layoutDirection: Exclude<FlowLayoutDirection, 'auto'>;
}

interface FlowDiagramViewProps {
  states: FlowStateDto[];
  transitions: FlowTransitionDto[];
  currentStateId?: string | null;
  stateStatuses?: CollectionFlowStateStatusDto[];
  layout?: FlowLayoutDirection;
  runtimeMode?: boolean;
}

type FlowDiagramNode = Node<FlowDiagramNodeData>;

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

function resolveChannel(
  state: Pick<FlowStateDto, 'actionType' | 'explicitChannel'> | Pick<CollectionFlowStateStatusDto['state'], 'actionType' | 'explicitChannel'>
): FlowChannel | null {
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
      return null;
  }
}

function getRuntimeLabel(status?: FlowStateInstanceStatus | null, isCurrent = false): string | null {
  if (!status) return null;
  if (isCurrent) return 'Current';

  switch (status) {
    case 'completed':
      return 'Completed';
    case 'waiting':
      return 'Waiting';
    case 'failed':
      return 'Failed';
    case 'upcoming':
      return 'Upcoming';
    default:
      return null;
  }
}

function getVisualState(data: FlowDiagramNodeData) {
  if (data.runtimeStatus === 'failed') {
    return {
      border: '#c62828',
      background: '#ffebee',
      badge: '#c62828',
      role: 'Failed',
    };
  }

  if (data.isCurrent || data.runtimeStatus === 'waiting') {
    return {
      border: '#ed6c02',
      background: '#fff3e0',
      badge: '#ed6c02',
      role: data.isCurrent ? 'Current' : 'Waiting',
    };
  }

  if (data.runtimeStatus === 'completed') {
    return {
      border: '#2e7d32',
      background: '#e8f5e9',
      badge: '#2e7d32',
      role: 'Completed',
    };
  }

  if (data.isStart) {
    if (data.flowStarted) {
      return {
        border: '#2e7d32',
        background: '#e8f5e9',
        badge: '#2e7d32',
        role: 'Start',
      };
    }
    return {
      border: '#90a4ae',
      background: '#ffffff',
      badge: '#546e7a',
      role: 'Start',
    };
  }

  if (data.isEnd) {
    return {
      border: '#1565c0',
      background: '#e3f2fd',
      badge: '#1565c0',
      role: 'End',
    };
  }

  return {
    border: '#90a4ae',
    background: '#ffffff',
    badge: '#546e7a',
    role: 'State',
  };
}

function FlowDiagramStateNode({ data, selected }: NodeProps<FlowDiagramNode>) {
  const visual = getVisualState(data);
  const runtimeLabel = getRuntimeLabel(data.runtimeStatus, data.isCurrent);
  const badges = runtimeLabel && runtimeLabel !== visual.role ? [visual.role, runtimeLabel] : [runtimeLabel ?? visual.role];
  const targetHandlePosition = data.layoutDirection === 'vertical' ? Position.Top : Position.Left;
  const sourceHandlePosition = data.layoutDirection === 'vertical' ? Position.Bottom : Position.Right;

  return (
    <Box
      sx={{
        minWidth: 200,
        maxWidth: 240,
        minHeight: 132,
        px: 1.5,
        py: 1.25,
        borderRadius: 1.5,
        border: '2px solid',
        borderColor: visual.border,
        backgroundColor: visual.background,
        boxShadow: data.isCurrent ? 8 : selected ? 5 : 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {!data.isStart && <Handle type="target" position={targetHandlePosition} />}
      <Box sx={{ width: '100%' }}>
        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
          {data.stateName || 'Unnamed state'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
          {data.actionName}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {data.channelLabel}
        </Typography>
      </Box>
      <Stack
        direction="row"
        spacing={0.75}
        useFlexGap
        flexWrap="wrap"
        justifyContent="center"
        sx={{ mt: 'auto', pt: 1.25, width: '100%' }}
      >
        {badges.map((badgeLabel, index) =>
          index === 0 ? (
            <Chip
              key={badgeLabel}
              size="small"
              label={badgeLabel}
              sx={{
                height: 22,
                bgcolor: visual.badge,
                color: '#fff',
                fontWeight: 600,
              }}
            />
          ) : (
            <Chip
              key={badgeLabel}
              size="small"
              label={badgeLabel}
              variant="outlined"
              sx={{
                height: 22,
                borderColor: visual.badge,
                color: visual.badge,
                fontWeight: 600,
                bgcolor: '#fff',
              }}
            />
          )
        )}
      </Stack>
      {!data.isEnd && <Handle type="source" position={sourceHandlePosition} />}
    </Box>
  );
}

const nodeTypes = {
  flowDiagramState: FlowDiagramStateNode,
};

function toNode(
  state: FlowStateDto,
  position: FlowPosition,
  layoutDirection: Exclude<FlowLayoutDirection, 'auto'>,
  runtimeStatus?: CollectionFlowStateStatusDto | null,
  isCurrent = false,
  flowStarted = false
): Node<FlowDiagramNodeData> {
  const targetPosition = layoutDirection === 'vertical' ? Position.Top : Position.Left;
  const sourcePosition = layoutDirection === 'vertical' ? Position.Bottom : Position.Right;

  return {
    id: state.id,
    position,
    targetPosition,
    sourcePosition,
    data: {
      stateName: state.stateName,
      actionName: state.actionName,
      channelLabel: formatChannelLabel(resolveChannel(runtimeStatus?.state || state)),
      isStart: state.isStart,
      isEnd: state.isEnd,
      runtimeStatus: runtimeStatus?.status ?? null,
      isCurrent,
      flowStarted,
      layoutDirection,
    },
    type: 'flowDiagramState',
    draggable: false,
  };
}

function formatWaitLabel(waitSeconds: number): string {
  if (waitSeconds <= 0) return 'Immediate';
  if (waitSeconds % 86400 === 0) return `Wait ${waitSeconds / 86400}d`;
  if (waitSeconds % 3600 === 0) return `Wait ${waitSeconds / 3600}h`;
  if (waitSeconds % 60 === 0) return `Wait ${waitSeconds / 60}m`;
  return `Wait ${waitSeconds}s`;
}

function toEdge(transition: FlowTransitionDto, index: number): Edge {
  const waitLabel = formatWaitLabel(transition.waitSeconds);

  return {
    id: transition.id || `edge-${transition.fromStateId}-${transition.toStateId}-${index}`,
    source: transition.fromStateId,
    target: transition.toStateId,
    label: transition.label || waitLabel,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  };
}

export default function FlowDiagramView({
  states,
  transitions,
  currentStateId = null,
  stateStatuses = [],
  layout = 'auto',
  runtimeMode = false,
}: FlowDiagramViewProps) {
  const runtimeStatusByStateId = useMemo(() => {
    const statusMap = new Map<string, CollectionFlowStateStatusDto>();
    stateStatuses.forEach((status) => {
      statusMap.set(status.state.id, status);
    });
    return statusMap;
  }, [stateStatuses]);

  const flowLayout = useMemo(
    () =>
      getFlowLayout({
        states,
        transitions,
        direction: layout,
        getStateId: (state) => state.id,
        getTransitionSourceId: (transition) => transition.fromStateId,
        getTransitionTargetId: (transition) => transition.toStateId,
      }),
    [layout, states, transitions]
  );

  const flowStarted = !runtimeMode || stateStatuses.length > 0 || currentStateId != null;

  const nodes = useMemo(
    () =>
      states.map((state) => {
        const runtimeStatus = runtimeStatusByStateId.get(state.id) ?? null;
        const isCurrent = currentStateId ? currentStateId === state.id : runtimeStatus?.status === 'waiting';
        const position = flowLayout.positions.get(state.id) ?? { x: 100, y: 120 };
        return toNode(state, position, flowLayout.direction, runtimeStatus, isCurrent, flowStarted);
      }),
    [currentStateId, flowLayout.direction, flowLayout.positions, flowStarted, runtimeStatusByStateId, states]
  );
  const edges = useMemo(() => transitions.map(toEdge), [transitions]);

  if (states.length === 0) {
    return (
      <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No states available for this flow</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', minHeight: 420, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </Box>
  );
}
