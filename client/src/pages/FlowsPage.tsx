import { Box, Typography, Paper } from '@mui/material';
import { AccountTree as FlowsIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export default function FlowsPage() {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <FlowsIcon sx={{ fontSize: 28, color: 'primary.main' }} />
        <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
          {t('pages.flows.title')}
        </Typography>
      </Box>
      <Paper
        sx={{
          p: 4,
          textAlign: 'center',
          bgcolor: '#f8fafc',
          border: '1px dashed',
          borderColor: 'divider',
        }}
      >
        <Typography color="text.secondary">
          {t('pages.flows.description')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('pages.flows.subtitle')}
        </Typography>
      </Paper>
    </Box>
  );
}
