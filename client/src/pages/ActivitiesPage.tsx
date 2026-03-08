import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Pagination,
  IconButton,
  Tooltip,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  TrendingUp as ActivitiesIcon,
  Sms as SmsIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
  Phone as PhoneIcon,
  Chat as ChatIcon,
  AccountTree as FlowIcon,
  CheckCircle as SuccessIcon,
  Cancel as FailedIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { listActivities, type ActivityLogItem } from '../services/api';

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  'SMS Sent': <SmsIcon fontSize="small" />,
  'Email Sent': <EmailIcon fontSize="small" />,
  'WhatsApp Sent': <WhatsAppIcon fontSize="small" />,
  'Voice Call Made': <PhoneIcon fontSize="small" />,
  'Chat Prompt': <ChatIcon fontSize="small" />,
  'Collection Flow Created': <FlowIcon fontSize="small" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  'SMS Sent': '#2196f3',
  'Email Sent': '#ff9800',
  'WhatsApp Sent': '#4caf50',
  'Voice Call Made': '#9c27b0',
  'Chat Prompt': '#00bcd4',
  'Collection Flow Created': '#3f51b5',
};

function getIcon(activityName: string) {
  return ACTIVITY_ICONS[activityName] || <ActivitiesIcon fontSize="small" />;
}

function getColor(activityName: string) {
  return ACTIVITY_COLORS[activityName] || '#607d8b';
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullTime(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ActivityRow({ activity }: { activity: ActivityLogItem }) {
  const color = getColor(activity.activityName);
  const icon = getIcon(activity.activityName);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        py: 2,
        px: 2.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        transition: 'background-color 0.15s',
        '&:hover': { bgcolor: 'action.hover' },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      {/* Icon circle */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${color}14`,
          color,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {icon}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" fontWeight={600} noWrap>
            {activity.activityName}
          </Typography>
          <Chip
            size="small"
            icon={activity.status === 'success' ? <SuccessIcon /> : <FailedIcon />}
            label={activity.status === 'success' ? 'Success' : 'Failed'}
            color={activity.status === 'success' ? 'success' : 'error'}
            variant="outlined"
            sx={{ height: 22, '& .MuiChip-icon': { fontSize: 14 } }}
          />
        </Box>

        {activity.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
            {activity.description}
          </Typography>
        )}

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.75 }}>
          {activity.customerName && (
            <Chip
              size="small"
              icon={<PersonIcon />}
              label={activity.customerName}
              variant="outlined"
              sx={{ height: 22, '& .MuiChip-icon': { fontSize: 14 } }}
            />
          )}
          <Tooltip title={formatFullTime(activity.createdAt)} placement="top" arrow>
            <Typography variant="caption" color="text.disabled">
              {formatTime(activity.createdAt)}
            </Typography>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}

export default function ActivitiesPage() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listActivities({
        page,
        limit: 15,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setActivities(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleTypeChange = (e: SelectChangeEvent) => {
    setTypeFilter(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e: SelectChangeEvent) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ActivitiesIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {t('pages.activities.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('pages.activities.subtitle')}
            </Typography>
          </Box>
        </Box>
        <Tooltip title={t('common.refresh')}>
          <IconButton onClick={fetchActivities} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('pages.activities.filterType')}</InputLabel>
            <Select
              value={typeFilter}
              label={t('pages.activities.filterType')}
              onChange={handleTypeChange}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              <MenuItem value="notification_sent">{t('pages.activities.types.notification_sent')}</MenuItem>
              <MenuItem value="chat_prompt">{t('pages.activities.types.chat_prompt')}</MenuItem>
              <MenuItem value="collection_flow_created">{t('pages.activities.types.collection_flow_created')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('common.status')}</InputLabel>
            <Select
              value={statusFilter}
              label={t('common.status')}
              onChange={handleStatusChange}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              <MenuItem value="success">{t('pages.activities.statuses.success')}</MenuItem>
              <MenuItem value="failed">{t('pages.activities.statuses.failed')}</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {total} {t('pages.activities.totalActivities')}
          </Typography>
        </Stack>
      </Paper>

      {/* Activity Timeline */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('pages.activities.timeline')}
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : activities.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {t('pages.activities.noActivities')}
            </Typography>
          </Box>
        ) : (
          <>
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              size="small"
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
}
