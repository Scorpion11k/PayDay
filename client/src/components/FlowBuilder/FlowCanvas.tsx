import { Box, Typography, IconButton, Paper } from '@mui/material';
import { Add as AddIcon, ArrowDownward as ArrowIcon } from '@mui/icons-material';
import FlowNode from './FlowNode';
import type { FlowNodeData } from './types';

interface FlowCanvasProps {
  nodes: FlowNodeData[];
  selectedNodeId?: string;
  onNodeSelect: (id: string) => void;
  onNodeDelete: (id: string) => void;
  onAddNode: (afterId: string) => void;
}

export default function FlowCanvas({
  nodes,
  selectedNodeId,
  onNodeSelect,
  onNodeDelete,
  onAddNode,
}: FlowCanvasProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        p: 3,
        bgcolor: 'background.default',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'auto',
        minHeight: 400,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          py: 2,
        }}
      >
        {nodes.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: 'text.secondary',
            }}
          >
            <Typography variant="body1" sx={{ mb: 1 }}>
              No steps in this flow yet
            </Typography>
            <Typography variant="body2">
              Click "Add Step" to build your collection flow
            </Typography>
          </Box>
        ) : (
          nodes.map((node, index) => (
            <Box
              key={node.id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <FlowNode
                node={node}
                isSelected={selectedNodeId === node.id}
                onClick={() => onNodeSelect(node.id)}
                onDelete={node.type !== 'start' && node.type !== 'end' ? onNodeDelete : undefined}
              />

              {/* Connector and Add button */}
              {index < nodes.length - 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    my: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 2,
                      height: 16,
                      bgcolor: 'divider',
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => onAddNode(node.id)}
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    }}
                  >
                    <AddIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                  <Box
                    sx={{
                      width: 2,
                      height: 16,
                      bgcolor: 'divider',
                    }}
                  />
                  <ArrowIcon sx={{ color: 'divider', fontSize: 20 }} />
                </Box>
              )}
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
}
