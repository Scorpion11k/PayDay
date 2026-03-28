import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
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
  Checkbox,
  Collapse,
} from '@mui/material';
import {
  AccountTree as BrainViewIcon,
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
  PlayCircleOutline as StartCollectionFlowIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
} from '@mui/icons-material';
import { useLanguage } from '../context/LanguageContext';
import BrainViewDialog from '../components/customers/BrainViewDialog';
import { useCustomersTableConfig } from '../hooks/useCustomersTableConfig';
import { COLUMN_DEFS } from '../components/customers/columnDefs';
import ColumnSettingsDialog from '../components/customers/ColumnSettingsDialog';
import { ViewColumn as ViewColumnIcon } from '@mui/icons-material';

interface CustomerProduct {
  id: string;
  name: string;
  price: number;
}

interface Customer {
  id: string;
  externalRef: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  dateOfBirth: string | null;
  region: string | null;
  religion: string | null;
  status: 'active' | 'do_not_contact' | 'blocked';
  preferredLanguage: 'en' | 'he' | 'ar' | null;
  preferredTone: 'calm' | 'medium' | 'heavy' | null;
  preferredChannel: 'sms' | 'email' | 'whatsapp' | 'call_task' | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    debts: number;
    payments: number;
  };
  totalDebtAmount: number;
  isOverdue: boolean;
  overdueDays: number;
  products?: CustomerProduct[];
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

interface CollectionFlowStartResponse {
  success?: boolean;
  data?: {
    triggered?: number;
    failed?: number;
    skipped?: number;
    details?: Array<{
      customerId: string;
      customerName: string | null;
      outcome: 'triggered' | 'failed' | 'skipped';
      currentStateName: string | null;
      error: string | null;
    }>;
  };
  message?: string;
  error?: string;
}

interface NewCustomerForm {
  fullName: string;
  email: string;
  phone: string;
  externalRef: string;
  status: 'active' | 'do_not_contact' | 'blocked';
  dateOfBirth: string;
  region: string;
  preferredChannel: 'sms' | 'email' | 'whatsapp' | 'call_task' | '';
  preferredLanguage: 'en' | 'he' | 'ar' | '';
  preferredTone: 'calm' | 'medium' | 'heavy' | '';
}

const initialFormState: NewCustomerForm = {
  fullName: '',
  email: '',
  phone: '',
  externalRef: '',
  status: 'active',
  dateOfBirth: '',
  region: '',
  preferredChannel: '',
  preferredLanguage: '',
  preferredTone: '',
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { config: tableConfig, updateConfig: updateTableConfig, getVisibleOrderedColumns, resetToDefaults: resetTableConfig } = useCustomersTableConfig();
  const visibleColumns = getVisibleOrderedColumns();
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: tableConfig.rowsPerPage,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') || '');
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
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    customer: Customer;
  } | null>(null);
  const [brainViewOpen, setBrainViewOpen] = useState(false);
  const [brainViewCustomer, setBrainViewCustomer] = useState<Customer | null>(null);

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

  // Bulk Selection & Send
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [excludedCustomerIds, setExcludedCustomerIds] = useState<Set<string>>(new Set());
  const [bulkSendDialogOpen, setBulkSendDialogOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [startingCollectionFlow, setStartingCollectionFlow] = useState(false);

  // Bulk Update Channel
  const [bulkChannelDialogOpen, setBulkChannelDialogOpen] = useState(false);
  const [bulkChannelValue, setBulkChannelValue] = useState<'sms' | 'email' | 'whatsapp' | 'call_task' | 'auto' | ''>('');
  const [bulkUpdatingChannel, setBulkUpdatingChannel] = useState(false);

  // Voice Call History Dialog
  const [callHistoryDialogOpen, setCallHistoryDialogOpen] = useState(false);
  const [callHistoryLoading, setCallHistoryLoading] = useState(false);
  const [callHistoryData, setCallHistoryData] = useState<Array<{
    id: string;
    phone: string;
    messageText: string;
    description: string | null;
    status: string;
    statusCode: number | null;
    statusMessage: string | null;
    kolKasherCallId: string | null;
    errorMessage: string | null;
    duration: number | null;
    retries: number;
    createdAt: string;
  }>>([]);
  const [callHistoryPagination, setCallHistoryPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const queueCustomerIds = useMemo(
    () =>
      (searchParams.get('queueCustomerIds') || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    [searchParams]
  );
  const appliedQueue = useMemo(
    () =>
      queueCustomerIds.length > 0
        ? {
            id: searchParams.get('queueId') || '',
            title: searchParams.get('queueTitle') || 'Queue',
            priority: searchParams.get('queuePriority') || 'medium',
            description: searchParams.get('queueDescription') || '',
            count: Number(searchParams.get('queueCount') || queueCustomerIds.length),
          }
        : null,
    [queueCustomerIds, searchParams]
  );

  // Status labels with translations
  const getStatusLabel = (status: Customer['status']): string => {
    const labels: Record<Customer['status'], string> = {
      active: t('customers.status.active'),
      do_not_contact: t('customers.status.doNotContact'),
      blocked: t('customers.status.blocked'),
    };
    return labels[status];
  };


  // Get channel icon and label
  const getChannelChip = (channel: Customer['preferredChannel']) => {
    if (!channel) return null;
    const channelConfig: Record<NonNullable<Customer['preferredChannel']>, { label: string; color: 'primary' | 'success' | 'warning' | 'secondary'; icon: React.ReactElement }> = {
      email: { label: t('common.email'), color: 'primary', icon: <EmailIcon sx={{ fontSize: 16 }} /> },
      sms: { label: 'SMS', color: 'warning', icon: <SmsIcon sx={{ fontSize: 16 }} /> },
      whatsapp: { label: 'WhatsApp', color: 'success', icon: <WhatsAppIcon sx={{ fontSize: 16 }} /> },
      call_task: { label: t('common.voiceCall'), color: 'secondary', icon: <CallIcon sx={{ fontSize: 16 }} /> },
    };
    const config = channelConfig[channel];
    return <Chip size="small" icon={config.icon} label={config.label} color={config.color} variant="outlined" />;
  };

  // Get language chip
  const getLanguageChip = (lang: Customer['preferredLanguage']) => {
    if (!lang) return null;
    const langLabels: Record<NonNullable<Customer['preferredLanguage']>, string> = {
      en: 'EN',
      he: 'HE',
      ar: 'AR',
    };
    return <Chip size="small" label={langLabels[lang]} variant="outlined" sx={{ minWidth: 40 }} />;
  };

  const clearSelection = useCallback(() => {
    setSelectedCustomerIds(new Set());
    setSelectAllMode(false);
    setExcludedCustomerIds(new Set());
  }, []);

  const isCustomerSelected = useCallback((customerId: string) => {
    return selectAllMode ? !excludedCustomerIds.has(customerId) : selectedCustomerIds.has(customerId);
  }, [excludedCustomerIds, selectAllMode, selectedCustomerIds]);

  const selectedCount = selectAllMode
    ? Math.max(pagination.total - excludedCustomerIds.size, 0)
    : selectedCustomerIds.size;
  const bulkUpdateCount = selectAllMode ? 0 : selectedCustomerIds.size;

  const areAllOnPageSelected = customers.length > 0 && customers.every((c) => isCustomerSelected(c.id));
  const areSomeOnPageSelected = customers.some((c) => isCustomerSelected(c.id)) && !areAllOnPageSelected;

  // Bulk selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (selectAllMode) {
      setExcludedCustomerIds(prev => {
        const next = new Set(prev);
        if (event.target.checked) {
          customers.forEach(c => next.delete(c.id));
        } else {
          customers.forEach(c => next.add(c.id));
        }
        return next;
      });
      return;
    }
    setSelectedCustomerIds(event.target.checked ? new Set(customers.map(c => c.id)) : new Set());
  };

  const handleSelectCustomer = (customerId: string) => {
    if (selectAllMode) {
      setExcludedCustomerIds(prev => {
        const next = new Set(prev);
        if (next.has(customerId)) {
          next.delete(customerId);
        } else {
          next.add(customerId);
        }
        return next;
      });
      return;
    }
    setSelectedCustomerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const handleSelectAllAcrossPages = () => {
    setSelectAllMode(true);
    setExcludedCustomerIds(new Set());
    setSelectedCustomerIds(new Set());
  };

  const buildCollectionFlowSelectionPayload = () => (
    selectAllMode
      ? {
          selectAll: true,
          excludedCustomerIds: Array.from(excludedCustomerIds),
          filters: {
            search: searchDebounce || undefined,
            status: statusFilter || undefined,
          },
        }
      : { customerIds: Array.from(selectedCustomerIds) }
  );

  const handleStartCollectionFlow = async () => {
    if (selectedCount === 0 || startingCollectionFlow) return;

    setStartingCollectionFlow(true);
    try {
      const response = await fetch(`${API_BASE_URL}/customers/collection-flow/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCollectionFlowSelectionPayload()),
      });

      const data: CollectionFlowStartResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to start collection flow');
      }

      const triggered = data.data?.triggered || 0;
      const failed = data.data?.failed || 0;
      const skipped = data.data?.skipped || 0;

      setSnackbar({
        open: true,
        message:
          failed > 0 || skipped > 0
            ? `Collection flow triggered for ${triggered} customers. Failed: ${failed}, Skipped: ${skipped}`
            : `Collection flow triggered for ${triggered} customers.`,
        severity: failed > 0 ? 'info' : 'success',
      });
      clearSelection();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to start collection flow',
        severity: 'error',
      });
    } finally {
      setStartingCollectionFlow(false);
    }
  };

  const handleStartCollectionFlowForCustomer = async (customer: Customer | null | undefined) => {
    if (!customer || startingCollectionFlow) return;

    handleActionsClose();
    handleContextMenuClose();
    setStartingCollectionFlow(true);

    try {
      const response = await fetch(`${API_BASE_URL}/customers/${customer.id}/collection-flow/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data: CollectionFlowStartResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `Failed to start collection flow for ${customer.fullName}`);
      }

      const detail = data.data?.details?.find((item) => item.customerId === customer.id);
      const detailError = detail?.error?.trim();
      const currentStateName = detail?.currentStateName?.trim();

      const message = detail?.outcome === 'failed'
        ? `Collection flow failed for ${customer.fullName}${detailError ? `: ${detailError}` : ''}`
        : detail?.outcome === 'skipped'
          ? `Collection flow skipped for ${customer.fullName}${detailError ? `: ${detailError}` : ''}`
          : `Collection flow triggered for ${customer.fullName}${currentStateName ? `. Current state: ${currentStateName}` : ''}`;

      setSnackbar({
        open: true,
        message,
        severity: detail?.outcome === 'failed' ? 'info' : 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : `Failed to start collection flow for ${customer.fullName}`,
        severity: 'error',
      });
    } finally {
      setStartingCollectionFlow(false);
    }
  };

  // Handle bulk send
  const handleBulkSend = async () => {
    if (selectedCount === 0) return;
    
    setBulkSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/messaging/bulk-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(selectAllMode
            ? {
                selectAll: true,
                excludedCustomerIds: Array.from(excludedCustomerIds),
                filters: {
                  search: searchDebounce || undefined,
                  status: statusFilter || undefined,
                },
              }
            : { customerIds: Array.from(selectedCustomerIds) }),
          templateKey: 'debt_reminder',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('notifications.error.sendNotification'));
      }

      setSnackbar({
        open: true,
        message: t('bulkSend.completed', { 
          sent: data.data.sent, 
          failed: data.data.failed, 
          skipped: data.data.skipped 
        }),
        severity: 'success',
      });
      setBulkSendDialogOpen(false);
      clearSelection();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : t('notifications.error.sendNotification'),
        severity: 'error',
      });
    } finally {
      setBulkSending(false);
    }
  };

  // Handle bulk update channel
  const handleBulkUpdateChannel = async () => {
    if (selectedCustomerIds.size === 0 || !bulkChannelValue || selectAllMode) return;
    
    setBulkUpdatingChannel(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/customers/bulk-update-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerIds: Array.from(selectedCustomerIds),
          preferredChannel: bulkChannelValue,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('common.error'));
      }

      const successCount = data.data?.updated || 0;
      const failCount = data.data?.failed || 0;

      setSnackbar({
        open: true,
        message: t('bulkUpdateChannel.completed', { success: successCount, failed: failCount }),
        severity: failCount === 0 ? 'success' : 'info',
      });
      setBulkChannelDialogOpen(false);
      setBulkChannelValue('');
      clearSelection();
      fetchCustomers(); // Refresh the list
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : t('common.error'),
        severity: 'error',
      });
    } finally {
      setBulkUpdatingChannel(false);
    }
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

      if (queueCustomerIds.length > 0) {
        params.set('customerIds', queueCustomerIds.join(','));
      }

      if (sortBy) {
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
      }

      const response = await fetch(`${API_BASE_URL}/customers?${params}`);
      
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
  }, [pagination.page, pagination.limit, queueCustomerIds, searchDebounce, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    clearSelection();
  }, [queueCustomerIds, searchDebounce, statusFilter]);

  const clearQueueFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('queueId');
    next.delete('queueTitle');
    next.delete('queuePriority');
    next.delete('queueDescription');
    next.delete('queueCount');
    next.delete('queueCustomerIds');
    setSearchParams(next);
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage + 1 }));
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    setPagination((prev) => ({
      ...prev,
      limit: newLimit,
      page: 1,
    }));
    updateTableConfig({ rowsPerPage: newLimit });
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
      if (formData.dateOfBirth) payload.dateOfBirth = formData.dateOfBirth;
      if (formData.region.trim()) payload.region = formData.region.trim();
      if (formData.preferredChannel) payload.preferredChannel = formData.preferredChannel;
      if (formData.preferredLanguage) payload.preferredLanguage = formData.preferredLanguage;
      if (formData.preferredTone) payload.preferredTone = formData.preferredTone;

      const response = await fetch(`${API_BASE_URL}/customers`, {
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
    setContextMenu(null);
    setAnchorEl(event.currentTarget);
    setSelectedCustomer(customer);
  };

  const handleActionsClose = () => {
    setAnchorEl(null);
  };

  const toggleExpandRow = (customerId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const handleRowContextMenu = (event: React.MouseEvent<HTMLTableRowElement>, customer: Customer) => {
    event.preventDefault();
    setAnchorEl(null);
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      customer,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleOpenBrainView = (customer: Customer | null | undefined) => {
    if (!customer) return;
    setBrainViewCustomer(customer);
    setBrainViewOpen(true);
    setContextMenu(null);
    setAnchorEl(null);
  };

  const handleCloseBrainView = () => {
    setBrainViewOpen(false);
    setBrainViewCustomer(null);
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
      const response = await fetch(`${API_BASE_URL}/customers/${selectedCustomer.id}`, {
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
      const response = await fetch(`${API_BASE_URL}/customers/all`, {
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
        dateOfBirth: selectedCustomer.dateOfBirth ? selectedCustomer.dateOfBirth.split('T')[0] : '',
        region: selectedCustomer.region || '',
        preferredChannel: selectedCustomer.preferredChannel || '',
        preferredLanguage: selectedCustomer.preferredLanguage || '',
        preferredTone: selectedCustomer.preferredTone || '',
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
      payload.dateOfBirth = editFormData.dateOfBirth || null;
      payload.region = editFormData.region.trim() || null;
      payload.preferredChannel = editFormData.preferredChannel || null;
      payload.preferredLanguage = editFormData.preferredLanguage || null;
      payload.preferredTone = editFormData.preferredTone || null;

      const response = await fetch(`${API_BASE_URL}/customers/${selectedCustomer.id}`, {
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
      const response = await fetch(`${API_BASE_URL}/messaging/preview-reminder`, {
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

  const fetchCallHistory = useCallback(async (customerId: string, page = 1) => {
    setCallHistoryLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/voice/kol-kasher/history/${customerId}?page=${page}&limit=10`);
      const result = await response.json();
      if (result.success) {
        setCallHistoryData(result.data);
        setCallHistoryPagination({ page: result.pagination.page, total: result.pagination.total, totalPages: result.pagination.totalPages });
      }
    } catch {
      setCallHistoryData([]);
    } finally {
      setCallHistoryLoading(false);
    }
  }, []);

  const handleOpenCallHistory = () => {
    handleActionsClose();
    if (selectedCustomer) {
      setCallHistoryDialogOpen(true);
      fetchCallHistory(selectedCustomer.id);
    }
  };

  const handleSendNotification = (type: 'email' | 'whatsapp' | 'sms' | 'call_task') => {
    handleActionsClose();
    setNotificationType(type);
    
    // Use customer preferences as defaults instead of hardcoded values
    const defaultLanguage = selectedCustomer?.preferredLanguage || 'he';
    const defaultTone = selectedCustomer?.preferredTone || 'calm';
    
    setSelectedLanguage(defaultLanguage);
    setSelectedTone(defaultTone);
    setTemplatePreview(null);
    setNotificationDialogOpen(true);
    
    // Fetch preview for the selected customer with their preferences
    if (selectedCustomer) {
      fetchTemplatePreview(selectedCustomer.id, type, defaultLanguage, defaultTone);
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
      const response = await fetch(`${API_BASE_URL}/messaging/send-reminder`, {
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
          {bulkUpdateCount > 0 && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<EditIcon />}
              onClick={() => setBulkChannelDialogOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              {t('bulkUpdateChannel.updateChannel', { count: bulkUpdateCount })}
            </Button>
          )}
          {selectedCount > 0 && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={startingCollectionFlow ? <CircularProgress size={18} color="inherit" /> : <StartCollectionFlowIcon />}
              onClick={handleStartCollectionFlow}
              disabled={startingCollectionFlow}
              sx={{ textTransform: 'none' }}
            >
              Start Collection Flow
            </Button>
          )}
          {selectedCount > 0 && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<SendIcon />}
              onClick={() => setBulkSendDialogOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              {t('bulkSend.sendToSelected', { count: selectedCount })}
            </Button>
          )}
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
          <Tooltip title={t('customers.tableSettings.title')}>
            <IconButton onClick={() => setColumnSettingsOpen(true)}>
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {appliedQueue && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={clearQueueFilter}>
              {t('customers.bulkSelection.clear')}
            </Button>
          }
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Queue applied: {appliedQueue.title}
            </Typography>
            <Chip size="small" label={appliedQueue.priority} />
            <Typography variant="body2" color="text.secondary">
              {appliedQueue.count} customers
            </Typography>
          </Stack>
        </Alert>
      )}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Selection Summary */}
      {customers.length > 0 && (selectedCount > 0 || areAllOnPageSelected) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Typography variant="body2">
              {selectAllMode
                ? t('customers.bulkSelection.allSelected', { count: selectedCount })
                : t('customers.bulkSelection.selectedOnPage', { count: selectedCustomerIds.size })}
            </Typography>
            <Stack direction="row" spacing={1}>
              {!selectAllMode && areAllOnPageSelected && pagination.total > customers.length && (
                <Button size="small" onClick={handleSelectAllAcrossPages}>
                  {t('customers.bulkSelection.selectAll', { count: pagination.total })}
                </Button>
              )}
              {selectedCount > 0 && (
                <Button size="small" onClick={clearSelection}>
                  {t('customers.bulkSelection.clear')}
                </Button>
              )}
            </Stack>
          </Stack>
        </Alert>
      )}

      {/* Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={areAllOnPageSelected}
                    indeterminate={areSomeOnPageSelected}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                {visibleColumns.map((col) => (
                  <React.Fragment key={col.id}>
                    {col.renderHeader({ t, sortBy, sortOrder, onSort: handleSort })}
                  </React.Fragment>
                ))}
                <TableCell sx={{ fontWeight: 600 }} align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      {t('customers.loadingCustomers')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} align="center" sx={{ py: 8 }}>
                    <Typography variant="body1" color="text.secondary">{t('customers.noCustomers')}</Typography>
                    {(search || statusFilter) && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {t('customers.adjustFilters')}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => {
                  const hasProducts = (customer.products?.length ?? 0) > 0;
                  const isExpanded = expandedRows.has(customer.id);
                  return (
                    <React.Fragment key={customer.id}>
                      <TableRow 
                        hover 
                        onContextMenu={(event) => handleRowContextMenu(event, customer)}
                        sx={{ 
                          '&:last-child td': { border: 0 },
                          bgcolor: isCustomerSelected(customer.id) ? 'action.selected' : 'inherit',
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {hasProducts ? (
                              <IconButton size="small" onClick={() => toggleExpandRow(customer.id)} sx={{ mr: 0.5 }}>
                                {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              </IconButton>
                            ) : (
                              <Box sx={{ width: 34, mr: 0.5 }} />
                            )}
                            <Checkbox
                              checked={isCustomerSelected(customer.id)}
                              onChange={() => handleSelectCustomer(customer.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Box>
                        </TableCell>
                        {visibleColumns.map((col) => (
                          <React.Fragment key={col.id}>
                            {col.renderCell({ customer, t, language })}
                          </React.Fragment>
                        ))}
                        <TableCell align="center">
                          <Tooltip title={t('common.actions')}>
                            <IconButton size="small" onClick={(e) => handleActionsClick(e, customer)}>
                              <MoreVertIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                      {hasProducts && (
                        <TableRow>
                          <TableCell sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }} colSpan={visibleColumns.length + 2}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 1.5, px: 2 }}>
                                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                                  {t('customers.products.title')}
                                </Typography>
                                <Table size="small" sx={{ maxWidth: 400 }}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600 }}>{t('customers.products.name')}</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">{t('customers.products.price')}</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {customer.products!.map((product) => (
                                      <TableRow key={product.id}>
                                        <TableCell>{product.name}</TableCell>
                                        <TableCell align="right">
                                          {`₪${Number(product.price).toLocaleString(language === 'he' ? 'he-IL' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
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

      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => void handleStartCollectionFlowForCustomer(contextMenu?.customer)}
          disabled={startingCollectionFlow}
        >
          <ListItemIcon>
            {startingCollectionFlow ? (
              <CircularProgress size={18} />
            ) : (
              <StartCollectionFlowIcon fontSize="small" sx={{ color: '#6a1b9a' }} />
            )}
          </ListItemIcon>
          <ListItemText primary="Start Collection Flow" />
        </MenuItem>
        <MenuItem onClick={() => handleOpenBrainView(contextMenu?.customer)}>
          <ListItemIcon>
            <BrainViewIcon fontSize="small" sx={{ color: '#1565c0' }} />
          </ListItemIcon>
          <ListItemText primary="Open Brain View" />
        </MenuItem>
      </Menu>

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
        <MenuItem
          onClick={() => void handleStartCollectionFlowForCustomer(selectedCustomer)}
          disabled={startingCollectionFlow}
        >
          <ListItemIcon>
            {startingCollectionFlow ? (
              <CircularProgress size={18} />
            ) : (
              <StartCollectionFlowIcon fontSize="small" sx={{ color: '#6a1b9a' }} />
            )}
          </ListItemIcon>
          <ListItemText primary="Start Collection Flow" />
        </MenuItem>
        <MenuItem onClick={() => handleOpenBrainView(selectedCustomer)}>
          <ListItemIcon>
            <BrainViewIcon fontSize="small" sx={{ color: '#1565c0' }} />
          </ListItemIcon>
          <ListItemText primary="Brain View" />
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
        <MenuItem
          onClick={handleOpenCallHistory}
          disabled={!selectedCustomer?.phone}
        >
          <ListItemIcon>
            <PhoneIcon fontSize="small" sx={{ color: '#1B5E20' }} />
          </ListItemIcon>
          <ListItemText primary="Voice Call History" secondary={!selectedCustomer?.phone ? t('customers.noPhoneNumber') : undefined} />
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
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('customers.columns.dateOfBirth')}
                type="date"
                value={formData.dateOfBirth}
                onChange={handleFormChange('dateOfBirth')}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label={t('customers.region')}
                value={formData.region}
                onChange={handleFormChange('region')}
                fullWidth
              />
            </Stack>
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
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">{t('customers.communicationPreferences')}</Typography>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>{t('customers.preferredChannel')}</InputLabel>
                <Select
                  value={formData.preferredChannel}
                  label={t('customers.preferredChannel')}
                  onChange={(e) => handleFormChange('preferredChannel')({ target: { value: e.target.value } })}
                >
                  <MenuItem value="">{t('common.auto')}</MenuItem>
                  <MenuItem value="email">{t('common.email')}</MenuItem>
                  <MenuItem value="sms">SMS</MenuItem>
                  <MenuItem value="whatsapp">WhatsApp</MenuItem>
                  <MenuItem value="call_task">{t('common.voiceCall')}</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>{t('customers.preferredLanguage')}</InputLabel>
                <Select
                  value={formData.preferredLanguage}
                  label={t('customers.preferredLanguage')}
                  onChange={(e) => handleFormChange('preferredLanguage')({ target: { value: e.target.value } })}
                >
                  <MenuItem value="">{t('common.auto')}</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="he">עברית</MenuItem>
                  <MenuItem value="ar">العربية</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>{t('customers.preferredTone')}</InputLabel>
                <Select
                  value={formData.preferredTone}
                  label={t('customers.preferredTone')}
                  onChange={(e) => handleFormChange('preferredTone')({ target: { value: e.target.value } })}
                >
                  <MenuItem value="">{t('common.auto')}</MenuItem>
                  <MenuItem value="calm">{t('common.friendly')}</MenuItem>
                  <MenuItem value="medium">{t('common.firm')}</MenuItem>
                  <MenuItem value="heavy">{t('common.urgent')}</MenuItem>
                </Select>
              </FormControl>
            </Stack>
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
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('customers.columns.dateOfBirth')}
                type="date"
                value={editFormData.dateOfBirth}
                onChange={handleEditFormChange('dateOfBirth')}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label={t('customers.region')}
                value={editFormData.region}
                onChange={handleEditFormChange('region')}
                fullWidth
              />
            </Stack>
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
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">{t('customers.communicationPreferences')}</Typography>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>{t('customers.preferredChannel')}</InputLabel>
                <Select
                  value={editFormData.preferredChannel}
                  label={t('customers.preferredChannel')}
                  onChange={(e) => handleEditFormChange('preferredChannel')({ target: { value: e.target.value } })}
                >
                  <MenuItem value="">{t('common.auto')}</MenuItem>
                  <MenuItem value="email">{t('common.email')}</MenuItem>
                  <MenuItem value="sms">SMS</MenuItem>
                  <MenuItem value="whatsapp">WhatsApp</MenuItem>
                  <MenuItem value="call_task">{t('common.voiceCall')}</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>{t('customers.preferredLanguage')}</InputLabel>
                <Select
                  value={editFormData.preferredLanguage}
                  label={t('customers.preferredLanguage')}
                  onChange={(e) => handleEditFormChange('preferredLanguage')({ target: { value: e.target.value } })}
                >
                  <MenuItem value="">{t('common.auto')}</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="he">עברית</MenuItem>
                  <MenuItem value="ar">العربية</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>{t('customers.preferredTone')}</InputLabel>
                <Select
                  value={editFormData.preferredTone}
                  label={t('customers.preferredTone')}
                  onChange={(e) => handleEditFormChange('preferredTone')({ target: { value: e.target.value } })}
                >
                  <MenuItem value="">{t('common.auto')}</MenuItem>
                  <MenuItem value="calm">{t('common.friendly')}</MenuItem>
                  <MenuItem value="medium">{t('common.firm')}</MenuItem>
                  <MenuItem value="heavy">{t('common.urgent')}</MenuItem>
                </Select>
              </FormControl>
            </Stack>
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

      {/* Bulk Send Dialog */}
      <Dialog open={bulkSendDialogOpen} onClose={() => setBulkSendDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {t('bulkSend.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('bulkSend.confirmMessage', { count: selectedCount })}
          </DialogContentText>
          
          {/* Channel breakdown */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>{t('bulkSend.channelBreakdown')}</Typography>
            <Stack spacing={1}>
              {(() => {
                const selected = customers.filter(c => isCustomerSelected(c.id));
                const isPagePreview = selectAllMode && pagination.total > customers.length;
                const breakdown = {
                  email: selected.filter(c => (c.preferredChannel || 'email') === 'email'),
                  sms: selected.filter(c => c.preferredChannel === 'sms'),
                  whatsapp: selected.filter(c => c.preferredChannel === 'whatsapp'),
                };
                const items = Object.entries(breakdown).filter(([_, list]) => list.length > 0).map(([channel, list]) => (
                  <Box key={channel} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">
                      {channel === 'email' ? t('common.email') : channel === 'sms' ? 'SMS' : 'WhatsApp'}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip 
                        size="small" 
                        label={`${list.filter(c => channel === 'email' ? c.email : c.phone).length} ${t('bulkSend.eligible')}`}
                        color="success"
                        variant="outlined"
                      />
                      {list.filter(c => !(channel === 'email' ? c.email : c.phone)).length > 0 && (
                        <Chip 
                          size="small" 
                          label={`${list.filter(c => !(channel === 'email' ? c.email : c.phone)).length} ${t('bulkSend.skipped')}`}
                          color="warning"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </Box>
                ));
                if (isPagePreview) {
                  items.push(
                    <Typography key="bulk-preview-note" variant="caption" color="text.secondary">
                      {t('bulkSend.breakdownNote')}
                    </Typography>
                  );
                }
                return items;
              })()}
            </Stack>
          </Paper>

          {/* Language breakdown */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>{t('bulkSend.languageBreakdown')}</Typography>
            <Stack direction="row" spacing={1}>
              {(() => {
                const selected = customers.filter(c => isCustomerSelected(c.id));
                const isPagePreview = selectAllMode && pagination.total > customers.length;
                const langBreakdown = {
                  he: selected.filter(c => (c.preferredLanguage || 'he') === 'he').length,
                  en: selected.filter(c => c.preferredLanguage === 'en').length,
                  ar: selected.filter(c => c.preferredLanguage === 'ar').length,
                };
                const items = Object.entries(langBreakdown).filter(([_, count]) => count > 0).map(([lang, count]) => (
                  <Chip 
                    key={lang} 
                    size="small" 
                    label={`${lang === 'he' ? 'עברית' : lang === 'en' ? 'English' : 'العربية'}: ${count}`}
                    variant="outlined"
                  />
                ));
                if (isPagePreview) {
                  items.push(
                    <Typography key="bulk-preview-note-lang" variant="caption" color="text.secondary">
                      {t('bulkSend.breakdownNote')}
                    </Typography>
                  );
                }
                return items;
              })()}
            </Stack>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setBulkSendDialogOpen(false)} color="inherit">{t('common.cancel')}</Button>
          <Button
            onClick={handleBulkSend}
            variant="contained"
            disabled={bulkSending}
            startIcon={bulkSending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
          >
            {bulkSending ? t('bulkSend.sending') : t('bulkSend.send')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Update Channel Dialog */}
      <Dialog 
        open={bulkChannelDialogOpen} 
        onClose={() => !bulkUpdatingChannel && setBulkChannelDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon color="secondary" />
          {t('bulkUpdateChannel.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            {t('bulkUpdateChannel.description', { count: bulkUpdateCount })}
          </DialogContentText>
          <FormControl fullWidth>
            <InputLabel>{t('customers.preferredChannel')}</InputLabel>
            <Select
              value={bulkChannelValue}
              label={t('customers.preferredChannel')}
              onChange={(e) => setBulkChannelValue(e.target.value as typeof bulkChannelValue)}
            >
              <MenuItem value="auto">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <span>{t('common.auto')}</span>
                </Stack>
              </MenuItem>
              <MenuItem value="email">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <EmailIcon fontSize="small" />
                  <span>{t('common.email')}</span>
                </Stack>
              </MenuItem>
              <MenuItem value="sms">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <SmsIcon fontSize="small" />
                  <span>SMS</span>
                </Stack>
              </MenuItem>
              <MenuItem value="whatsapp">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <WhatsAppIcon fontSize="small" />
                  <span>WhatsApp</span>
                </Stack>
              </MenuItem>
              <MenuItem value="call_task">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CallIcon fontSize="small" />
                  <span>{t('common.voiceCall')}</span>
                </Stack>
              </MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={() => {
              setBulkChannelDialogOpen(false);
              setBulkChannelValue('');
            }} 
            color="inherit"
            disabled={bulkUpdatingChannel}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleBulkUpdateChannel}
            variant="contained"
            color="secondary"
            disabled={bulkUpdatingChannel || !bulkChannelValue}
            startIcon={bulkUpdatingChannel ? <CircularProgress size={18} color="inherit" /> : <EditIcon />}
          >
            {bulkUpdatingChannel ? t('bulkUpdateChannel.updating') : t('bulkUpdateChannel.update')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Voice Call History Dialog */}
      <Dialog
        open={callHistoryDialogOpen}
        onClose={() => setCallHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CallIcon sx={{ color: '#1B5E20' }} />
          Voice Call History — {selectedCustomer?.fullName}
          <IconButton
            onClick={() => setCallHistoryDialogOpen(false)}
            sx={{ marginLeft: 'auto' }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {callHistoryLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : callHistoryData.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>No voice call history found for this customer.</Alert>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Message</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Error</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {callHistoryData.map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>{log.phone}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={log.status}
                            color={
                              log.status === 'completed' || log.status === 'delivered' || log.status === 'sent'
                                ? 'success'
                                : log.status === 'sending' || log.status === 'pending'
                                  ? 'warning'
                                  : 'error'
                            }
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={log.messageText}>
                            <span>{log.messageText}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {log.duration ? `${log.duration}s` : '—'}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.errorMessage ? (
                            <Tooltip title={log.errorMessage}>
                              <Chip size="small" label={log.errorMessage} color="error" variant="outlined" />
                            </Tooltip>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {callHistoryPagination.totalPages > 1 && (
                <TablePagination
                  component="div"
                  count={callHistoryPagination.total}
                  page={callHistoryPagination.page - 1}
                  rowsPerPage={10}
                  rowsPerPageOptions={[10]}
                  onPageChange={(_e, newPage) => {
                    if (selectedCustomer) fetchCallHistory(selectedCustomer.id, newPage + 1);
                  }}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <BrainViewDialog
        open={brainViewOpen}
        customer={brainViewCustomer}
        language={language}
        onClose={handleCloseBrainView}
      />

      <ColumnSettingsDialog
        open={columnSettingsOpen}
        onClose={() => setColumnSettingsOpen(false)}
        config={tableConfig}
        onSave={(newConfig) => {
          updateTableConfig(newConfig);
          setPagination((prev) => ({ ...prev, limit: newConfig.rowsPerPage ?? prev.limit, page: 1 }));
        }}
        onReset={resetTableConfig}
      />

      {/* Success/Error Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
