import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

// Mock responses for the AI assistant
const mockResponses = [
  "I've analyzed your request. Based on the current data, I can help you with that. Would you like me to provide more details?",
  "Great question! Let me pull up the relevant information for you. Your collection metrics are showing positive trends this month.",
  "I understand. I'll process this request and prepare a detailed report. Is there anything specific you'd like me to focus on?",
  "Done! I've updated the system with your requirements. You can view the changes in the Dashboard section.",
  "I've identified 47 customers matching your criteria. Would you like me to export this data or create a targeted campaign?",
];

const DRAWER_WIDTH = 220;

export default function ChatPanel() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateMockResponse = (): string => {
    return mockResponses[Math.floor(Math.random() * mockResponses.length)];
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: generateMockResponse(),
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: isMobile ? 0 : DRAWER_WIDTH,
        right: 0,
        bgcolor: 'background.default',
        borderTop: '1px solid',
        borderColor: 'divider',
        zIndex: 1000,
      }}
    >
      {/* Messages Display (only show when there are messages) */}
      {messages.length > 0 && (
        <Box
          sx={{
            maxHeight: '300px',
            overflowY: 'auto',
            px: 3,
            py: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            maxWidth: 900,
            mx: 'auto',
          }}
        >
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1.5,
                  maxWidth: '80%',
                  bgcolor: message.role === 'user' ? '#1e3a5f' : '#f0f4f8',
                  color: message.role === 'user' ? '#fff' : 'text.primary',
                  borderRadius: message.role === 'user' 
                    ? '16px 16px 4px 16px' 
                    : '16px 16px 16px 4px',
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
              </Paper>
            </Box>
          ))}
          {isTyping && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                PayDay AI is typing...
              </Typography>
            </Box>
          )}
          <div ref={messagesEndRef} />
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
            ref={inputRef}
            fullWidth
            multiline
            maxRows={4}
            placeholder="Type your command here... (e.g., 'Show all clients overdue by 30+ days')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
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
            onClick={handleSend}
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
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
        >
          Press Enter to send • Shift + Enter for new line
        </Typography>
      </Box>
    </Box>
  );
}

