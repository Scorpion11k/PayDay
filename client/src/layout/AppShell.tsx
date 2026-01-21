import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Switch,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import SidebarNav from '../components/SidebarNav';
import ChatPanel from '../components/Chat/ChatPanel';

const DRAWER_WIDTH = 220;

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
      }}
    >
      {/* Sidebar Drawer */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          <SidebarNav drawerWidth={DRAWER_WIDTH} />
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          <SidebarNav drawerWidth={DRAWER_WIDTH} />
        </Drawer>
      )}

      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        {/* Top App Bar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: '#fff',
            color: 'text.primary',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            {isMobile && (
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ marginInlineEnd: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {t('app.title')}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', fontSize: '0.813rem' }}
              >
                {t('app.subtitle')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch defaultChecked size="small" />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t('app.preview')}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: 'success.main', fontWeight: 500, fontSize: '0.813rem' }}
                >
                  {t('app.systemActive')}
                </Typography>
              </Box>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
            pb: '200px', // Space for chat panel (input + suggestions)
          }}
        >
          {children}
        </Box>

        {/* Chat Panel - Fixed at bottom center */}
        <ChatPanel />
      </Box>
    </Box>
  );
}
