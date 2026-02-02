import { Box, Typography, Paper, List, ListItemButton, ListItemIcon, ListItemText, Divider } from '@mui/material';
import {
  Email as EmailIcon,
  Sms as SmsIcon,
  WhatsApp as WhatsAppIcon,
  Call as CallIcon,
  Timer as TimerIcon,
  HelpOutline as ConditionIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import type { ActionType, FlowNodeType } from './types';

export interface ActionItem {
  type: FlowNodeType;
  action?: ActionType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const actions: ActionItem[] = [
  {
    type: 'action',
    action: 'send_email',
    title: 'Send Email',
    description: 'Send an email reminder to the customer',
    icon: <EmailIcon />,
    color: '#1976d2',
  },
  {
    type: 'action',
    action: 'send_sms',
    title: 'Send SMS',
    description: 'Send an SMS message to the customer',
    icon: <SmsIcon />,
    color: '#ed6c02',
  },
  {
    type: 'action',
    action: 'send_whatsapp',
    title: 'Send WhatsApp',
    description: 'Send a WhatsApp message to the customer',
    icon: <WhatsAppIcon />,
    color: '#25D366',
  },
  {
    type: 'action',
    action: 'voice_ai_call',
    title: 'Voice AI Call',
    description: 'Make an automated AI voice call',
    icon: <CallIcon />,
    color: '#9c27b0',
  },
];

const flowControls: ActionItem[] = [
  {
    type: 'wait',
    title: 'Wait',
    description: 'Wait for a specified duration',
    icon: <TimerIcon />,
    color: '#ff9800',
  },
  {
    type: 'condition',
    title: 'Condition',
    description: 'Branch based on a condition',
    icon: <ConditionIcon />,
    color: '#9c27b0',
  },
  {
    type: 'end',
    title: 'End Flow',
    description: 'End the collection flow',
    icon: <StopIcon />,
    color: '#f44336',
  },
];

interface ActionLibraryProps {
  onSelectAction: (item: ActionItem) => void;
}

export default function ActionLibrary({ onSelectAction }: ActionLibraryProps) {
  return (
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
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
        Actions
      </Typography>
      <List dense disablePadding>
        {actions.map((item, index) => (
          <ListItemButton
            key={index}
            onClick={() => onSelectAction(item)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&:hover': {
                bgcolor: `${item.color}10`,
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: item.color }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.title}
              secondary={item.description}
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
              secondaryTypographyProps={{ fontSize: '0.7rem' }}
            />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
        Flow Controls
      </Typography>
      <List dense disablePadding>
        {flowControls.map((item, index) => (
          <ListItemButton
            key={index}
            onClick={() => onSelectAction(item)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&:hover': {
                bgcolor: `${item.color}10`,
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: item.color }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.title}
              secondary={item.description}
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
              secondaryTypographyProps={{ fontSize: '0.7rem' }}
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
}

