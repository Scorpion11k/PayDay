import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  AlertTitle,
} from '@mui/material';
import {
  Extension as IntegrationsIcon,
  Add as AddIcon,
  Refresh as ReconnectIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  AutoAwesome as AIIcon,
} from '@mui/icons-material';
import ExcelJS from 'exceljs';

// Tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// Integration data type
interface Integration {
  id: string;
  name: string;
  logo: string;
  logoColor: string;
  connected: boolean;
  lastSync: string;
}

// Mock data for connected apps
const connectedApps: Integration[] = [
  { id: '1', name: 'Salesforce', logo: 'SF', logoColor: '#00A1E0', connected: true, lastSync: '2 hours ago' },
  { id: '2', name: 'SAP', logo: 'SAP', logoColor: '#0FAAFF', connected: true, lastSync: '1 day ago' },
  { id: '3', name: 'HubSpot', logo: 'HS', logoColor: '#FF7A59', connected: false, lastSync: 'Never' },
  { id: '4', name: 'QuickBooks', logo: 'QB', logoColor: '#2CA01C', connected: true, lastSync: '5 hours ago' },
  { id: '5', name: 'Twilio', logo: 'TW', logoColor: '#F22F46', connected: true, lastSync: '30 minutes ago' },
  { id: '6', name: 'Stripe', logo: 'stripe', logoColor: '#635BFF', connected: true, lastSync: 'Real-time' },
];

// Integration Card Component
function IntegrationCard({ integration }: { integration: Integration }) {
  const { t } = useTranslation();
  
  return (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, '&:hover': { borderColor: 'primary.main', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: integration.logoColor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: integration.logoColor, fontWeight: 700, fontSize: integration.logo === 'stripe' ? '0.6rem' : '0.75rem' }}>
              {integration.logo}
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{integration.name}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                {t('integrations.lastSync')}: {integration.lastSync}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={integration.connected ? t('integrations.connected') : t('integrations.disconnected')}
            size="small"
            sx={{
              bgcolor: integration.connected ? '#e8f5e9' : '#ffebee',
              color: integration.connected ? '#2e7d32' : '#c62828',
              fontWeight: 500, fontSize: '0.7rem', height: 24,
              '&::before': { content: integration.connected ? '"✓"' : '"×"', marginRight: '4px' },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<ReconnectIcon sx={{ fontSize: 16 }} />} sx={{ flex: 1, textTransform: 'none', fontSize: '0.8rem', py: 0.75, borderColor: 'divider', color: 'text.secondary' }}>
            {t('integrations.reconnect')}
          </Button>
          <Button variant="outlined" size="small" startIcon={<EditIcon sx={{ fontSize: 16 }} />} sx={{ flex: 1, textTransform: 'none', fontSize: '0.8rem', py: 0.75, borderColor: 'divider', color: 'text.secondary' }}>
            {t('common.edit')}
          </Button>
          <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}

// Empty state for tabs without content
function EmptyTabContent({ tabName }: { tabName: string }) {
  const { t } = useTranslation();
  
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 4, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        {t('integrations.emptyState.noConfig', { tabName: tabName.toLowerCase() })}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('integrations.emptyState.clickAdd')}
      </Typography>
    </Box>
  );
}

// Column mapping fields with validation types
const MAPPING_FIELDS = [
  { key: 'customerName', labelKey: 'integrations.dataImport.fields.customerName', required: true },
  { key: 'customerEmail', labelKey: 'integrations.dataImport.fields.email', required: false, validation: 'email' },
  { key: 'customerPhone', labelKey: 'integrations.dataImport.fields.phone', required: false, validation: 'phone' },
  { key: 'gender', labelKey: 'integrations.dataImport.fields.gender', required: false },
  { key: 'dateOfBirth', labelKey: 'integrations.dataImport.fields.dateOfBirth', required: false, validation: 'date' },
  { key: 'region', labelKey: 'integrations.dataImport.fields.region', required: false },
  { key: 'religion', labelKey: 'integrations.dataImport.fields.religion', required: false },
  { key: 'externalRef', labelKey: 'integrations.dataImport.fields.externalRef', required: false },
  { key: 'debtAmount', labelKey: 'integrations.dataImport.fields.debtAmount', required: true, validation: 'number' },
  { key: 'currency', labelKey: 'integrations.dataImport.fields.currency', required: false },
  { key: 'dueDate', labelKey: 'integrations.dataImport.fields.dueDate', required: false, validation: 'date' },
  { key: 'installmentAmount', labelKey: 'integrations.dataImport.fields.installmentAmount', required: false, validation: 'number' },
  { key: 'sequenceNo', labelKey: 'integrations.dataImport.fields.sequenceNo', required: false, validation: 'number' },
];

// Validation error interface
interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

// Required fields for import
const REQUIRED_FIELDS = ['customerName', 'debtAmount'];

// Data Import Component
function DataImportTab() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [aiSuggestedMapping, setAiSuggestedMapping] = useState<Record<string, string>>({});
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [detectingMapping, setDetectingMapping] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    details?: { customers: number; debts: number; installments: number };
  } | null>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'complete'>('upload');

  // Helper function to extract actual cell value from Excel cells (handles formulas, rich text, etc.)
  const extractCellValue = (cell: ExcelJS.Cell): string | number | Date | undefined => {
    const value = cell.value;
    
    if (value == null) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === 'boolean') return String(value);
    if (typeof value !== 'object') return value;
    
    // Handle formula cells - get the calculated result
    if ('result' in value) {
      const result = (value as { result: unknown }).result;
      if (result instanceof Date) return result;
      if (typeof result === 'string' || typeof result === 'number') return result;
      if (result != null) return String(result);
      return undefined;
    }
    
    // Handle rich text cells - concatenate all text parts
    if ('richText' in value) {
      const richText = (value as { richText: Array<{ text: string }> }).richText;
      return richText.map(part => part.text).join('');
    }
    
    // Handle hyperlink cells - get the text value
    if ('text' in value) {
      return (value as { text: string }).text;
    }
    
    // Fallback to cell.text or string representation
    return cell.text || String(value);
  };

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    try {
      // Parse file locally for preview
      const buffer = await selectedFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet || worksheet.rowCount === 0) {
        setImportResult({ success: false, message: t('integrations.dataImport.errors.emptyFile') });
        return;
      }

      // Get headers from first row
      const headerRow = worksheet.getRow(1);
      const fileHeaders: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        const value = extractCellValue(cell);
        fileHeaders[colNumber - 1] = value != null ? String(value) : '';
      });

      // Get data rows (skip header)
      const jsonData: Record<string, unknown>[] = [];
      for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const rowData: Record<string, unknown> = {};
        let hasAnyValue = false;
        
        fileHeaders.forEach((header, idx) => {
          const cell = row.getCell(idx + 1);
          const value = extractCellValue(cell);
          
          if (value instanceof Date) {
            rowData[header] = value;
            hasAnyValue = true;
          } else if (value != null && value !== '') {
            rowData[header] = typeof value === 'number' ? value : String(value);
            hasAnyValue = true;
          } else {
            rowData[header] = '';
          }
        });
        
        // Only add rows that have at least one non-empty value
        if (hasAnyValue) {
          jsonData.push(rowData);
        }
      }

      if (jsonData.length === 0) {
        setImportResult({ success: false, message: t('integrations.dataImport.errors.noDataRows') });
        return;
      }

      setHeaders(fileHeaders);
      setSampleRows(jsonData.slice(0, 10)); // Show up to 10 rows for preview
      setValidationErrors([]);

      // Use AI to detect column mappings
      setDetectingMapping(true);
      try {
        const response = await fetch('/api/ai/detect-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headers: fileHeaders }),
        });
        
        const result = await response.json();
        if (result.success && result.data?.mapping) {
          const suggestedMapping = result.data.mapping;
          setAiSuggestedMapping(suggestedMapping);
          // Show dialog to let user choose
          setShowMappingDialog(true);
        } else {
          // Fallback to pattern-based detection if AI fails
          const fallbackMapping = detectMappingsFallback(fileHeaders);
          setMapping(fallbackMapping);
          setStep('mapping');
        }
      } catch (aiError) {
        console.warn('AI mapping detection failed, using fallback:', aiError);
        // Fallback to pattern-based detection
        const fallbackMapping = detectMappingsFallback(fileHeaders);
        setMapping(fallbackMapping);
        setStep('mapping');
      } finally {
        setDetectingMapping(false);
      }
    } catch (error) {
      setImportResult({ success: false, message: t('integrations.dataImport.errors.parseFailed') + ': ' + (error instanceof Error ? error.message : 'Unknown error') });
    }
  }, [t]);

  // Handle AI mapping dialog actions
  const handleAcceptAIMapping = () => {
    setMapping(aiSuggestedMapping);
    setShowMappingDialog(false);
    setStep('mapping');
  };

  const handleRejectAIMapping = () => {
    setMapping({});
    setShowMappingDialog(false);
    setStep('mapping');
  };

  const handleEditAIMapping = () => {
    setMapping(aiSuggestedMapping);
    setShowMappingDialog(false);
    setStep('mapping');
  };

  // Check if all required fields are mapped
  const checkRequiredMappings = (): { valid: boolean; missing: string[] } => {
    const missing: string[] = [];
    for (const field of REQUIRED_FIELDS) {
      if (!mapping[field]) {
        const fieldDef = MAPPING_FIELDS.find(f => f.key === field);
        missing.push(fieldDef ? t(fieldDef.labelKey) : field);
      }
    }
    return { valid: missing.length === 0, missing };
  };

  // Get the number of mapped fields for AI suggestion count
  const getMappedFieldsCount = (mappingObj: Record<string, string>): number => {
    return Object.values(mappingObj).filter(v => v && v.length > 0).length;
  };

  // Fallback pattern-based mapping detection
  const detectMappingsFallback = (fileHeaders: string[]): Record<string, string> => {
    const autoMapping: Record<string, string> = {};
    const defaultMappings: Record<string, string[]> = {
      customerName: ['customer name', 'name', 'full name', 'שם לקוח', 'שם', 'שם מלא'],
      customerEmail: ['email', 'e-mail', 'אימייל', 'דוא"ל'],
      customerPhone: ['phone', 'telephone', 'mobile', 'טלפון', 'מספר טלפון'],
      gender: ['gender', 'sex', 'מין'],
      dateOfBirth: ['date of birth', 'dob', 'birth date', 'birthday', 'תאריך לידה'],
      region: ['region', 'area', 'location', 'אזור'],
      religion: ['religion', 'דת'],
      externalRef: ['external ref', 'reference', 'id', 'customer id', 'מזהה'],
      debtAmount: ['amount', 'debt amount', 'total', 'balance', 'סכום', 'סכום חוב'],
      currency: ['currency', 'מטבע'],
      dueDate: ['due date', 'payment due date', 'תאריך', 'תאריך פירעון', 'תאריך תשלום'],
      installmentAmount: ['installment', 'payment', 'תשלום'],
      sequenceNo: ['sequence', 'seq', '#'],
    };

    for (const header of fileHeaders) {
      const normalized = header.toLowerCase().trim();
      for (const [field, patterns] of Object.entries(defaultMappings)) {
        if (patterns.some(p => normalized.includes(p))) {
          autoMapping[field] = header;
          break;
        }
      }
    }
    return autoMapping;
  };

  const handleMappingChange = (field: string, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value }));
    // Clear validation errors when mapping changes
    setValidationErrors([]);
  };

  const handleImport = async () => {
    if (!file) return;

    // Check required fields before import
    const { valid, missing } = checkRequiredMappings();
    if (!valid) {
      setImportResult({
        success: false,
        message: t('integrations.dataImport.errors.missingRequired') + ': ' + missing.join(', '),
      });
      return;
    }

    setImporting(true);
    setImportResult(null);
    setValidationErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify({ mapping, defaultCurrency: 'ILS' }));

      const response = await fetch('/api/import/execute', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setImportResult({
          success: true,
          message: result.message,
          details: result.data.imported,
        });
        setStep('complete');
      } else {
        // Handle validation errors from server
        if (result.data?.validationErrors && result.data.validationErrors.length > 0) {
          setValidationErrors(result.data.validationErrors);
        }
        setImportResult({
          success: false,
          message: result.data?.errors?.join(', ') || result.message || t('integrations.dataImport.errors.importFailed'),
        });
      }
    } catch (error) {
      setImportResult({ success: false, message: t('integrations.dataImport.errors.serverConnection') + ': ' + (error instanceof Error ? error.message : 'Unknown error') });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setHeaders([]);
    setSampleRows([]);
    setMapping({});
    setAiSuggestedMapping({});
    setImportResult(null);
    setValidationErrors([]);
    setStep('upload');
  };

  // Get field mapping status for styling
  const getFieldStatus = (fieldKey: string, required: boolean): 'mapped' | 'unmapped' | 'missing' => {
    if (mapping[fieldKey]) return 'mapped';
    if (required) return 'missing';
    return 'unmapped';
  };

  // Check if required fields are missing
  const { valid: allRequiredMapped, missing: missingRequired } = checkRequiredMappings();

  return (
    <Box>
      {/* AI Mapping Suggestion Dialog */}
      <Dialog open={showMappingDialog} onClose={() => setShowMappingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon color="primary" />
          {t('integrations.dataImport.aiMapping.title') || 'AI Detected Mappings'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {t('integrations.dataImport.aiMapping.description') || 'We detected possible column mappings. Would you like to apply automatic mapping?'}
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>{t('integrations.dataImport.aiMapping.detected') || 'Detected Mappings'}</AlertTitle>
            {getMappedFieldsCount(aiSuggestedMapping)} {t('integrations.dataImport.aiMapping.fieldsDetected') || 'fields automatically detected'}
          </Alert>
          <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
            {Object.entries(aiSuggestedMapping).map(([field, header]) => {
              const fieldDef = MAPPING_FIELDS.find(f => f.key === field);
              return (
                <Box key={field} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {fieldDef ? t(fieldDef.labelKey) : field}
                    {fieldDef?.required && <span style={{ color: '#d32f2f' }}> *</span>}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">→ {header}</Typography>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleRejectAIMapping} color="inherit">
            {t('integrations.dataImport.aiMapping.reject') || 'Map Manually'}
          </Button>
          <Button onClick={handleEditAIMapping} variant="outlined">
            {t('integrations.dataImport.aiMapping.edit') || 'Edit Mappings'}
          </Button>
          <Button onClick={handleAcceptAIMapping} variant="contained" sx={{ bgcolor: '#1e3a5f' }}>
            {t('integrations.dataImport.aiMapping.accept') || 'Accept All'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc', border: '2px dashed', borderColor: 'divider', borderRadius: 2 }}>
          {detectingMapping ? (
            <>
              <CircularProgress size={48} sx={{ mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>{t('integrations.dataImport.mapping.aiDetecting') || 'AI is analyzing your file...'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('integrations.dataImport.mapping.aiDetectingDesc') || 'Detecting column mappings automatically'}
              </Typography>
            </>
          ) : (
            <>
              <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>{t('integrations.dataImport.upload.title')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t('integrations.dataImport.upload.description')}
              </Typography>
              <Button variant="contained" component="label" startIcon={<UploadIcon />} sx={{ bgcolor: '#1e3a5f', '&:hover': { bgcolor: '#2c4a6f' } }}>
                {t('integrations.dataImport.upload.selectFile')}
                <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
              </Button>
            </>
          )}
          {importResult && !importResult.success && (
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>{importResult.message}</Alert>
          )}
        </Paper>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h6">{t('integrations.dataImport.mapping.title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('integrations.dataImport.mapping.fileInfo', { fileName: file?.name, rowCount: sampleRows.length })}
              </Typography>
            </Box>
            <Button variant="outlined" onClick={resetImport}>{t('common.cancel')}</Button>
          </Box>

          {/* Required fields warning */}
          {!allRequiredMapped && (
            <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
              <AlertTitle>{t('integrations.dataImport.mapping.requiredMissing') || 'Required Fields Missing'}</AlertTitle>
              {t('integrations.dataImport.mapping.pleaseMap') || 'Please map the following required fields:'} {missingRequired.join(', ')}
            </Alert>
          )}

          {/* Column Mapping */}
          <Paper sx={{ p: 3, mb: 3, position: 'relative' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('integrations.dataImport.mapping.columnMapping')}</Typography>
              <Chip 
                size="small" 
                label={`${getMappedFieldsCount(mapping)}/${MAPPING_FIELDS.length} ${t('integrations.dataImport.mapping.mapped') || 'mapped'}`}
                color={allRequiredMapped ? 'success' : 'warning'}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              {MAPPING_FIELDS.map(field => {
                const status = getFieldStatus(field.key, field.required);
                return (
                  <FormControl 
                    key={field.key} 
                    size="small" 
                    fullWidth
                    error={status === 'missing'}
                  >
                    <InputLabel 
                      sx={{ 
                        color: status === 'missing' ? 'error.main' : status === 'mapped' ? 'success.main' : undefined 
                      }}
                    >
                      {t(field.labelKey)}{field.required ? ' *' : ''}
                    </InputLabel>
                    <Select
                      value={mapping[field.key] || ''}
                      onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      label={t(field.labelKey) + (field.required ? ' *' : '')}
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: status === 'missing' ? 'error.main' : status === 'mapped' ? 'success.main' : undefined,
                          borderWidth: status !== 'unmapped' ? 2 : 1,
                        },
                      }}
                      endAdornment={
                        status === 'mapped' ? (
                          <SuccessIcon color="success" sx={{ mr: 1, fontSize: 18 }} />
                        ) : status === 'missing' ? (
                          <ErrorIcon color="error" sx={{ mr: 1, fontSize: 18 }} />
                        ) : null
                      }
                    >
                      <MenuItem value="">{t('integrations.dataImport.mapping.notMapped')}</MenuItem>
                      {headers.map(header => (
                        <MenuItem key={header} value={header}>{header}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              })}
            </Box>
          </Paper>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>{t('integrations.dataImport.errors.validationFailed') || 'Validation Errors'}</AlertTitle>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {validationErrors.slice(0, 10).map((error, idx) => (
                  <li key={idx}>
                    <Typography variant="body2">
                      <strong>Row {error.row}:</strong> {error.message}
                    </Typography>
                  </li>
                ))}
                {validationErrors.length > 10 && (
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      ...and {validationErrors.length - 10} more errors
                    </Typography>
                  </li>
                )}
              </Box>
            </Alert>
          )}

          {/* Data Preview */}
          <Paper sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ p: 2, fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>
              {t('integrations.dataImport.preview.title')} ({sampleRows.length} {t('integrations.dataImport.preview.rows') || 'rows'})
            </Typography>
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, bgcolor: '#f5f5f5', minWidth: 50 }}>#</TableCell>
                    {headers.map(header => {
                      // Check if this header is mapped to a field
                      const mappedField = Object.entries(mapping).find(([, h]) => h === header)?.[0];
                      const fieldDef = mappedField ? MAPPING_FIELDS.find(f => f.key === mappedField) : null;
                      return (
                        <TableCell 
                          key={header} 
                          sx={{ 
                            fontWeight: 600, 
                            bgcolor: mappedField ? '#e8f5e9' : '#f5f5f5',
                            borderBottom: mappedField ? '2px solid #4caf50' : undefined,
                          }}
                        >
                          <Tooltip title={fieldDef ? `→ ${t(fieldDef.labelKey)}` : 'Not mapped'}>
                            <span>{header}</span>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sampleRows.map((row, idx) => {
                    // Check if this row has validation errors
                    const rowErrors = validationErrors.filter(e => e.row === idx + 2);
                    return (
                      <TableRow key={idx} sx={{ bgcolor: rowErrors.length > 0 ? '#ffebee' : undefined }}>
                        <TableCell sx={{ color: 'text.secondary' }}>{idx + 2}</TableCell>
                        {headers.map(header => {
                          const cellError = rowErrors.find(e => {
                            const mappedField = Object.entries(mapping).find(([, h]) => h === header)?.[0];
                            return mappedField === e.field;
                          });
                          return (
                            <TableCell 
                              key={header}
                              sx={{ 
                                color: cellError ? 'error.main' : undefined,
                                fontWeight: cellError ? 600 : undefined,
                              }}
                            >
                              {cellError ? (
                                <Tooltip title={cellError.message}>
                                  <span>{String(row[header] ?? '')}</span>
                                </Tooltip>
                              ) : (
                                String(row[header] ?? '')
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Import Button */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              justifyContent: isRTL ? 'flex-start' : 'flex-end',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {!allRequiredMapped && (
              <Typography variant="body2" color="error.main">
                {t('integrations.dataImport.mapping.cannotImport') || 'Cannot import: required fields not mapped'}
              </Typography>
            )}
            <Button variant="outlined" onClick={resetImport}>{t('common.cancel')}</Button>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={importing || !allRequiredMapped}
              startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
              sx={{ bgcolor: '#1e3a5f', '&:hover': { bgcolor: '#2c4a6f' } }}
            >
              {importing ? t('integrations.dataImport.importing') : t('integrations.dataImport.importData')}
            </Button>
          </Box>

          {importing && <LinearProgress sx={{ mt: 2 }} />}

          {importResult && (
            <Alert severity={importResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
              {importResult.message}
            </Alert>
          )}
        </Box>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && importResult?.success && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <SuccessIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" sx={{ mb: 1 }}>{t('integrations.dataImport.success.title')}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>{importResult.message}</Typography>
          
          {importResult.details && (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 4 }}>
              <Box>
                <Typography variant="h4" color="primary">{importResult.details.customers}</Typography>
                <Typography variant="body2" color="text.secondary">{t('integrations.dataImport.success.customers')}</Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="primary">{importResult.details.debts}</Typography>
                <Typography variant="body2" color="text.secondary">{t('integrations.dataImport.success.debts')}</Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="primary">{importResult.details.installments}</Typography>
                <Typography variant="body2" color="text.secondary">{t('integrations.dataImport.success.installments')}</Typography>
              </Box>
            </Box>
          )}

          <Button variant="contained" onClick={resetImport} sx={{ bgcolor: '#1e3a5f', '&:hover': { bgcolor: '#2c4a6f' } }}>
            {t('integrations.dataImport.importAnother')}
          </Button>
        </Paper>
      )}
    </Box>
  );
}

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const tabs = [
    t('integrations.tabs.connectedApps'),
    t('integrations.tabs.dataImport'),
    t('integrations.tabs.api'),
    t('integrations.tabs.webhooks'),
    t('integrations.tabs.marketplace'),
    t('integrations.tabs.custom'),
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IntegrationsIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>{t('integrations.title')}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('integrations.subtitle')}
            </Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} sx={{ textTransform: 'none', bgcolor: '#1e3a5f', '&:hover': { bgcolor: '#2c4a6f' } }}>
          {t('integrations.addIntegration')}
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontSize: '0.9rem', fontWeight: 500, minWidth: 'auto', px: 3, color: 'text.secondary', '&.Mui-selected': { color: 'primary.main' } },
            '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
          }}
        >
          {tabs.map((tab) => (<Tab key={tab} label={tab} />))}
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2.5 }}>
          {connectedApps.map((integration) => (<IntegrationCard key={integration.id} integration={integration} />))}
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <DataImportTab />
      </TabPanel>

      <TabPanel value={tabValue} index={2}><EmptyTabContent tabName={t('integrations.tabs.api')} /></TabPanel>
      <TabPanel value={tabValue} index={3}><EmptyTabContent tabName={t('integrations.tabs.webhooks')} /></TabPanel>
      <TabPanel value={tabValue} index={4}><EmptyTabContent tabName={t('integrations.tabs.marketplace')} /></TabPanel>
      <TabPanel value={tabValue} index={5}><EmptyTabContent tabName={t('integrations.tabs.custom')} /></TabPanel>
    </Box>
  );
}
