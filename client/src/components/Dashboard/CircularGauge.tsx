import { Box, Typography, useTheme } from '@mui/material';

interface CircularGaugeProps {
  value: number;
  maxValue: number;
  label: string;
  color?: string;
  size?: number;
  thickness?: number;
  showPercentage?: boolean;
  formatValue?: (value: number) => string;
}

export default function CircularGauge({
  value,
  maxValue,
  label,
  color = '#4fc3f7',
  size = 120,
  thickness = 8,
  showPercentage = true,
  formatValue,
}: CircularGaugeProps) {
  const theme = useTheme();
  const percentage = Math.min((value / maxValue) * 100, 100);
  const circumference = 2 * Math.PI * ((size - thickness) / 2);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const displayValue = formatValue ? formatValue(value) : value.toLocaleString();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - thickness) / 2}
            fill="none"
            stroke={theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
            strokeWidth={thickness}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - thickness) / 2}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: size > 100 ? '1.25rem' : '1rem',
              color: 'text.primary',
              lineHeight: 1.2,
            }}
          >
            {displayValue}
          </Typography>
          {showPercentage && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.7rem',
              }}
            >
              {percentage.toFixed(0)}%
            </Typography>
          )}
        </Box>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          fontWeight: 500,
          textAlign: 'center',
          fontSize: '0.813rem',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
