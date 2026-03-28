import { useState, useEffect } from 'react';
import { Box, Paper, Typography, Chip, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface RiskHeatScaleProps {
  value: number;
  label: string;
  subtitle?: string;
}

export default function RiskHeatScale({ value, label, subtitle }: RiskHeatScaleProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [displayValue, setDisplayValue] = useState(0);
  const isRTL = i18n.dir() === 'rtl';

  useEffect(() => {
    const timer = setTimeout(() => setDisplayValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  const getRiskLevel = (days: number) => {
    if (days <= 7) {
      return {
        level: t('dashboards.riskLow', 'Low'),
        color: theme.palette.success.main,
      };
    }
    if (days <= 30) {
      return {
        level: t('dashboards.riskMedium', 'Medium'),
        color: theme.palette.warning.main,
      };
    }
    return {
      level: t('dashboards.riskHigh', 'High'),
      color: theme.palette.error.main,
    };
  };

  const risk = getRiskLevel(displayValue);
  const maxDays = 60;
  const percentage = Math.min((displayValue / maxDays) * 100, 100);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        transition: 'all 0.2s ease',
        '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
      }}
    >
      <Box sx={{ textAlign: isRTL ? 'right' : 'left', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {label}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {/* Risk bar */}
      <Box sx={{ position: 'relative', height: 32, borderRadius: 16, overflow: 'hidden', mb: 1 }}>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <Box sx={{ flex: 1, bgcolor: theme.palette.success.main }} />
          <Box sx={{ flex: 1, bgcolor: theme.palette.warning.main }} />
          <Box sx={{ flex: 1, bgcolor: theme.palette.error.main }} />
        </Box>
        {/* Indicator */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 4,
            bgcolor: 'text.primary',
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            left: `${percentage}%`,
            transition: 'left 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -28,
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
            }}
          >
            <Box
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {displayValue.toFixed(0)} {t('dashboards.days', 'days')}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Labels */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          px: 0.5,
          mb: 2,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('dashboards.lowRisk', 'Low Risk')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('dashboards.mediumRisk', 'Medium Risk')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('dashboards.highRisk', 'High Risk')}
        </Typography>
      </Box>

      {/* Risk level badge */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pt: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('dashboards.riskLevel', 'Risk Level')}
        </Typography>
        <Chip
          label={risk.level}
          size="small"
          sx={{
            fontWeight: 700,
            bgcolor: `${risk.color}20`,
            color: risk.color,
            borderRadius: 8,
          }}
        />
      </Box>
    </Paper>
  );
}
