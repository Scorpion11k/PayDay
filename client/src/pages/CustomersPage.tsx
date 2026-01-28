import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Snackbar,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  People as CustomersIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Add as AddIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  WhatsApp as WhatsAppIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
  Sms as SmsIcon,
  Call as CallIcon,
} from '@mui/icons-material';
import { useLanguage } from '../context/LanguageContext';

interface Customer {
  id: string;
  externalRef: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  dateOfBirth: string | null;
  religion: string | null;
  status: 'active' | 'do_not_contact' | 'blocked';
  createdAt: string;
  updatedAt: string;
  _count: {
    debts: number;
    payments: number;
  };
  totalDebtAmount: number;
  isOverdue: boolean;
  overdueDays: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CustomersResponse {
  success: boolean;
  data: Customer[];
  pagination: PaginationInfo;
}

interface NewCustomerForm {
  fullName: string;
  email: string;
  phone: string;
  externalRef: string;
  status: 'active' | 'do_not_contact' | 'blocked';
}

const initialFormState: NewCustomerForm = {
  fullName: '',
  email: '',
  phone: '',
  externalRef: '',
  status: 'active',
};

const statusColors: Record<Customer['status'], 'success' | 'warning' | 'error'> = {
  active: 'success',
  do_not_contact: 'warning',
  blocked: 'error',
};

type SortField = 'fullName' | 'email' | 'status' | 'createdAt' | 'totalDebtAmount' | 'isOverdue' | 'payments';
type SortOrder = 'asc' | 'desc';

export default function CustomersPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Add Customer Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<NewCustomerForm>(initialFormState);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewCustomerForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Actions Menu State
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Delete Confirmation Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delete All Confirmation Dialog
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Send Notification Dialog
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationType, setNotificationType] = useState<'email' | 'whatsapp' | 'sms' | 'call_task' | null>(null);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'he' | 'ar'>('en');
  const [selectedTone, setSelectedTone] = useState<'calm' | 'medium' | 'heavy'>('calm');
  const [templatePreview, setTemplatePreview] = useState<{ subject?: string; bodyText: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Edit Customer Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<NewCustomerForm>(initialFormState);
  const [editFormErrors, setEditFormErrors] = useState<Partial<Record<keyof NewCustomerForm, string>>>({});
  const [updating, setUpdating] = useState(false);

  // Status labels with translations
  const getStatusLabel = (status: Customer['status']): string => {
    const labels: Record<Customer['status'], string> = {
      active: t('customers.status.active'),
      do_not_contact: t('customers.status.doNotContact'),
      blocked: t('customers.status.blocked'),
    };
    return labels[status];
  };

  // Gender labels with translations
  const getGenderLabel = (gender: Customer['gender']): string => {
    if (!gender) return '—';
    const labels: Record<NonNullable<Customer['gender']>, string> = {
      male: t('common.male') || 'Male',
      female: t('common.female') || 'Female',
      other: t('common.other') || 'Other',
      prefer_not_to_say: t('common.preferNotToSay') || 'Prefer not to say',
    };
    return labels[gender] || gender;
  };

  // Format date of birth
  const formatDateOfBirth = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchDebounce) {
        params.set('search', searchDebounce);
      }

      if (statusFilter) {
        params.set('status', statusFilter);
      }

      if (sortBy) {
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
      }

      const response = await fetch(`http://localhost:3001/api/customers?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: CustomersResponse = await response.json();

      if (data.success) {
        setCustomers(data.data);
        setPagination(data.pagination);
      } else {
        throw new Error('Failed to fetch customers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchDebounce, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchDebounce, statusFilter]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage + 1 }));
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPagination((prev) => ({
      ...prev,
      limit: parseInt(event.target.value, 10),
      page: 1,
    }));
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with descending order
      setSortBy(field);
      setSortOrder('desc');
    }
    // Reset to first page when sorting changes
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Dialog handlers
  const handleOpenDialog = () => {
    setDialogOpen(true);
    setFormData(initialFormState);
    setFormErrors({});
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormData(initialFormState);
    setFormErrors({});
  };

  const handleFormChange = (field: keyof NewCustomerForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: string } }
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewCustomerForm, string>> = {};

    if (!formData.fullName.trim()) {
      errors.fullName = t('validation.fullNameRequired');
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('validation.invalidEmail');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const payload: Record<string, string> = {
        fullName: formData.fullName.trim(),
        status: formData.status,
      };

      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.phone.trim()) payload.phone = formData.phone.trim();
      if (formData.externalRef.trim()) payload.externalRef = formData.externalRef.trim();

      const response = await fetch('http://localhost:3001/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('notifications.error.createCustomer'));
      }

      setSnackbar({ open: true, message: t('notifications.customerCreated'), severity: 'success' });
      handleCloseDialog();
      fetchCustomers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : t('notifications.error.createCustomer'),
        severity: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Actions Menu Handlers
  const handleActionsClick = (event: React.MouseEvent<HTMLElement>, customer: Customer) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedCustomer(customer);
  };

  const handleActionsClose = () => {
    setAnchorEl(null);
  };

  // Delete Customer
  const handleDeleteClick = () => {
    handleActionsClose();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCustomer) return;

    setDeleting(true);

    try {
      const response = await fetch(`http://localhost:3001/api/customers/${selectedCustomer.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || t('notifications.error.deleteCustomer'));
      }

      setSnackbar({ open: true, message: t('notifications.customerDeleted'), severity: 'success' });
      setDeleteDialogOpen(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : t('notifications.error.deleteCustomer'),
        severity: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Delete All Customers
  const handleDeleteAllClick = () => {
    setDeleteAllDialogOpen(true);
  };

  const handleDeleteAllConfirm = async () => {
    setDeletingAll(true);

    try {
      const response = await fetch('http://localhost:3001/api/customers/all', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('notifications.error.deleteAllCustomers'));
      }

      setSnackbar({ 
        open: true, 
        message: t('notifications.allCustomersDeleted', { count: data.data?.deletedCount || 0 }), 
        severity: 'success' 
      });
      setDeleteAllDialogOpen(false);
      fetchCustomers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : t('notifications.error.deleteAllCustomers'),
        severity: 'error',
      });
    } finally {
      setDeletingAll(false);
    }
  };

  // Edit Customer
  const handleEditClick = () => {
    if (selectedCustomer) {
      setEditFormData({
        fullName: selectedCustomer.fullName,
        email: selectedCustomer.email || '',
        phone: selectedCustomer.phone || '',
        externalRef: selectedCustomer.externalRef || '',
        status: selectedCustomer.status,
      });
      setEditFormErrors({});
      handleActionsClose();
      setEditDialogOpen(true);
    }
  };

  const handleEditFormChange = (field: keyof NewCustomerForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: string } }
  ) => {
    setEditFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (editFormErrors[field]) {
      setEditFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateEditForm = (): boolean => {
    const errors: Partial<Record<keyof NewCustomerForm, string>> = {};

    if (!editFormData.fullName.trim()) {
      errors.fullName = t('validation.fullNameRequired');
    }

    if (editFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email)) {
      errors.email = t('validation.invalidEmail');
    }

    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSubmit = async () => {
    if (!selectedCustomer || !validateEditForm()) return;

    setUpdating(true);

    try {
      const payload: Record<string, string | null> = {
        fullName: editFormData.fullName.trim(),
        status: editFormData.status,
      };

      payload.email = editFormData.email.trim() || null;
      payload.phone = editFormData.phone.trim() || null;
      payload.externalRef = editFormData.externalRef.trim() || null;

      const response = await fetch(`http://localhost:3001/api/customers/${selectedCustomer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('notifications.error.updateCustomer'));
      }

      setSnackbar({ open: true, message: t('notifications.customerUpdated'), severity: 'success' });
      setEditDialogOpen(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : t('notifications.error.updateCustomer'),
        severity: 'error',
      });
    } finally {
      setUpdating(false);
    }
  };

  // Send Notification
  // Fetch template preview
  const fetchTemplatePreview = useCallback(async (
    customerId: string,
    channel: 'email' | 'whatsapp' | 'sms' | 'call_task',
    lang: 'en' | 'he' | 'ar',
    tone: 'calm' | 'medium' | 'heavy'
  ) => {
    setLoadingPreview(true);
    try {
      const response = await fetch('http://localhost:3001/api/messaging/preview-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          channel,
          language: lang,
          tone,
          templateKey: 'debt_reminder'
        }),
      });
      const data = await response.json();
      if (data.success) {
        setTemplatePreview({ subject: data.data.subject, bodyText: data.data.bodyText });
      } else {
        setTemplatePreview(null);
      }
    } catch {
      setTemplatePreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  const handleSendNotification = (type: 'email' | 'whatsapp' | 'sms' | 'call_task') => {
    handleActionsClose();
    setNotificationType(type);
    setSelectedLanguage('en');
    setSelectedTone('calm');
    setTemplatePreview(null);
    setNotificationDialogOpen(true);
    // Fetch preview for the selected customer
    if (selectedCustomer) {
      fetchTemplatePreview(selectedCustomer.id, type, 'en', 'calm');
    }
  };

  // Refetch template preview when language or tone changes
  useEffect(() => {
    if (notificationDialogOpen && selectedCustomer && notificationType) {
      fetchTemplatePreview(selectedCustomer.id, notificationType, selectedLanguage, selectedTone);
    }
  }, [selectedLanguage, selectedTone, notificationDialogOpen, selectedCustomer, notificationType, fetchTemplatePreview]);

  const handleSendNotificationConfirm = async () => {
    if (!selectedCustomer || !notificationType) return;

    setSendingNotification(true);

    try {
      // Use the messaging API to actually send the reminder
      const response = await fetch('http://localhost:3001/api/messaging/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          channel: notificationType,
          templateKey: 'debt_reminder',
          language: selectedLanguage,
          tone: selectedTone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || t('notifications.error.sendNotification'));
      }

      const channelLabels: Record<string, string> = {
        email: t('common.email'),
        whatsapp: 'WhatsApp',
        sms: 'SMS',
        call_task: t('common.voiceCall') || 'Voice call',
      };
      setSnackbar({
        open: true,
        message: t('notifications.reminderSent', { type: channelLabels[notificationType], name: selectedCustomer.fullName }),
        severity: 'success',
      });

      setNotificationDialogOpen(false);
      setNotificationType(null);
      setSelectedCustomer(null);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : t('notifications.error.sendNotification'),
        severity: 'error',
      });
    } finally {
      setSendingNotification(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CustomersIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {t('customers.title')}
          </Typography>
          {!loading && (
            <Chip label={`${pagination.total} ${t('common.total')}`} size="small" sx={{ bgcolor: 'primary.light', color: 'white' }} />
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog} sx={{ textTransform: 'none' }}>
            {t('customers.addCustomer')}
          </Button>
          <Button 
            variant="outlined" 
            color="error" 
            startIcon={<DeleteIcon />} 
            onClick={handleDeleteAllClick} 
            disabled={loading || pagination.total === 0}
            sx={{ textTransform: 'none' }}
          >
            {t('customers.deleteAll')}
          </Button>
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={fetchCustomers} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            placeholder={t('customers.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{t('common.status')}</InputLabel>
            <Select value={statusFilter} label={t('common.status')} onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="">{t('common.all')}</MenuItem>
              <MenuItem value="active">{t('customers.status.active')}</MenuItem>
              <MenuItem value="do_not_contact">{t('customers.status.doNotContact')}</MenuItem>
              <MenuItem value="blocked">{t('customers.status.blocked')}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'fullName'}
                    direction={sortBy === 'fullName' ? sortOrder : 'asc'}
                    onClick={() => handleSort('fullName')}
                  >
                    {t('customers.columns.name')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'email'}
                    direction={sortBy === 'email' ? sortOrder : 'asc'}
                    onClick={() => handleSort('email')}
                  >
                    {t('customers.columns.contact')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('customers.columns.externalRef')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('customers.columns.gender')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('customers.columns.dateOfBirth')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('customers.columns.religion')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'status'}
                    direction={sortBy === 'status' ? sortOrder : 'asc'}
                    onClick={() => handleSort('status')}
                  >
                    {t('customers.columns.status')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  <TableSortLabel
                    active={sortBy === 'isOverdue'}
                    direction={sortBy === 'isOverdue' ? sortOrder : 'asc'}
                    onClick={() => handleSort('isOverdue')}
                  >
                    {t('customers.columns.overdue')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  <TableSortLabel
                    active={sortBy === 'totalDebtAmount'}
                    direction={sortBy === 'totalDebtAmount' ? sortOrder : 'asc'}
                    onClick={() => handleSort('totalDebtAmount')}
                  >
                    {t('customers.columns.totalDebt')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  <TableSortLabel
                    active={sortBy === 'payments'}
                    direction={sortBy === 'payments' ? sortOrder : 'asc'}
                    onClick={() => handleSort('payments')}
                  >
                    {t('customers.columns.payments')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'createdAt'}
                    direction={sortBy === 'createdAt' ? sortOrder : 'asc'}
                    onClick={() => handleSort('createdAt')}
                  >
                    {t('customers.columns.created')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      {t('customers.loadingCustomers')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 8 }}>
                    <Typography variant="body1" color="text.secondary">{t('customers.noCustomers')}</Typography>
                    {(search || statusFilter) && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {t('customers.adjustFilters')}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell>
                      <Typography variant="body1" fontWeight={500}>{customer.fullName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {customer.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">{customer.email}</Typography>
                          </Box>
                        )}
                        {customer.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">{customer.phone}</Typography>
                          </Box>
                        )}
                        {!customer.email && !customer.phone && (
                          <Typography variant="body2" color="text.disabled">{t('customers.noContactInfo')}</Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{customer.externalRef || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{getGenderLabel(customer.gender)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{formatDateOfBirth(customer.dateOfBirth)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{customer.religion || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={getStatusLabel(customer.status)} color={statusColors[customer.status]} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      {customer.overdueDays > 0 ? (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'error.main',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5,
                          }}
                        >
                          <WarningIcon sx={{ fontSize: 16 }} />
                          {t('customers.columns.overdueDays', { days: customer.overdueDays })}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={customer.totalDebtAmount > 0 ? 600 : 400}
                        color={customer.totalDebtAmount > 0 ? 'error.main' : 'text.secondary'}
                      >
                        {customer.totalDebtAmount > 0
                          ? `₪${customer.totalDebtAmount.toLocaleString(language === 'he' ? 'he-IL' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '₪0.00'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={customer._count.payments}
                        size="small"
                        sx={{
                          bgcolor: customer._count.payments > 0 ? 'success.light' : 'grey.200',
                          color: customer._count.payments > 0 ? 'success.dark' : 'text.secondary',
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{formatDate(customer.createdAt)}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={t('common.actions')}>
                        <IconButton size="small" onClick={(e) => handleActionsClick(e, customer)}>
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page - 1}
          onPageChange={handleChangePage}
          rowsPerPage={pagination.limit}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage={t('common.rowsPerPage')}
        />
      </Paper>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleActionsClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleEditClick}>
          <ListItemIcon>
            <EditIcon fontSize="small" sx={{ color: '#1976d2' }} />
          </ListItemIcon>
          <ListItemText primary={t('actions.editCustomer')} />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => handleSendNotification('email')}
          disabled={!selectedCustomer?.email}
        >
          <ListItemIcon>
            <EmailIcon fontSize="small" sx={{ color: '#1976d2' }} />
          </ListItemIcon>
          <ListItemText primary={t('actions.sendEmailReminder')} secondary={!selectedCustomer?.email ? t('customers.noEmailAddress') : undefined} />
        </MenuItem>
        <MenuItem
          onClick={() => handleSendNotification('sms')}
          disabled={!selectedCustomer?.phone}
        >
          <ListItemIcon>
            <SmsIcon fontSize="small" sx={{ color: '#1976d2' }} />
          </ListItemIcon>
          <ListItemText primary={t('actions.sendSmsReminder')} secondary={!selectedCustomer?.phone ? t('customers.noPhoneNumber') : undefined} />
        </MenuItem>
        <MenuItem
          onClick={() => handleSendNotification('whatsapp')}
          disabled={!selectedCustomer?.phone}
        >
          <ListItemIcon>
            <WhatsAppIcon fontSize="small" sx={{ color: '#25D366' }} />
          </ListItemIcon>
          <ListItemText primary={t('actions.sendWhatsAppReminder')} secondary={!selectedCustomer?.phone ? t('customers.noPhoneNumber') : undefined} />
        </MenuItem>
        <MenuItem
          onClick={() => handleSendNotification('call_task')}
          disabled={!selectedCustomer?.phone}
        >
          <ListItemIcon>
            <CallIcon fontSize="small" sx={{ color: '#9c27b0' }} />
          </ListItemIcon>
          <ListItemText primary={t('actions.makeVoiceCallReminder')} secondary={!selectedCustomer?.phone ? t('customers.noPhoneNumber') : undefined} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary={t('customers.deleteCustomer')} />
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{t('dialogs.deleteCustomer.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('dialogs.deleteCustomer.message')} <strong>{selectedCustomer?.fullName}</strong>? {t('dialogs.deleteCustomer.warning')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">{t('common.cancel')}</Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
          >
            {deleting ? t('actions.deleting') : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={deleteAllDialogOpen} onClose={() => setDeleteAllDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon />
          {t('dialogs.deleteAllCustomers.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('dialogs.deleteAllCustomers.message', { count: pagination.total })}
          </DialogContentText>
          <Alert severity="error" sx={{ mt: 2 }}>
            {t('dialogs.deleteAllCustomers.warning')}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteAllDialogOpen(false)} color="inherit">{t('common.cancel')}</Button>
          <Button
            onClick={handleDeleteAllConfirm}
            variant="contained"
            color="error"
            disabled={deletingAll}
            startIcon={deletingAll ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
          >
            {deletingAll ? t('actions.deleting') : t('dialogs.deleteAllCustomers.confirmButton')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send Notification Dialog */}
      <Dialog open={notificationDialogOpen} onClose={() => setNotificationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
{t('dialogs.sendReminder.title', { type: notificationType === 'email' ? t('common.email') : notificationType === 'sms' ? t('common.sms') : notificationType === 'whatsapp' ? 'WhatsApp' : t('common.voiceCall') })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('dialogs.sendReminder.message')} <strong>{selectedCustomer?.fullName}</strong>?
          </DialogContentText>
          
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Language</InputLabel>
              <Select
                value={selectedLanguage}
                label="Language"
                onChange={(e) => setSelectedLanguage(e.target.value as 'en' | 'he' | 'ar')}
              >
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="he">Hebrew</MenuItem>
                <MenuItem value="ar">Arabic</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Tone</InputLabel>
              <Select
                value={selectedTone}
                label="Tone"
                onChange={(e) => setSelectedTone(e.target.value as 'calm' | 'medium' | 'heavy')}
              >
                <MenuItem value="calm">Calm</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="heavy">Heavy</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5', maxHeight: 300, overflow: 'auto' }}>
            <Typography variant="subtitle2" gutterBottom>{t('dialogs.sendReminder.preview')}</Typography>
            {loadingPreview ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
              </Box>
            ) : templatePreview ? (
              <Box>
                {templatePreview.subject && notificationType === 'email' && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>{t('forms.subject') || 'Subject'}:</strong> {templatePreview.subject}
                  </Typography>
                )}
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    bgcolor: 'white',
                    p: 1.5,
                    borderRadius: 1,
                    border: '1px solid #e0e0e0'
                  }}
                >
                  {templatePreview.bodyText}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('dialogs.sendReminder.toneInfo', { 
                  tone: selectedTone === 'calm' ? t('common.friendly') || 'friendly' : selectedTone === 'medium' ? t('common.firm') || 'firm' : t('common.urgent') || 'urgent',
                  language: selectedLanguage === 'en' ? 'English' : selectedLanguage === 'he' ? 'Hebrew' : 'Arabic'
                })}
              </Typography>
            )}
          </Paper>
          <Box sx={{ 
            mt: 2, 
            p: 2, 
            bgcolor: notificationType === 'email' ? '#e3f2fd' : notificationType === 'sms' ? '#e3f2fd' : notificationType === 'whatsapp' ? '#e8f5e9' : '#f3e5f5', 
            borderRadius: 1 
          }}>
            <Typography variant="body2">
              <strong>{t('dialogs.sendReminder.sendingTo')}</strong>{' '}
              <bdi>{notificationType === 'email' ? selectedCustomer?.email : selectedCustomer?.phone}</bdi>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setNotificationDialogOpen(false)} color="inherit">{t('common.cancel')}</Button>
          <Button
            onClick={handleSendNotificationConfirm}
            variant="contained"
            disabled={sendingNotification}
            startIcon={sendingNotification ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            sx={{
              bgcolor: notificationType === 'email' ? '#1976d2' : notificationType === 'sms' ? '#1976d2' : notificationType === 'whatsapp' ? '#25D366' : '#9c27b0',
              '&:hover': { 
                bgcolor: notificationType === 'email' ? '#1565c0' : notificationType === 'sms' ? '#1565c0' : notificationType === 'whatsapp' ? '#128C7E' : '#7b1fa2'
              },
            }}
          >
{sendingNotification ? t('actions.sending') : (
              notificationType === 'email' ? t('actions.sendEmail') : 
              notificationType === 'sms' ? t('actions.sendSms') : 
              notificationType === 'whatsapp' ? t('actions.sendWhatsApp') : 
              t('actions.makeVoiceCall')
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600}>{t('customers.newCustomer')}</Typography>
          <IconButton onClick={handleCloseDialog} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label={t('forms.fullName')}
              value={formData.fullName}
              onChange={handleFormChange('fullName')}
              error={!!formErrors.fullName}
              helperText={formErrors.fullName}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label={t('forms.email')}
              type="email"
              value={formData.email}
              onChange={handleFormChange('email')}
              error={!!formErrors.email}
              helperText={formErrors.email}
              fullWidth
            />
            <TextField label={t('forms.phone')} value={formData.phone} onChange={handleFormChange('phone')} fullWidth />
            <TextField
              label={t('forms.externalRef')}
              value={formData.externalRef}
              onChange={handleFormChange('externalRef')}
              fullWidth
              helperText={t('forms.externalRefHelper')}
            />
            <FormControl fullWidth>
              <InputLabel>{t('forms.status')}</InputLabel>
              <Select
                value={formData.status}
                label={t('forms.status')}
                onChange={(e) => handleFormChange('status')({ target: { value: e.target.value } })}
              >
                <MenuItem value="active">{t('customers.status.active')}</MenuItem>
                <MenuItem value="do_not_contact">{t('customers.status.doNotContact')}</MenuItem>
                <MenuItem value="blocked">{t('customers.status.blocked')}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">{t('common.cancel')}</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
          >
            {submitting ? t('actions.creating') : t('actions.createCustomer')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600}>{t('customers.editCustomer')}</Typography>
          <IconButton onClick={() => setEditDialogOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label={t('forms.fullName')}
              value={editFormData.fullName}
              onChange={handleEditFormChange('fullName')}
              error={!!editFormErrors.fullName}
              helperText={editFormErrors.fullName}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label={t('forms.email')}
              type="email"
              value={editFormData.email}
              onChange={handleEditFormChange('email')}
              error={!!editFormErrors.email}
              helperText={editFormErrors.email}
              fullWidth
            />
            <TextField label={t('forms.phone')} value={editFormData.phone} onChange={handleEditFormChange('phone')} fullWidth />
            <TextField
              label={t('forms.externalRef')}
              value={editFormData.externalRef}
              onChange={handleEditFormChange('externalRef')}
              fullWidth
              helperText={t('forms.externalRefHelper')}
            />
            <FormControl fullWidth>
              <InputLabel>{t('forms.status')}</InputLabel>
              <Select
                value={editFormData.status}
                label={t('forms.status')}
                onChange={(e) => handleEditFormChange('status')({ target: { value: e.target.value } })}
              >
                <MenuItem value="active">{t('customers.status.active')}</MenuItem>
                <MenuItem value="do_not_contact">{t('customers.status.doNotContact')}</MenuItem>
                <MenuItem value="blocked">{t('customers.status.blocked')}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} color="inherit">{t('common.cancel')}</Button>
          <Button
            onClick={handleEditSubmit}
            variant="contained"
            disabled={updating}
            startIcon={updating ? <CircularProgress size={18} color="inherit" /> : <EditIcon />}
          >
            {updating ? t('actions.updating') : t('actions.updateCustomer')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
