import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Pagination,
  IconButton,
  Snackbar,
  Tooltip,
  Collapse,
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
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { deleteAllActivities, listActivities, type ActivityLogItem } from '../services/api';

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

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const TONE_LABELS: Record<string, string> = {
  calm: 'Calm',
  medium: 'Medium',
  heavy: 'Heavy',
};

function ActivityRow({ activity, t }: { activity: ActivityLogItem; t: (key: string) => string }) {
  const color = getColor(activity.activityName);
  const icon = getIcon(activity.activityName);
  const [expanded, setExpanded] = useState(false);

  const isNotification = activity.type === 'notification_sent';
  const metadata = activity.metadata as Record<string, unknown> | null;
  const messageText = metadata?.messageText as string | undefined;
  const tone = metadata?.tone as string | undefined;
  const hasDetails = isNotification && (messageText || tone);

  const statusLabel = activity.status === 'success'
    ? t('pages.activities.statuses.success')
    : t('pages.activities.statuses.failed');

  const toneLabel = tone
    ? (t(`pages.activities.toneLabels.${tone}`) || TONE_LABELS[tone] || tone)
    : null;

  return (
    <Box
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          py: 2,
          px: 2.5,
          transition: 'background-color 0.15s',
          '&:hover': { bgcolor: 'action.hover' },
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
              label={statusLabel}
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
            <Typography variant="caption" color="text.disabled">
              {formatDateTime(activity.createdAt)}
            </Typography>
          </Stack>
        </Box>

        {/* Expand button for notifications */}
        {hasDetails && (
          <Tooltip title={expanded ? t('pages.activities.collapse') : t('pages.activities.expand')}>
            <IconButton
              aria-label={expanded ? t('pages.activities.collapse') : t('pages.activities.expand')}
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ mt: 0.5 }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Expanded detail panel */}
      {hasDetails && (
        <Collapse in={expanded}>
          <Box
            sx={{
              mx: 2.5,
              mb: 2,
              ml: 8.5,
              p: 2,
              bgcolor: '#f8fafc',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {toneLabel && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {t('pages.activities.toneUsed')}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip size="small" label={toneLabel} variant="outlined" color="primary" />
                </Box>
              </Box>
            )}
            {messageText && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {t('pages.activities.messageSent')}
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 0.5,
                    p: 1.5,
                    bgcolor: 'background.paper',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {messageText}
                  </Typography>
                </Paper>
              </Box>
            )}
          </Box>
        </Collapse>
      )}
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
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

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

  const handleDeleteAllConfirm = async () => {
    setDeletingAll(true);

    try {
      const result = await deleteAllActivities();

      setActivities([]);
      setTotal(0);
      setTotalPages(1);
      setPage(1);
      setError(null);
      setDeleteAllDialogOpen(false);
      setSnackbar({
        open: true,
        message: t('notifications.allActivitiesDeleted', { count: result.deletedCount }),
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : t('notifications.error.deleteAllActivities'),
        severity: 'error',
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const deleteAllDisabled = loading || deletingAll || (total === 0 && !typeFilter && !statusFilter);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          mb: 3,
        }}
      >
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
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteAllDialogOpen(true)}
            disabled={deleteAllDisabled}
            sx={{ textTransform: 'none' }}
          >
            {t('pages.activities.deleteAll')}
          </Button>
          <Tooltip title={t('common.refresh')}>
            <IconButton aria-label={t('common.refresh')} onClick={fetchActivities} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
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
              <ActivityRow key={activity.id} activity={activity} t={t} />
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

      <Dialog
        open={deleteAllDialogOpen}
        onClose={() => !deletingAll && setDeleteAllDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon />
          {t('dialogs.deleteAllActivities.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('dialogs.deleteAllActivities.message')}
          </DialogContentText>
          <Alert severity="error" sx={{ mt: 2 }}>
            {t('dialogs.deleteAllActivities.warning')}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteAllDialogOpen(false)} color="inherit" disabled={deletingAll}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteAllConfirm}
            variant="contained"
            color="error"
            disabled={deletingAll}
            startIcon={deletingAll ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
          >
            {deletingAll ? t('actions.deleting') : t('dialogs.deleteAllActivities.confirmButton')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
