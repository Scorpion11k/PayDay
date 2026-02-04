import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Tooltip,
} from '@mui/material';
import {
  Send as SendIcon,
  AutoAwesome as SparkleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  KeyboardArrowDown as MinimizeIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { queryAI, getAISuggestions } from '../../services/api';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  data?: {
    explanation: string;
    results: unknown;
    resultCount: number;
  };
  error?: string;
}

const DRAWER_WIDTH = 220;

const COLUMN_LABEL_KEYS: Record<string, string> = {
  id: 'chat.resultColumns.id',
  fullName: 'chat.resultColumns.fullName',
  full_name: 'chat.resultColumns.full_name',
  externalRef: 'chat.resultColumns.externalRef',
  external_ref: 'chat.resultColumns.external_ref',
  phone: 'chat.resultColumns.phone',
  email: 'chat.resultColumns.email',
  status: 'chat.resultColumns.status',
  gender: 'chat.resultColumns.gender',
  dateOfBirth: 'chat.resultColumns.dateOfBirth',
  date_of_birth: 'chat.resultColumns.date_of_birth',
  region: 'chat.resultColumns.region',
  religion: 'chat.resultColumns.religion',
  createdAt: 'chat.resultColumns.createdAt',
  created_at: 'chat.resultColumns.created_at',
  updatedAt: 'chat.resultColumns.updatedAt',
  updated_at: 'chat.resultColumns.updated_at',
  customerId: 'chat.resultColumns.customerId',
  customer_id: 'chat.resultColumns.customer_id',
  debtId: 'chat.resultColumns.debtId',
  debt_id: 'chat.resultColumns.debt_id',
  installmentId: 'chat.resultColumns.installmentId',
  installment_id: 'chat.resultColumns.installment_id',
  paymentId: 'chat.resultColumns.paymentId',
  payment_id: 'chat.resultColumns.payment_id',
  originalAmount: 'chat.resultColumns.originalAmount',
  original_amount: 'chat.resultColumns.original_amount',
  currentBalance: 'chat.resultColumns.currentBalance',
  current_balance: 'chat.resultColumns.current_balance',
  amountDue: 'chat.resultColumns.amountDue',
  amount_due: 'chat.resultColumns.amount_due',
  amountPaid: 'chat.resultColumns.amountPaid',
  amount_paid: 'chat.resultColumns.amount_paid',
  amount: 'chat.resultColumns.amount',
  currency: 'chat.resultColumns.currency',
  method: 'chat.resultColumns.method',
  channel: 'chat.resultColumns.channel',
  sequenceNo: 'chat.resultColumns.sequenceNo',
  sequence_no: 'chat.resultColumns.sequence_no',
  dueDate: 'chat.resultColumns.dueDate',
  due_date: 'chat.resultColumns.due_date',
  receivedAt: 'chat.resultColumns.receivedAt',
  received_at: 'chat.resultColumns.received_at',
  openedAt: 'chat.resultColumns.openedAt',
  opened_at: 'chat.resultColumns.opened_at',
  closedAt: 'chat.resultColumns.closedAt',
  closed_at: 'chat.resultColumns.closed_at',
  providerTxnId: 'chat.resultColumns.providerTxnId',
  provider_txn_id: 'chat.resultColumns.provider_txn_id',
  templateKey: 'chat.resultColumns.templateKey',
  template_key: 'chat.resultColumns.template_key',
  createdBy: 'chat.resultColumns.createdBy',
  created_by: 'chat.resultColumns.created_by',
  language: 'chat.resultColumns.language',
  preferredLanguage: 'chat.resultColumns.preferredLanguage',
  preferredChannel: 'chat.resultColumns.preferredChannel',
  preferredTone: 'chat.resultColumns.preferredTone',
  totalBalance: 'chat.resultColumns.totalBalance',
  total_balance: 'chat.resultColumns.total_balance',
  totalDebt: 'chat.resultColumns.totalDebt',
  total_debt: 'chat.resultColumns.total_debt',
};

const VALUE_LABEL_KEYS: Record<string, Record<string, string>> = {
  status: {
    active: 'chat.resultValues.status.active',
    do_not_contact: 'chat.resultValues.status.do_not_contact',
    doNotContact: 'chat.resultValues.status.do_not_contact',
    blocked: 'chat.resultValues.status.blocked',
    open: 'chat.resultValues.status.open',
    in_collection: 'chat.resultValues.status.in_collection',
    settled: 'chat.resultValues.status.settled',
    written_off: 'chat.resultValues.status.written_off',
    disputed: 'chat.resultValues.status.disputed',
    due: 'chat.resultValues.status.due',
    overdue: 'chat.resultValues.status.overdue',
    partially_paid: 'chat.resultValues.status.partially_paid',
    paid: 'chat.resultValues.status.paid',
    canceled: 'chat.resultValues.status.canceled',
    received: 'chat.resultValues.status.received',
    reversed: 'chat.resultValues.status.reversed',
    failed: 'chat.resultValues.status.failed',
    queued: 'chat.resultValues.status.queued',
    sent: 'chat.resultValues.status.sent',
    delivered: 'chat.resultValues.status.delivered',
    draft: 'chat.resultValues.status.draft',
    archived: 'chat.resultValues.status.archived',
  },
  gender: {
    male: 'chat.resultValues.gender.male',
    female: 'chat.resultValues.gender.female',
    other: 'chat.resultValues.gender.other',
    prefer_not_to_say: 'chat.resultValues.gender.prefer_not_to_say',
  },
  method: {
    bank_transfer: 'chat.resultValues.method.bank_transfer',
    card: 'chat.resultValues.method.card',
    cash: 'chat.resultValues.method.cash',
    check: 'chat.resultValues.method.check',
    other: 'chat.resultValues.method.other',
  },
  channel: {
    sms: 'chat.resultValues.channel.sms',
    email: 'chat.resultValues.channel.email',
    whatsapp: 'chat.resultValues.channel.whatsapp',
    call_task: 'chat.resultValues.channel.call_task',
  },
  language: {
    en: 'chat.resultValues.language.en',
    he: 'chat.resultValues.language.he',
    ar: 'chat.resultValues.language.ar',
  },
  preferredLanguage: {
    en: 'chat.resultValues.language.en',
    he: 'chat.resultValues.language.he',
    ar: 'chat.resultValues.language.ar',
  },
  preferredChannel: {
    sms: 'chat.resultValues.channel.sms',
    email: 'chat.resultValues.channel.email',
    whatsapp: 'chat.resultValues.channel.whatsapp',
    call_task: 'chat.resultValues.channel.call_task',
  },
  preferredTone: {
    calm: 'chat.resultValues.tone.calm',
    medium: 'chat.resultValues.tone.medium',
    heavy: 'chat.resultValues.tone.heavy',
  },
  tone: {
    calm: 'chat.resultValues.tone.calm',
    medium: 'chat.resultValues.tone.medium',
    heavy: 'chat.resultValues.tone.heavy',
  },
  deliveryStatus: {
    queued: 'chat.resultValues.status.queued',
    sent: 'chat.resultValues.status.sent',
    delivered: 'chat.resultValues.status.delivered',
    failed: 'chat.resultValues.status.failed',
  },
};

// Helper to format values for display
function formatValue(value: unknown, field: string, t: TFunction, locale: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
  if (typeof value === 'string') {
    const mapped = VALUE_LABEL_KEYS[field]?.[value];
    if (mapped) return t(mapped);
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
    if (isoDateRegex.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString(locale);
      }
    }
    return value;
  }
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toLocaleDateString(locale);
    return JSON.stringify(value);
  }
  return String(value);
}

// Helper to format field names
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function getColumnLabel(field: string, t: TFunction): string {
  const key = COLUMN_LABEL_KEYS[field];
  if (key) return t(key);
  return formatFieldName(field);
}

// Get display columns from data
function getDisplayColumns(data: Record<string, unknown>[]): string[] {
  if (data.length === 0) return [];
  
  // Get all keys from first item, excluding nested objects and internal fields
  const keys = Object.keys(data[0]).filter((key) => {
    const value = data[0][key];
    // Exclude deeply nested objects but keep simple values
    if (key.startsWith('_')) return false;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Allow simple objects but exclude complex nested ones
      return Object.keys(value).length <= 3;
    }
    return true;
  });

  // Prioritize certain columns
  const priority = ['id', 'fullName', 'full_name', 'name', 'email', 'phone', 'status', 'amount', 'currentBalance', 'dueDate'];
  const sorted = keys.sort((a, b) => {
    const aIdx = priority.indexOf(a);
    const bIdx = priority.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  // Limit to reasonable number of columns
  return sorted.slice(0, 8);
}

// Results display component
function ResultsDisplay({ results, resultCount }: { results: unknown; resultCount: number }) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const locale = i18n.language?.startsWith('he') ? 'he-IL' : 'en-US';

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle aggregate results (single object with _sum, _count, etc.)
  if (results && typeof results === 'object' && !Array.isArray(results)) {
    const obj = results as Record<string, unknown>;
    return (
      <Box sx={{ mt: 1.5 }}>
        <Paper
          elevation={0}
          sx={{
            bgcolor: 'rgba(33, 150, 243, 0.04)',
            border: '1px solid rgba(33, 150, 243, 0.2)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'rgba(33, 150, 243, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
              {t('common.result')}
            </Typography>
            <Tooltip title={copied ? t('common.copied') : t('chat.copyJson')}>
              <IconButton size="small" onClick={handleCopy}>
                {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ p: 2 }}>
            {Object.entries(obj).map(([key, value]) => (
              <Box key={key} sx={{ display: 'flex', gap: 2, py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 120 }}>
                  {getColumnLabel(key, t)}:
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {typeof value === 'object' ? JSON.stringify(value) : formatValue(value, key, t, locale)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    );
  }

  // Handle array results (list of records)
  if (Array.isArray(results)) {
    if (results.length === 0) {
      return (
        <Box sx={{ mt: 1.5 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'rgba(0, 0, 0, 0.02)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t('chat.noResultsFound')}
            </Typography>
          </Paper>
        </Box>
      );
    }

    const columns = getDisplayColumns(results as Record<string, unknown>[]);

    return (
      <Box sx={{ mt: 1.5 }}>
        <Paper
          elevation={0}
          sx={{
            bgcolor: 'rgba(33, 150, 243, 0.04)',
            border: '1px solid rgba(33, 150, 243, 0.2)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'rgba(33, 150, 243, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setExpanded(!expanded)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                {resultCount} {resultCount === 1 ? t('common.result') : t('common.results')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title={copied ? t('common.copied') : t('chat.copyJson')}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy();
                  }}
                >
                  {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
          </Box>
          <Collapse in={expanded}>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell
                        key={col}
                        sx={{
                          fontWeight: 600,
                          bgcolor: 'background.paper',
                          whiteSpace: 'nowrap',
                          fontSize: '0.75rem',
                        }}
                      >
                        {getColumnLabel(col, t)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(results as Record<string, unknown>[]).slice(0, 50).map((row, idx) => (
                    <TableRow key={idx} hover>
                      {columns.map((col) => (
                        <TableCell
                          key={col}
                          sx={{
                            fontSize: '0.813rem',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatValue(row[col], col, t, locale)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {results.length > 50 && (
              <Box sx={{ p: 1, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  {t('common.showing')} 50 {t('common.of')} {results.length} {t('common.results')}
                </Typography>
              </Box>
            )}
          </Collapse>
        </Paper>
      </Box>
    );
  }

  // Fallback for other types
  return (
    <Box sx={{ mt: 1.5 }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: 'rgba(0, 0, 0, 0.02)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: 2,
        }}
      >
        <Typography
          variant="body2"
          component="pre"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            overflow: 'auto',
            maxHeight: 200,
          }}
        >
          {JSON.stringify(results, null, 2)}
        </Typography>
      </Paper>
    </Box>
  );
}

export default function ChatPanel() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load suggestions on mount
  useEffect(() => {
    const language = i18n.language?.startsWith('he') ? 'he' : 'en';
    getAISuggestions(language)
      .then((res) => {
        if (res.success) {
          setSuggestions(res.data);
        }
      })
      .catch(() => {
        // Use fallback suggestions
        setSuggestions(language === 'he'
          ? [
              'הצג את כל הלקוחות באיחור של 30 ימים',
              'הצג 10 לקוחות עם היתרה הגבוהה ביותר',
              'כמה תשלומים התקבלו החודש?',
              'הצג לקוחות שמעולם לא ביצעו תשלום',
              'הצג את כל החובות במחלוקת',
            ]
          : [
              'Show all customers overdue by 30 days',
              'List top 10 customers with highest outstanding balance',
              'How many payments were received this month?',
              'Show customers who have never made a payment',
              'List all debts in dispute status',
            ]);
      });
  }, [i18n.language]);

  const handleSend = async (queryText?: string) => {
    const query = queryText || input.trim();
    if (!query) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: query,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setShowSuggestions(false);

    try {
      const language = i18n.language?.startsWith('he') ? 'he' : 'en';
      const response = await queryAI(query, language);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.data.explanation,
        role: 'assistant',
        timestamp: new Date(),
        data: {
          explanation: response.data.explanation,
          results: response.data.results,
          resultCount: response.data.resultCount,
        },
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: t('chat.error'),
        role: 'assistant',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  // Minimized state - just show a small button
  if (isMinimized) {
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          insetInlineEnd: 16,
          zIndex: 1000,
        }}
      >
        <Tooltip title={t('chat.openAssistant')}>
          <IconButton
            onClick={() => setIsMinimized(false)}
            sx={{
              bgcolor: '#1e3a5f',
              color: '#fff',
              width: 56,
              height: 56,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              '&:hover': {
                bgcolor: '#2c4a6f',
              },
            }}
          >
            <SparkleIcon />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        insetInlineStart: isMobile ? 0 : DRAWER_WIDTH,
        insetInlineEnd: 0,
        bgcolor: 'background.default',
        borderTop: '1px solid',
        borderColor: 'divider',
        zIndex: 1000,
      }}
    >
      {/* Minimize Button */}
      <Box
        sx={{
          position: 'absolute',
          top: -40,
          insetInlineEnd: 16,
          display: 'flex',
          gap: 0.5,
        }}
      >
        <Tooltip title={t('chat.minimizeChat')}>
          <IconButton
            size="small"
            onClick={() => setIsMinimized(true)}
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              '&:hover': {
                bgcolor: 'grey.100',
              },
            }}
          >
            <MinimizeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {messages.length > 0 && (
          <Tooltip title={t('chat.clearChat')}>
            <IconButton
              size="small"
              onClick={() => {
                setMessages([]);
                setShowSuggestions(true);
              }}
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                '&:hover': {
                  bgcolor: 'grey.100',
                },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Messages Display */}
      {messages.length > 0 && (
        <Box
          sx={{
            maxHeight: '400px',
            overflowY: 'auto',
            px: 3,
            py: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxWidth: 1000,
            mx: 'auto',
          }}
        >
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
                <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1.5,
                  maxWidth: message.role === 'user' ? '80%' : '100%',
                  width: message.role === 'assistant' && message.data ? '100%' : 'auto',
                  bgcolor: message.role === 'user' ? '#1e3a5f' : '#f0f4f8',
                  color: message.role === 'user' ? '#fff' : 'text.primary',
                  borderStartStartRadius: 16,
                  borderStartEndRadius: 16,
                  borderEndStartRadius: message.role === 'user' ? 16 : 4,
                  borderEndEndRadius: message.role === 'user' ? 4 : 16,
                }}
              >
                {message.role === 'assistant' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <SparkleIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, color: 'primary.main' }}
                    >
                      PayDay AI
                    </Typography>
                  </Box>
                )}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
                {message.error && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'error.main', display: 'block', mt: 1 }}
                  >
                    Error: {message.error}
                  </Typography>
                )}
                {message.data && (
                  <ResultsDisplay
                    results={message.data.results}
                    resultCount={message.data.resultCount}
                  />
                )}
              </Paper>
            </Box>
          ))}
          {isTyping && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} sx={{ color: 'primary.main' }} />
              <Typography variant="body2" color="text.secondary">
                {t('chat.thinking')}
              </Typography>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>
      )}

      {/* Suggestions (show when no messages) */}
      {showSuggestions && messages.length === 0 && suggestions.length > 0 && (
        <Box
          sx={{
            px: 3,
            py: 2,
            maxWidth: 900,
            mx: 'auto',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <SparkleIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              {t('chat.tryAsking')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {suggestions.slice(0, 5).map((suggestion, idx) => (
              <Chip
                key={idx}
                label={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                sx={{
                  bgcolor: 'rgba(33, 150, 243, 0.08)',
                  color: 'primary.main',
                  border: '1px solid rgba(33, 150, 243, 0.2)',
                  '&:hover': {
                    bgcolor: 'rgba(33, 150, 243, 0.15)',
                  },
                  cursor: 'pointer',
                  height: 'auto',
                  '& .MuiChip-label': {
                    py: 1,
                    whiteSpace: 'normal',
                  },
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Input Area */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: 'background.paper',
          borderTop: messages.length > 0 ? '1px solid' : 'none',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            width: '100%',
            maxWidth: 800,
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={t('chat.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#fff',
                borderRadius: 2,
                '& fieldset': {
                  borderColor: 'rgba(0,0,0,0.15)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(0,0,0,0.25)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                  borderWidth: 1,
                },
              },
              '& .MuiInputBase-input': {
                py: 1.5,
                fontSize: '0.938rem',
              },
            }}
          />
          <IconButton
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            sx={{
              bgcolor: '#1e3a5f',
              color: '#fff',
              width: 44,
              height: 44,
              '&:hover': {
                bgcolor: '#2c4a6f',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(0,0,0,0.12)',
                color: 'rgba(0,0,0,0.26)',
              },
            }}
          >
            <SendIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
          {t('chat.pressEnter')} • {t('chat.shiftEnter')} • {t('chat.poweredBy')}
        </Typography>
      </Box>
    </Box>
  );
}
