import { Box, Typography, Paper, FormControl, InputLabel, Select, MenuItem, Stack } from '@mui/material';
import { Settings as SettingsIcon, Language as LanguageIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

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
      </Stack>
    </Box>
  );
}

