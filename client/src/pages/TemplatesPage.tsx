import { useState, useEffect, useCallback } from 'react';
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
  Snackbar,
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import {
  Article as TemplatesIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
  Archive as ArchiveIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  WhatsApp as WhatsAppIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';

interface Template {
  id: string;
  key: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'call_task';
  language: 'en' | 'he' | 'ar';
  tone: 'calm' | 'medium' | 'heavy';
  name: string;
  description: string | null;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string;
  placeholders: string[];
  status: 'draft' | 'active' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const channelIcons: Record<string, React.ReactNode> = {
  email: <EmailIcon fontSize="small" />,
  sms: <SmsIcon fontSize="small" />,
  whatsapp: <WhatsAppIcon fontSize="small" />,
  call_task: <PhoneIcon fontSize="small" />,
};

const channelLabels: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  call_task: 'Voice',
};

const languageLabels: Record<string, string> = {
  en: 'English',
  he: 'Hebrew',
  ar: 'Arabic',
};

const toneLabels: Record<string, string> = {
  calm: 'Calm',
  medium: 'Medium',
  heavy: 'Heavy',
};

const toneColors: Record<string, 'success' | 'warning' | 'error'> = {
  calm: 'success',
  medium: 'warning',
  heavy: 'error',
};

const statusColors: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  draft: 'warning',
  archived: 'default',
};

const placeholderList = [
  'CustomerName', 'CompanyName', 'Amount', 'Currency', 'InvoiceNumber',
  'DueDate', 'DaysOverdue', 'PaymentLink', 'SupportPhone', 'SupportEmail',
  'BusinessHours', 'CaseId', 'UnsubscribeText'
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [languageFilter, setLanguageFilter] = useState<string>('');
  const [toneFilter, setToneFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [previewData, setPreviewData] = useState<{ subject?: string; bodyHtml?: string; bodyText: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Template>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [previewTab, setPreviewTab] = useState(0);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (channelFilter) params.set('channel', channelFilter);
      if (languageFilter) params.set('language', languageFilter);
      if (toneFilter) params.set('tone', toneFilter);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/templates?${params}`);
      const data = await response.json();

      if (data.success) {
        let filteredTemplates = data.data;
        if (search) {
          const searchLower = search.toLowerCase();
          filteredTemplates = filteredTemplates.filter((t: Template) =>
            t.name.toLowerCase().includes(searchLower) ||
            t.key.toLowerCase().includes(searchLower)
          );
        }
        setTemplates(filteredTemplates);
        setPagination(data.pagination);
      } else {
        throw new Error('Failed to fetch templates');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, channelFilter, languageFilter, toneFilter, statusFilter, search]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

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

  const handleEditClick = async (template: Template) => {
    // Fetch full template data
    try {
      const response = await fetch(`/api/templates/${template.id}`);
      const data = await response.json();
      if (data.success) {
        setSelectedTemplate(data.data);
        setFormData(data.data);
        setEditDialogOpen(true);
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load template', severity: 'error' });
    }
  };

  const handlePreviewClick = async (template: Template) => {
    setSelectedTemplate(template);
    setPreviewLoading(true);
    setPreviewDialogOpen(true);

    try {
      const response = await fetch(`/api/templates/${template.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (data.success) {
        setPreviewData(data.data);
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load preview', severity: 'error' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleArchiveClick = async (template: Template) => {
    if (!confirm(`Archive template "${template.name}"?`)) return;

    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setSnackbar({ open: true, message: 'Template archived', severity: 'success' });
        fetchTemplates();
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to archive template', severity: 'error' });
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const insertText = `{${placeholder}}`;
    handleFormChange('bodyText', (formData.bodyText || '') + insertText);
  };

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.bodyText) errors.bodyText = 'Body text is required';
    if (formData.channel === 'email' && !formData.subject) {
      errors.subject = 'Subject is required for email';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/templates/${selectedTemplate?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          subject: formData.subject,
          bodyHtml: formData.bodyHtml,
          bodyText: formData.bodyText,
          status: formData.status,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSnackbar({ open: true, message: 'Template updated successfully', severity: 'success' });
        setEditDialogOpen(false);
        fetchTemplates();
      } else {
        throw new Error(data.message || 'Failed to update template');
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to update template',
        severity: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TemplatesIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
            Message Templates
          </Typography>
          {!loading && (
            <Chip label={`${pagination.total} templates`} size="small" sx={{ bgcolor: 'primary.light', color: 'white' }} />
          )}
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchTemplates} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            placeholder="Search by name or key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Channel</InputLabel>
            <Select value={channelFilter} label="Channel" onChange={(e) => setChannelFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="sms">SMS</MenuItem>
              <MenuItem value="whatsapp">WhatsApp</MenuItem>
              <MenuItem value="call_task">Voice</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Language</InputLabel>
            <Select value={languageFilter} label="Language" onChange={(e) => setLanguageFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="he">Hebrew</MenuItem>
              <MenuItem value="ar">Arabic</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Tone</InputLabel>
            <Select value={toneFilter} label="Tone" onChange={(e) => setToneFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="calm">Calm</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="heavy">Heavy</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
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
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Channel</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Language</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Tone</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Version</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Updated</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Loading templates...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography variant="body1" color="text.secondary">No templates found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{template.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{template.key}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={channelIcons[template.channel] as React.ReactElement}
                        label={channelLabels[template.channel]}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{languageLabels[template.language]}</TableCell>
                    <TableCell>
                      <Chip
                        label={toneLabels[template.tone]}
                        size="small"
                        color={toneColors[template.tone]}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={template.status}
                        size="small"
                        color={statusColors[template.status]}
                      />
                    </TableCell>
                    <TableCell>v{template.version}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(template.updatedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Preview">
                          <IconButton size="small" onClick={() => handlePreviewClick(template)}>
                            <PreviewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditClick(template)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {template.status !== 'archived' && (
                          <Tooltip title="Archive">
                            <IconButton size="small" onClick={() => handleArchiveClick(template)}>
                              <ArchiveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
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
          rowsPerPageOptions={[10, 20, 50]}
        />
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600}>Edit Template</Typography>
          <IconButton onClick={() => setEditDialogOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedTemplate && (
            <Box sx={{ display: 'flex', gap: 3 }}>
              {/* Left side - Form */}
              <Box sx={{ flex: 1 }}>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Chip label={channelLabels[selectedTemplate.channel]} size="small" />
                    <Chip label={languageLabels[selectedTemplate.language]} size="small" />
                    <Chip label={toneLabels[selectedTemplate.tone]} size="small" color={toneColors[selectedTemplate.tone]} />
                  </Box>

                  <TextField
                    label="Name"
                    value={formData.name || ''}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    error={!!formErrors.name}
                    helperText={formErrors.name}
                    fullWidth
                    required
                  />

                  <TextField
                    label="Description"
                    value={formData.description || ''}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                  />

                  {selectedTemplate.channel === 'email' && (
                    <TextField
                      label="Subject"
                      value={formData.subject || ''}
                      onChange={(e) => handleFormChange('subject', e.target.value)}
                      error={!!formErrors.subject}
                      helperText={formErrors.subject}
                      fullWidth
                      required
                    />
                  )}

                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Insert Placeholder:</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {placeholderList.map((p) => (
                        <Chip
                          key={p}
                          label={`{${p}}`}
                          size="small"
                          onClick={() => insertPlaceholder(p)}
                          sx={{ cursor: 'pointer', mb: 0.5 }}
                        />
                      ))}
                    </Stack>
                  </Box>

                  <TextField
                    label="Body Text"
                    value={formData.bodyText || ''}
                    onChange={(e) => handleFormChange('bodyText', e.target.value)}
                    error={!!formErrors.bodyText}
                    helperText={formErrors.bodyText}
                    fullWidth
                    required
                    multiline
                    rows={10}
                    sx={{ fontFamily: 'monospace' }}
                  />

                  {selectedTemplate.channel === 'email' && (
                    <TextField
                      label="Body HTML"
                      value={formData.bodyHtml || ''}
                      onChange={(e) => handleFormChange('bodyHtml', e.target.value)}
                      fullWidth
                      multiline
                      rows={10}
                      sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                  )}

                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status || 'active'}
                      label="Status"
                      onChange={(e) => handleFormChange('status', e.target.value)}
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="draft">Draft</MenuItem>
                      <MenuItem value="archived">Archived</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} color="inherit">Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <EditIcon />}
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600}>
            Preview: {selectedTemplate?.name}
          </Typography>
          <IconButton onClick={() => setPreviewDialogOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {previewLoading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : previewData && (
            <Box>
              {selectedTemplate?.channel === 'email' && (
                <Tabs value={previewTab} onChange={(_, v) => setPreviewTab(v)} sx={{ mb: 2 }}>
                  <Tab label="HTML" />
                  <Tab label="Plain Text" />
                </Tabs>
              )}

              {previewData.subject && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">Subject:</Typography>
                  <Typography variant="body1" fontWeight={500}>{previewData.subject}</Typography>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {selectedTemplate?.channel === 'email' && previewTab === 0 && previewData.bodyHtml ? (
                <Paper
                  variant="outlined"
                  sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: previewData.bodyHtml }}
                />
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    maxHeight: 400,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    bgcolor: '#f5f5f5',
                    direction: selectedTemplate?.language === 'he' || selectedTemplate?.language === 'ar' ? 'rtl' : 'ltr'
                  }}
                >
                  {previewData.bodyText}
                </Paper>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar((p) => ({ ...p, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
