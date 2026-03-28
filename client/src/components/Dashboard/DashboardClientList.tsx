import { Box, Paper, Typography, Chip, Divider } from '@mui/material';
import {
  Person as PersonIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ClientItem {
  id: string;
  fullName: string;
  totalDebt: number;
  overdueCount: number;
}

interface DashboardClientListProps {
  clients: ClientItem[];
}

export default function DashboardClientList({ clients }: DashboardClientListProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        height: '100%',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
        {t('dashboards.recentClients', 'Recent Clients')}
      </Typography>

      {clients.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
          {t('dashboards.noClients', 'No clients found')}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {clients.map((client, index) => (
            <Box key={client.id}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.5,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box sx={{ textAlign: isRTL ? 'right' : 'left' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {client.fullName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t('dashboards.debt', 'Debt')}: ₪{client.totalDebt.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                {client.overdueCount > 0 && (
                  <Chip
                    size="small"
                    icon={<WarningIcon sx={{ fontSize: 14 }} />}
                    label={`${client.overdueCount} ${t('dashboards.overdue', 'overdue')}`}
                    color="error"
                    variant="outlined"
                    sx={{ height: 24, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
              {index < clients.length - 1 && <Divider />}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
