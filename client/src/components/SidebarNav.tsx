import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Home as HomeIcon,
  People as CustomersIcon,
  TrendingUp as ActivitiesIcon,
  Dashboard as DashboardsIcon,
  AccountTree as FlowsIcon,
  Description as ContractsIcon,
  ChatBubbleOutline as ChatHistoryIcon,
  Insights as CustomerInsightIcon,
  Extension as IntegrationsIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

const navItems = [
  { label: 'Home', path: '/', icon: HomeIcon },
  { label: 'Customers', path: '/customers', icon: CustomersIcon },
  { label: 'Activities', path: '/activities', icon: ActivitiesIcon },
  { label: 'Dashboards', path: '/dashboards', icon: DashboardsIcon },
  { label: 'Flows', path: '/flows', icon: FlowsIcon },
  { label: 'Contracts', path: '/contracts', icon: ContractsIcon },
  { label: 'Chat History', path: '/chat-history', icon: ChatHistoryIcon },
  { label: 'Customer Insight', path: '/customer-insight', icon: CustomerInsightIcon },
  { label: 'Integrations', path: '/integrations', icon: IntegrationsIcon },
];

interface SidebarNavProps {
  drawerWidth: number;
}

export default function SidebarNav({ drawerWidth }: SidebarNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        width: drawerWidth,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#1e2a3a',
        color: '#fff',
      }}
    >
      {/* Logo Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              bgcolor: '#fff',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1e2a3a',
              fontWeight: 700,
              fontSize: '1.2rem',
            }}
          >
            P
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: '0.85rem',
              letterSpacing: '0.5px',
            }}
          >
            PAYDAY
          </Typography>
        </Box>
        <SettingsIcon sx={{ fontSize: 20, opacity: 0.7, cursor: 'pointer' }} />
      </Box>

      {/* Navigation Items */}
      <List sx={{ flex: 1, px: 1, pt: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isSelected = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.path}
              selected={isSelected}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                py: 1,
                color: isSelected ? '#4fc3f7' : 'rgba(255,255,255,0.85)',
                '&.Mui-selected': {
                  bgcolor: 'rgba(79, 195, 247, 0.12)',
                  color: '#4fc3f7',
                  '&:hover': {
                    bgcolor: 'rgba(79, 195, 247, 0.18)',
                  },
                },
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.08)',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                <Icon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: isSelected ? 500 : 400,
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* User Section */}
      <Box sx={{ mt: 'auto' }}>
        <Box
          sx={{
            mx: 1,
            mb: 1,
            p: 1.5,
            bgcolor: '#2c6b8f',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: '#4fc3f7',
              fontSize: '0.875rem',
            }}
          >
            L
          </Avatar>
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.813rem',
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            gil.kamar@gmail.com
          </Typography>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        <ListItemButton
          sx={{
            py: 1.5,
            color: 'rgba(255,255,255,0.7)',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.08)',
            },
          }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
            <LogoutIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText
            primary="Sign Out"
            primaryTypographyProps={{ fontSize: '0.875rem' }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );
}

