import { Box, Typography, Paper } from '@mui/material';
import { People as CustomersIcon } from '@mui/icons-material';

export default function CustomersPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <CustomersIcon sx={{ fontSize: 28, color: 'primary.main' }} />
        <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
          Customers
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
          Customer management interface will be displayed here.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          View, search, and manage your customer database.
        </Typography>
      </Paper>
    </Box>
  );
}

