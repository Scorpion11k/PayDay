import { Box, Typography, Paper } from '@mui/material';
import { Insights as CustomerInsightIcon } from '@mui/icons-material';

export default function CustomerInsightPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <CustomerInsightIcon sx={{ fontSize: 28, color: 'primary.main' }} />
        <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
          Customer Insight
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
          Customer analytics and insights will be displayed here.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Deep dive into customer behavior, risk scores, and payment patterns.
        </Typography>
      </Paper>
    </Box>
  );
}

