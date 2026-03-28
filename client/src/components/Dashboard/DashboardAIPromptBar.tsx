import { useState } from 'react';
import { Box, TextField, Button, Paper, InputAdornment } from '@mui/material';
import { AutoAwesome as SparkleIcon, Send as SendIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface DashboardAIPromptBarProps {
  onGenerate: (prompt: string) => void;
  loading?: boolean;
}

export default function DashboardAIPromptBar({ onGenerate, loading }: DashboardAIPromptBarProps) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');

  const handleSubmit = () => {
    if (prompt.trim() && !loading) {
      onGenerate(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t('dashboards.aiPromptPlaceholder', 'Describe the dashboard you want to create...')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={loading}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SparkleIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!prompt.trim() || loading}
          sx={{ minWidth: 44, px: 1.5, borderRadius: 1.5 }}
        >
          <SendIcon sx={{ fontSize: 20 }} />
        </Button>
      </Box>
    </Paper>
  );
}
