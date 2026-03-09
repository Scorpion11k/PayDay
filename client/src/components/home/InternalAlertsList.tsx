import { Box, Chip, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { HomeBrainInternalAlert } from '../../types/home-brain';

interface InternalAlertsListProps {
  alerts: HomeBrainInternalAlert[];
}

export default function InternalAlertsList({ alerts }: InternalAlertsListProps) {
  const { t } = useTranslation();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        {t('homeBrain.internalAlerts')}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {alerts.map((alert) => (
          <Paper
            key={alert.id}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              flex: '1 1 300px',
              minWidth: 300,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {alert.title}
              </Typography>
              <Chip size="small" label={alert.severity} />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              {alert.body}
            </Typography>
            <Chip size="small" label={alert.audience} variant="outlined" />
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
