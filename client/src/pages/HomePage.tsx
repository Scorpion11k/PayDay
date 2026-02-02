import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardActionArea, CardContent, Chip, Paper, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  AccountTree as FlowsIcon,
  Send as SendIcon,
  Dashboard as DashboardIcon,
  Email as EmailIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  AutoAwesome as SparkleIcon,
} from '@mui/icons-material';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const quickActions = [
    {
      titleKey: 'home.quickActions.buildFlow',
      descKey: 'home.quickActions.buildFlowDesc',
      icon: <FlowsIcon sx={{ fontSize: 28 }} />,
      color: '#9c27b0',
      path: '/flows',
    },
    {
      titleKey: 'home.quickActions.sendReminder',
      descKey: 'home.quickActions.sendReminderDesc',
      icon: <SendIcon sx={{ fontSize: 28 }} />,
      color: '#1976d2',
      path: '/customers',
    },
    {
      titleKey: 'home.quickActions.buildDashboard',
      descKey: 'home.quickActions.buildDashboardDesc',
      icon: <DashboardIcon sx={{ fontSize: 28 }} />,
      color: '#2e7d32',
      path: '/dashboards',
    },
    {
      titleKey: 'home.quickActions.sendOverdue',
      descKey: 'home.quickActions.sendOverdueDesc',
      icon: <EmailIcon sx={{ fontSize: 28 }} />,
      color: '#ed6c02',
      path: '/customers',
    },
  ];

  const stats = [
    { label: 'Active Customers', value: '1,250', trend: '+12%', color: '#1976d2' },
    { label: 'Outstanding Debt', value: '₪2.4M', trend: '-8%', color: '#ed6c02' },
    { label: 'Collected Today', value: '₪45K', trend: '+24%', color: '#2e7d32' },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 200px)',
        px: 3,
        py: 4,
      }}
    >
      {/* Hero Section */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mb: 4,
        }}
      >
        {/* Logo */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 1,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '1px',
                color: 'text.secondary',
              }}
            >
              PAYDAY AI
            </Typography>
            <SparkleIcon sx={{ fontSize: 14, color: 'primary.main' }} />
          </Box>
          <Box
            sx={{
              width: 64,
              height: 64,
              bgcolor: '#1e3a5f',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '2rem',
              position: 'relative',
              boxShadow: '0 4px 20px rgba(30, 58, 95, 0.3)',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: -6,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 8,
                height: 24,
                bgcolor: '#4fc3f7',
                borderRadius: 1,
              },
            }}
          >
            P
          </Box>
        </Box>

        {/* Welcome Text */}
        <Typography
          variant="h1"
          sx={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'text.primary',
            mb: 1,
            textAlign: 'center',
          }}
        >
          {t('home.welcome')}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            mb: 3,
            textAlign: 'center',
            maxWidth: 500,
          }}
        >
          {t('home.subtitle')}
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          mb: 4,
          flexWrap: 'wrap',
        }}
      >
        {stats.map((stat, index) => (
          <Paper
            key={index}
            elevation={0}
            sx={{
              px: 3,
              py: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              minWidth: 180,
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {stat.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {stat.value}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={stat.trend}
              icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
              sx={{
                bgcolor: stat.trend.startsWith('+') ? 'success.light' : 'error.light',
                color: stat.trend.startsWith('+') ? 'success.dark' : 'error.dark',
                fontWeight: 600,
                fontSize: '0.7rem',
              }}
            />
          </Paper>
        ))}
      </Box>

      {/* Quick Action Cards - 2x2 Grid */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          maxWidth: 800,
          justifyContent: 'center',
          mx: 'auto',
        }}
      >
        {quickActions.map((action, index) => (
          <Box key={index} sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: action.color,
                  boxShadow: `0 4px 20px ${action.color}20`,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardActionArea
                sx={{ height: '100%', p: 1 }}
                onClick={() => navigate(action.path)}
              >
                <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: `${action.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: action.color,
                      flexShrink: 0,
                    }}
                  >
                    {action.icon}
                  </Box>
                  <Box>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 600,
                        color: 'text.primary',
                        fontSize: '0.95rem',
                        mb: 0.5,
                      }}
                    >
                      {t(action.titleKey)}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        fontSize: '0.813rem',
                      }}
                    >
                      {t(action.descKey)}
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Bottom Links */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          mt: 4,
        }}
      >
        <Button
          variant="text"
          startIcon={<PeopleIcon />}
          onClick={() => navigate('/customers')}
        >
          View Customers
        </Button>
        <Button
          variant="text"
          startIcon={<DashboardIcon />}
          onClick={() => navigate('/dashboards')}
        >
          View Dashboards
        </Button>
      </Box>
    </Box>
  );
}
