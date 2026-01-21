import { Box, Typography, Paper } from '@mui/material';
import { Insights as CustomerInsightIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export default function CustomerInsightPage() {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <CustomerInsightIcon sx={{ fontSize: 28, color: 'primary.main' }} />
        <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
          {t('pages.customerInsight.title')}
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
          {t('pages.customerInsight.description')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('pages.customerInsight.subtitle')}
        </Typography>
      </Paper>
    </Box>
  );
}
