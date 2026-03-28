import { Box, Paper, Typography, Divider } from '@mui/material';
import {
  Email as EmailIcon,
  Chat as ChatIcon,
  AccountTree as FlowIcon,
  Notifications as NotifIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ActivityItem {
  id: string;
  type: string;
  activityName: string;
  description: string | null;
  customerName: string | null;
  createdAt: string;
}

interface DashboardRecentActivitiesProps {
  activities: ActivityItem[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  notification_sent: <EmailIcon sx={{ fontSize: 16 }} />,
  chat_prompt: <ChatIcon sx={{ fontSize: 16 }} />,
  collection_flow_created: <FlowIcon sx={{ fontSize: 16 }} />,
};

export default function DashboardRecentActivities({ activities }: DashboardRecentActivitiesProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';

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
        {t('dashboards.recentActivities', 'Recent Activities')}
      </Typography>

      {activities.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
          {t('dashboards.noActivities', 'No activities found')}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {activities.map((activity, index) => (
            <Box key={activity.id}>
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
                      width: 32,
                      height: 32,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'text.secondary',
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_ICONS[activity.type] || <NotifIcon sx={{ fontSize: 16 }} />}
                  </Box>
                  <Box sx={{ textAlign: isRTL ? 'right' : 'left' }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 500, color: 'text.primary', textTransform: 'capitalize' }}
                    >
                      {activity.activityName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {activity.customerName || t('dashboards.system', 'System')}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  {new Date(activity.createdAt).toLocaleString(locale, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              </Box>
              {index < activities.length - 1 && <Divider />}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
