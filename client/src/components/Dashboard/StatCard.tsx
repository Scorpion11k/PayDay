import { Box, Paper, Typography, Chip } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from '@mui/icons-material';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label?: string;
    isPositiveGood?: boolean;
  };
  icon?: React.ReactNode;
  color?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = '#1e3a5f',
}: StatCardProps) {
  const getTrendColor = () => {
    if (!trend) return 'default';
    const isPositive = trend.value > 0;
    const isGood = trend.isPositiveGood !== undefined ? trend.isPositiveGood : true;
    
    if (trend.value === 0) return 'default';
    if (isPositive === isGood) return 'success';
    return 'error';
  };

  const TrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUpIcon sx={{ fontSize: 16 }} />;
    if (trend.value < 0) return <TrendingDownIcon sx={{ fontSize: 16 }} />;
    return <TrendingFlatIcon sx={{ fontSize: 16 }} />;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: color,
          boxShadow: `0 4px 12px ${color}20`,
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontWeight: 500,
            fontSize: '0.813rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {title}
        </Typography>
        {icon && (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color,
            }}
          >
            {icon}
          </Box>
        )}
      </Box>

      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          color: 'text.primary',
          lineHeight: 1.2,
          mb: 1,
        }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Typography>

      {(subtitle || trend) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto' }}>
          {subtitle && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
            >
              {subtitle}
            </Typography>
          )}
          {trend && (
            <Chip
              size="small"
              icon={<TrendIcon />}
              label={`${trend.value > 0 ? '+' : ''}${trend.value}%${trend.label ? ` ${trend.label}` : ''}`}
              color={getTrendColor()}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                '& .MuiChip-icon': {
                  fontSize: 14,
                },
              }}
            />
          )}
        </Box>
      )}
    </Paper>
  );
}
