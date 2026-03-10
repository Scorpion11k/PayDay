import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AutoAwesome as SparkleIcon, Send as SendIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { generateFlowFromPrompt } from '../../services/api';
import type { FlowDefinitionDto } from '../../types/flows';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface FlowPromptAssistantDialogProps {
  open: boolean;
  onClose: () => void;
  onFlowSaved: (flow: FlowDefinitionDto) => void;
  onOpenFlow?: (flowId: string) => void;
  initialFlowId?: string | null;
  initialPrompt?: string;
  title?: string;
}

export default function FlowPromptAssistantDialog({
  open,
  onClose,
  onFlowSaved,
  onOpenFlow,
  initialFlowId = null,
  initialPrompt = '',
  title,
}: FlowPromptAssistantDialogProps) {
  const { i18n } = useTranslation();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(initialFlowId);
  const [currentFlowName, setCurrentFlowName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locale = i18n.language.startsWith('he') ? 'he' : 'en';

  useEffect(() => {
    if (!open) return;
    setPrompt(initialPrompt);
    setCurrentFlowId(initialFlowId);
    setCurrentFlowName('');
    setMessages([]);
    setError(null);
  }, [open, initialFlowId, initialPrompt]);

  const headerText = useMemo(
    () =>
      title ||
      (locale === 'he'
        ? 'בנה טיוטת תהליך גבייה מצ׳אט'
        : 'Create a collection flow draft from chat'),
    [locale, title]
  );

  const placeholder = locale === 'he'
    ? 'למשל: צור תהליך ששולח WhatsApp מיד, SMS אחרי 3 ימים ושיחה אחרי 7 ימים'
    : 'Example: Create a flow that sends WhatsApp immediately, SMS after 3 days, and a voice call after 7 days';

  const handleSend = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setPrompt('');
    setLoading(true);
    setError(null);

    try {
      const response = await generateFlowFromPrompt({
        prompt: trimmed,
        locale,
        flowId: currentFlowId || undefined,
        createdBy: 'ui',
      });

      setCurrentFlowId(response.flow.id);
      setCurrentFlowName(response.flow.name);
      onFlowSaved(response.flow);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: response.assistantMessage,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SparkleIcon color="primary" fontSize="small" />
        <span>{headerText}</span>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 480 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {locale === 'he'
            ? 'כתוב פרומפט חופשי. כל הודעה יוצרת טיוטה חדשה או משפרת את הטיוטה הנוכחית.'
            : 'Use free-text prompts. Each message creates a new draft or refines the current draft.'}
        </Typography>

        {currentFlowId && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={locale === 'he' ? 'טיוטה פעילה' : 'Active draft'} color="primary" />
            <Chip label={currentFlowName || currentFlowId} variant="outlined" />
            {onOpenFlow && (
              <Button size="small" onClick={() => onOpenFlow(currentFlowId)}>
                {locale === 'he' ? 'פתח ב-Flows' : 'Open in Flows'}
              </Button>
            )}
          </Stack>
        )}

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            bgcolor: 'grey.50',
          }}
        >
          {messages.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {locale === 'he'
                ? 'דוגמאות: "צור תהליך עם WhatsApp ביום 0, SMS ביום 3, ושיחה ביום 7" או "הפוך את הטיוטה לנינוחה יותר והוסף אימייל אחרי 5 ימים".'
                : 'Examples: "Create a flow with WhatsApp on day 0, SMS on day 3, and a voice call on day 7" or "Make the draft calmer and add email after 5 days".'}
            </Typography>
          ) : (
            messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: message.role === 'user' ? 'primary.main' : '#fff',
                    color: message.role === 'user' ? '#fff' : 'text.primary',
                    border: message.role === 'assistant' ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>
                </Paper>
              </Box>
            ))
          )}
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={placeholder}
            disabled={loading}
          />
          <Button
            variant="contained"
            endIcon={<SendIcon />}
            onClick={() => void handleSend()}
            disabled={loading || !prompt.trim()}
            sx={{ alignSelf: 'stretch', minWidth: 140 }}
          >
            {loading ? (locale === 'he' ? 'יוצר...' : 'Generating...') : locale === 'he' ? 'שלח' : 'Send'}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {locale === 'he' ? 'סגור' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
