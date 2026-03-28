import { useState, useEffect } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface LinearScaleProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
  thresholds?: { low: number; medium: number };
}

export default function LinearScale({
  value,
  max,
  label,
  unit = '',
  thresholds = { low: 0.6, medium: 0.85 },
}: LinearScaleProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [displayValue, setDisplayValue] = useState(0);
  const isRTL = i18n.dir() === 'rtl';

  useEffect(() => {
    const timer = setTimeout(() => setDisplayValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  const safeMax = max > 0 ? max : 1;
  const clamped = Math.max(0, Math.min(displayValue, safeMax));
  const percentage = (clamped / safeMax) * 100;
  const ratio = clamped / safeMax;

  const getGradient = () => {
    if (ratio >= thresholds.medium) {
      return 'linear-gradient(to top, #d32f2f, #ed6c02, #2e7d32)';
    }
    if (ratio >= thresholds.low) {
      return 'linear-gradient(to top, #ed6c02, #2e7d32)';
    }
    return 'linear-gradient(to top, #2e7d32, #2e7d32)';
  };

  const getStatusColor = () => {
    if (ratio >= thresholds.medium) return theme.palette.error.main;
    if (ratio >= thresholds.low) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  const markers = [100, 75, 50, 25, 0];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        transition: 'all 0.2s ease',
        '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            position: 'relative',
            width: 48,
            height: 192,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              borderRadius: 24,
              height: `${percentage}%`,
              background: getGradient(),
              transition: 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              py: 1,
            }}
          >
            {markers.map((mark) => (
              <Box
                key={mark}
                sx={{
                  width: '100%',
                  height: '1px',
                  bgcolor: 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          0
        </Typography>
      </Box>

      <Box sx={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {displayValue.toLocaleString()}{unit}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', mt: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
          {t('dashboards.target', 'Target')}: {max.toLocaleString()}{unit}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, color: getStatusColor(), mt: 1 }}
        >
          {percentage.toFixed(1)}% {t('dashboards.ofTarget', 'of target')}
        </Typography>
      </Box>
    </Paper>
  );
}
