import { useState, useCallback } from 'react';
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
} from '@mui/material';
import {
  Extension as IntegrationsIcon,
  Add as AddIcon,
  Refresh as ReconnectIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
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
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Last sync: {integration.lastSync}</Typography>
            </Box>
          </Box>
          <Chip
            label={integration.connected ? 'Connected' : 'Disconnected'}
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
          <Button variant="outlined" size="small" startIcon={<ReconnectIcon sx={{ fontSize: 16 }} />} sx={{ flex: 1, textTransform: 'none', fontSize: '0.8rem', py: 0.75, borderColor: 'divider', color: 'text.secondary' }}>Reconnect</Button>
          <Button variant="outlined" size="small" startIcon={<EditIcon sx={{ fontSize: 16 }} />} sx={{ flex: 1, textTransform: 'none', fontSize: '0.8rem', py: 0.75, borderColor: 'divider', color: 'text.secondary' }}>Edit</Button>
          <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}

// Empty state for tabs without content
function EmptyTabContent({ tabName }: { tabName: string }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 4, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
      <Typography color="text.secondary" sx={{ mb: 1 }}>No {tabName.toLowerCase()} configured yet.</Typography>
      <Typography variant="body2" color="text.secondary">Click "+ Add Integration" to get started.</Typography>
    </Box>
  );
}

// Column mapping fields
const MAPPING_FIELDS = [
  { key: 'customerName', label: 'Customer Name', required: true },
  { key: 'customerEmail', label: 'Email', required: false },
  { key: 'customerPhone', label: 'Phone', required: false },
  { key: 'externalRef', label: 'External Reference', required: false },
  { key: 'debtAmount', label: 'Debt Amount', required: true },
  { key: 'currency', label: 'Currency', required: false },
  { key: 'dueDate', label: 'Due Date', required: false },
  { key: 'installmentAmount', label: 'Installment Amount', required: false },
];

// Data Import Component
function DataImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
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
    if (typeof value !== 'object') return value;
    
    // Handle formula cells - get the calculated result
    if ('result' in value) {
      const result = (value as { result: unknown }).result;
      if (result instanceof Date) return result;
      return result != null ? result : undefined;
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
        setImportResult({ success: false, message: 'Excel file is empty' });
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
        setImportResult({ success: false, message: 'Excel file has no data rows' });
        return;
      }

      setHeaders(fileHeaders);
      setSampleRows(jsonData.slice(0, 5));

      // Auto-detect mappings
      const autoMapping: Record<string, string> = {};
      const defaultMappings: Record<string, string[]> = {
        customerName: ['customer name', 'name', 'full name', 'שם לקוח', 'שם'],
        customerEmail: ['email', 'אימייל', 'דוא"ל'],
        customerPhone: ['phone', 'telephone', 'טלפון'],
        externalRef: ['external ref', 'reference', 'id', 'מזהה'],
        debtAmount: ['amount', 'debt amount', 'total', 'סכום', 'סכום חוב'],
        currency: ['currency', 'מטבע'],
        dueDate: ['due date', 'date', 'תאריך', 'תאריך פירעון'],
        installmentAmount: ['installment', 'payment', 'תשלום'],
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

      setMapping(autoMapping);
      setStep('mapping');
    } catch (error) {
      setImportResult({ success: false, message: 'Failed to parse file: ' + (error instanceof Error ? error.message : 'Unknown error') });
    }
  }, []);

  const handleMappingChange = (field: string, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify({ mapping, defaultCurrency: 'USD' }));

      const response = await fetch('http://localhost:3001/api/import/execute', {
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
        setImportResult({
          success: false,
          message: result.data?.errors?.join(', ') || result.message || 'Import failed',
        });
      }
    } catch (error) {
      setImportResult({ success: false, message: 'Failed to connect to server: ' + (error instanceof Error ? error.message : 'Unknown error') });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setHeaders([]);
    setSampleRows([]);
    setMapping({});
    setImportResult(null);
    setStep('upload');
  };

  return (
    <Box>
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc', border: '2px dashed', borderColor: 'divider', borderRadius: 2 }}>
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>Upload Excel File</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload an Excel file (.xlsx, .xls) or CSV containing customer and debt data
          </Typography>
          <Button variant="contained" component="label" startIcon={<UploadIcon />} sx={{ bgcolor: '#1e3a5f', '&:hover': { bgcolor: '#2c4a6f' } }}>
            Select File
            <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
          </Button>
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
              <Typography variant="h6">Map Columns</Typography>
              <Typography variant="body2" color="text.secondary">
                File: {file?.name} ({sampleRows.length} rows preview)
              </Typography>
            </Box>
            <Button variant="outlined" onClick={resetImport}>Cancel</Button>
          </Box>

          {/* Column Mapping */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>Column Mapping</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              {MAPPING_FIELDS.map(field => (
                <FormControl key={field.key} size="small" fullWidth>
                  <InputLabel>{field.label}{field.required ? ' *' : ''}</InputLabel>
                  <Select
                    value={mapping[field.key] || ''}
                    onChange={(e) => handleMappingChange(field.key, e.target.value)}
                    label={field.label + (field.required ? ' *' : '')}
                  >
                    <MenuItem value="">-- Not Mapped --</MenuItem>
                    {headers.map(header => (
                      <MenuItem key={header} value={header}>{header}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </Box>
          </Paper>

          {/* Data Preview */}
          <Paper sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ p: 2, fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>
              Data Preview
            </Typography>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {headers.map(header => (
                      <TableCell key={header} sx={{ fontWeight: 600, bgcolor: '#f5f5f5' }}>{header}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sampleRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {headers.map(header => (
                        <TableCell key={header}>{String(row[header] ?? '')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Import Button */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={resetImport}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={importing || !mapping.customerName || !mapping.debtAmount}
              startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
              sx={{ bgcolor: '#1e3a5f', '&:hover': { bgcolor: '#2c4a6f' } }}
            >
              {importing ? 'Importing...' : 'Import Data'}
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
          <Typography variant="h5" sx={{ mb: 1 }}>Import Successful!</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>{importResult.message}</Typography>
          
          {importResult.details && (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 4 }}>
              <Box>
                <Typography variant="h4" color="primary">{importResult.details.customers}</Typography>
                <Typography variant="body2" color="text.secondary">Customers</Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="primary">{importResult.details.debts}</Typography>
                <Typography variant="body2" color="text.secondary">Debts</Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="primary">{importResult.details.installments}</Typography>
                <Typography variant="body2" color="text.secondary">Installments</Typography>
              </Box>
            </Box>
          )}

          <Button variant="contained" onClick={resetImport} sx={{ bgcolor: '#1e3a5f', '&:hover': { bgcolor: '#2c4a6f' } }}>
            Import Another File
          </Button>
        </Paper>
      )}
    </Box>
  );
}

export default function IntegrationsPage() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const tabs = ['Connected Apps', 'Data Import', 'API', 'Webhooks', 'Marketplace', 'Custom'];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IntegrationsIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>Integrations</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Connect PayDay AI with your CRM, ERP, accounting platforms, and custom systems
            </Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} sx={{ textTransform: 'none', bgcolor: '#1e3a5f', '&:hover': { bgcolor: '#2c4a6f' } }}>
          Add Integration
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

      <TabPanel value={tabValue} index={2}><EmptyTabContent tabName="API Connections" /></TabPanel>
      <TabPanel value={tabValue} index={3}><EmptyTabContent tabName="Webhooks" /></TabPanel>
      <TabPanel value={tabValue} index={4}><EmptyTabContent tabName="Marketplace Apps" /></TabPanel>
      <TabPanel value={tabValue} index={5}><EmptyTabContent tabName="Custom Integrations" /></TabPanel>
    </Box>
  );
}
