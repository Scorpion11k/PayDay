import { Box, Typography, IconButton, Chip } from '@mui/material';
import {
  Email as EmailIcon,
  Sms as SmsIcon,
  WhatsApp as WhatsAppIcon,
  Call as CallIcon,
  Timer as TimerIcon,
  HelpOutline as ConditionIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import type { FlowNodeData, FlowNodeType, ActionType } from './types';

export type { FlowNodeData, FlowNodeType, ActionType };

interface FlowNodeProps {
  node: FlowNodeData;
  onDelete?: (id: string) => void;
  isSelected?: boolean;
  onClick?: () => void;
  draggable?: boolean;
}

const actionIcons: Record<ActionType, React.ReactNode> = {
  send_email: <EmailIcon />,
  send_sms: <SmsIcon />,
  send_whatsapp: <WhatsAppIcon sx={{ color: '#25D366' }} />,
  voice_ai_call: <CallIcon sx={{ color: '#9c27b0' }} />,
};

const actionColors: Record<ActionType, string> = {
  send_email: '#1976d2',
  send_sms: '#ed6c02',
  send_whatsapp: '#25D366',
  voice_ai_call: '#9c27b0',
};

const typeColors: Record<FlowNodeType, string> = {
  start: '#4caf50',
  action: '#1976d2',
  wait: '#ff9800',
  condition: '#9c27b0',
  end: '#f44336',
};

export default function FlowNode({
  node,
  onDelete,
  isSelected,
  onClick,
  draggable = true,
}: FlowNodeProps) {
  const getIcon = () => {
    switch (node.type) {
      case 'start':
        return <StartIcon />;
      case 'end':
        return <StopIcon />;
      case 'wait':
        return <TimerIcon />;
      case 'condition':
        return <ConditionIcon />;
      case 'action':
        return node.action ? actionIcons[node.action] : <EmailIcon />;
      default:
        return <EmailIcon />;
    }
  };

  const getColor = () => {
    if (node.type === 'action' && node.action) {
      return actionColors[node.action];
    }
    return typeColors[node.type];
  };

  const color = getColor();

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        bgcolor: isSelected ? `${color}15` : 'background.paper',
        border: '2px solid',
        borderColor: isSelected ? color : 'divider',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: 220,
        '&:hover': {
          borderColor: color,
          boxShadow: `0 2px 8px ${color}30`,
        },
      }}
    >
      {draggable && (
        <DragIcon
          sx={{
            color: 'text.disabled',
            fontSize: 20,
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
          }}
        />
      )}

      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          bgcolor: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
          flexShrink: 0,
        }}
      >
        {getIcon()}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: '0.875rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.title}
          </Typography>
          <Chip
            size="small"
            label={node.type}
            sx={{
              height: 18,
              fontSize: '0.65rem',
              bgcolor: `${color}20`,
              color: color,
              fontWeight: 600,
            }}
          />
        </Box>
        {node.description && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.description}
          </Typography>
        )}
        {node.duration && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary' }}
          >
            Wait: {node.duration}
          </Typography>
        )}
      </Box>

      {onDelete && node.type !== 'start' && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          sx={{
            color: 'text.disabled',
            '&:hover': {
              color: 'error.main',
              bgcolor: 'error.light',
            },
          }}
        >
          <DeleteIcon sx={{ fontSize: 18 }} />
        </IconButton>
      )}
    </Box>
  );
}
