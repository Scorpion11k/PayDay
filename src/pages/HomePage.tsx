import { Box, Typography, Card, CardActionArea, CardContent } from '@mui/material';

const quickActions = [
  {
    title: 'Build a Collection Flow Demo',
    description: 'Create automated collection workflows',
  },
  {
    title: 'Send Payment Reminder by Segment for Over 50K customers',
    description: 'Target high-value customer segments',
  },
  {
    title: 'Build Dashboard on the Fly',
    description: 'Generate custom analytics dashboards',
  },
  {
    title: 'Send Overdue CSV to Management',
    description: 'Export and share overdue reports',
  },
];

export default function HomePage() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 200px)',
        px: 3,
        py: 4,
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
            PAYDAY
          </Typography>
        </Box>
        <Box
          sx={{
            width: 56,
            height: 56,
            bgcolor: '#1e2a3a',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.75rem',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: -4,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 6,
              height: 20,
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
          fontSize: '1.75rem',
          fontWeight: 600,
          color: 'text.primary',
          mb: 1,
          textAlign: 'center',
        }}
      >
        Welcome to PayDay AI
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: 'text.secondary',
          mb: 4,
          textAlign: 'center',
          maxWidth: 500,
        }}
      >
        Your intelligent debt collection assistant. Type a command or try one of the
        examples below.
      </Typography>

      {/* Quick Action Cards - 2x2 Grid using Flexbox */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          maxWidth: 700,
          justifyContent: 'center',
        }}
      >
        {quickActions.map((action, index) => (
          <Box key={index} sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                },
              }}
            >
              <CardActionArea sx={{ height: '100%', p: 0.5 }}>
                <CardContent>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      color: 'text.primary',
                      fontSize: '0.875rem',
                    }}
                  >
                    {action.title}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
