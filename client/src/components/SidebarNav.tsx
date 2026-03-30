import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
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
  Article as TemplatesIcon,
} from '@mui/icons-material';
import { useLanguage } from '../context/LanguageContext';
import paydayLogo from '../assets/payday-logo.png';

// Lovable sidebar color palette (HSL converted to hex)
const SIDEBAR = {
  bg: 'hsl(228, 25%, 12%)',           // --sidebar-background
  fg: 'hsl(220, 15%, 92%)',           // --sidebar-foreground
  fgMuted: 'hsla(220, 15%, 92%, 0.7)', // foreground at 70% opacity
  accent: 'hsl(228, 22%, 18%)',       // --sidebar-accent
  border: 'hsl(228, 20%, 20%)',       // --sidebar-border
  brand: 'hsl(225, 38%, 21%)',        // --brand
  brandFg: '#fff',                     // --brand-foreground
};

interface NavItem {
  labelKey: string;
  path: string;
  icon: typeof HomeIcon;
}

const navItems: NavItem[] = [
  { labelKey: 'nav.home', path: '/', icon: HomeIcon },
  { labelKey: 'nav.customers', path: '/customers', icon: CustomersIcon },
  { labelKey: 'nav.templates', path: '/templates', icon: TemplatesIcon },
  { labelKey: 'nav.activities', path: '/activities', icon: ActivitiesIcon },
  { labelKey: 'nav.dashboards', path: '/dashboards', icon: DashboardsIcon },
  { labelKey: 'nav.flows', path: '/flows', icon: FlowsIcon },
  { labelKey: 'nav.contracts', path: '/contracts', icon: ContractsIcon },
  { labelKey: 'nav.chatHistory', path: '/chat-history', icon: ChatHistoryIcon },
  { labelKey: 'nav.customerInsight', path: '/customer-insight', icon: CustomerInsightIcon },
  { labelKey: 'nav.integrations', path: '/integrations', icon: IntegrationsIcon },
];

interface SidebarNavProps {
  drawerWidth: number;
}

export default function SidebarNav({ drawerWidth }: SidebarNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  return (
    <Box
      sx={{
        width: drawerWidth,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: SIDEBAR.bg,
        color: SIDEBAR.fg,
        borderRight: isRTL ? 'none' : `1px solid ${SIDEBAR.border}`,
        borderLeft: isRTL ? `1px solid ${SIDEBAR.border}` : 'none',
      }}
    >
      {/* Logo Header */}
      <Box
        sx={{
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${SIDEBAR.border}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            component="img"
            src={paydayLogo}
            alt="PayDay AI"
            sx={{ height: 48, width: 'auto' }}
          />
        </Box>
        <Tooltip title={t('nav.settings')}>
          <IconButton
            onClick={() => navigate('/settings')}
            sx={{
              color: SIDEBAR.fgMuted,
              '&:hover': {
                color: SIDEBAR.fg,
                bgcolor: SIDEBAR.accent,
              },
            }}
            size="small"
          >
            <SettingsIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Navigation Items */}
      <List
        sx={{
          flex: 1,
          px: 2,
          py: 2,
          overflowY: 'auto',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isSelected = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.path}
              selected={isSelected}
              onClick={() => navigate(item.path)}
              dense
              sx={{
                borderRadius: 2,
                px: 2,
                height: 48,
                minHeight: 0,
                transition: 'all 0.2s ease',
                color: isSelected ? 'red' : '#c4c9cf',
                '&.Mui-selected': {
                  bgcolor: SIDEBAR.accent,
                  color: '#fdfeff',
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: SIDEBAR.accent,
                  },
                },
                '&:hover': {
                  bgcolor: SIDEBAR.accent,
                  color: '#fdfeff',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 36, mr: 0 }}>
                <Icon sx={{ fontSize: 22 }} />
              </ListItemIcon>
              <ListItemText
                primary={t(item.labelKey)}
                sx={{ my: 0 }}
                primaryTypographyProps={{
                  fontSize: '16px',
                  fontWeight: isSelected ? 600 : 400,
                  lineHeight: 1.3,
                  fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
                  color: 'inherit',
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* User Section */}
      <Box
        sx={{
          mt: 'auto',
          p: 2,
          borderTop: `1px solid ${SIDEBAR.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: SIDEBAR.accent,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: SIDEBAR.brand,
              color: SIDEBAR.brandFg,
              fontSize: '0.875rem',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            G
          </Avatar>
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: SIDEBAR.fg,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            gil.kamar@gmail.com
          </Typography>
        </Box>

        <ListItemButton
          sx={{
            borderRadius: 2,
            py: 1,
            color: SIDEBAR.fgMuted,
            '&:hover': {
              bgcolor: SIDEBAR.accent,
              color: SIDEBAR.fg,
            },
          }}
        >
          <ListItemIcon
            sx={{
              color: 'inherit',
              minWidth: 32,
              ...(isRTL ? { ml: 1 } : { mr: 1 }),
            }}
          >
            <LogoutIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary={t('nav.signOut')}
            primaryTypographyProps={{ fontSize: '0.875rem' }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );
}
