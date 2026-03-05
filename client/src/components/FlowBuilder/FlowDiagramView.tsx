import { Box, Chip, Typography } from '@mui/material';
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
import type { FlowStateDto, FlowTransitionDto } from '../../types/flows';

interface FlowDiagramNodeData extends Record<string, unknown> {
  stateName: string;
  isStart: boolean;
  isEnd: boolean;
}

interface FlowDiagramViewProps {
  states: FlowStateDto[];
  transitions: FlowTransitionDto[];
}

type FlowDiagramNode = Node<FlowDiagramNodeData>;

function FlowDiagramStateNode({ data, selected }: NodeProps<FlowDiagramNode>) {
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
  flowDiagramState: FlowDiagramStateNode,
};

function toNode(state: FlowStateDto, index: number): Node<FlowDiagramNodeData> {
  return {
    id: state.id,
    position: {
      x: state.positionX ?? 100 + index * 260,
      y: state.positionY ?? 120,
    },
    data: {
      stateName: state.stateName,
      isStart: state.isStart,
      isEnd: state.isEnd,
    },
    type: 'flowDiagramState',
    draggable: false,
  };
}

function toEdge(transition: FlowTransitionDto, index: number): Edge {
  const waitLabel = transition.waitSeconds > 0
    ? `Wait ${Math.round(transition.waitSeconds / 86400)}d`
    : 'Immediate';

  return {
    id: transition.id || `edge-${transition.fromStateId}-${transition.toStateId}-${index}`,
    source: transition.fromStateId,
    target: transition.toStateId,
    label: transition.label || waitLabel,
    markerEnd: { type: MarkerType.ArrowClosed },
  };
}

export default function FlowDiagramView({ states, transitions }: FlowDiagramViewProps) {
  const nodes = useMemo(() => states.map(toNode), [states]);
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
