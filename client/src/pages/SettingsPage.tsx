import { useState } from 'react';
import { Box, Typography, Paper, FormControl, InputLabel, Select, MenuItem, Stack, Chip, Alert, Snackbar } from '@mui/material';
import { Settings as SettingsIcon, Language as LanguageIcon, TuneRounded as ModeIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useSystemMode, type SystemMode } from '../context/SystemModeContext';

const MODE_COLORS: Record<SystemMode, 'warning' | 'info' | 'success'> = {
  demo: 'warning',
  development: 'info',
  production: 'success',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { mode, setMode, loading: modeLoading } = useSystemMode();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleModeChange = async (newMode: SystemMode) => {
    try {
      await setMode(newMode);
      setSnackbar({
        open: true,
        message: t('settings.systemMode.changeSuccess', { mode: t(`settings.systemMode.modes.${newMode}.label`) }),
        severity: 'success',
      });
    } catch {
      setSnackbar({
        open: true,
        message: t('settings.systemMode.changeError'),
        severity: 'error',
      });
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <SettingsIcon sx={{ fontSize: 28, color: 'primary.main' }} />
        <Box>
          <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {t('settings.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('settings.description')}
          </Typography>
        </Box>
      </Box>

      <Stack spacing={3}>
        {/* Language Settings */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
            <LanguageIcon sx={{ fontSize: 24, color: 'primary.main', mt: 0.5 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem', mb: 0.5 }}>
                {t('settings.language.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('settings.language.description')}
              </Typography>
              
              <FormControl sx={{ minWidth: 250 }}>
                <InputLabel id="language-select-label">{t('settings.language.title')}</InputLabel>
                <Select
                  labelId="language-select-label"
                  id="language-select"
                  value={language}
                  label={t('settings.language.title')}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'he')}
                >
                  <MenuItem value="en">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        component="span"
                        sx={{
                          width: 24,
                          height: 16,
                          borderRadius: 0.5,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          bgcolor: '#f0f0f0',
                          border: '1px solid #ddd',
                        }}
                      >
                        🇺🇸
                      </Box>
                      {t('settings.language.english')}
                    </Box>
                  </MenuItem>
                  <MenuItem value="he">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        component="span"
                        sx={{
                          width: 24,
                          height: 16,
                          borderRadius: 0.5,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          bgcolor: '#f0f0f0',
                          border: '1px solid #ddd',
                        }}
                      >
                        🇮🇱
                      </Box>
                      {t('settings.language.hebrew')}
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Paper>

        {/* System Mode Settings */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <ModeIcon sx={{ fontSize: 24, color: 'primary.main', mt: 0.5 }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                  {t('settings.systemMode.title')}
                </Typography>
                <Chip
                  label={t(`settings.systemMode.modes.${mode}.label`)}
                  color={MODE_COLORS[mode]}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('settings.systemMode.description')}
              </Typography>

              <FormControl sx={{ minWidth: 250, mb: 2 }}>
                <InputLabel id="mode-select-label">{t('settings.systemMode.title')}</InputLabel>
                <Select
                  labelId="mode-select-label"
                  id="mode-select"
                  value={mode}
                  label={t('settings.systemMode.title')}
                  disabled={modeLoading}
                  onChange={(e) => handleModeChange(e.target.value as SystemMode)}
                >
                  <MenuItem value="demo">
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {t('settings.systemMode.modes.demo.label')}
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="development">
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {t('settings.systemMode.modes.development.label')}
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="production">
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {t('settings.systemMode.modes.production.label')}
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <Alert severity={MODE_COLORS[mode]} variant="outlined" sx={{ mt: 1 }}>
                <Typography variant="body2">
                  {t(`settings.systemMode.modes.${mode}.description`)}
                </Typography>
              </Alert>
            </Box>
          </Box>
        </Paper>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

