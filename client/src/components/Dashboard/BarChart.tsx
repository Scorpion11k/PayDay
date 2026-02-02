import { Box, Typography, useTheme, Tooltip } from '@mui/material';

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  title?: string;
  height?: number;
  showValues?: boolean;
  horizontal?: boolean;
  maxValue?: number;
  formatValue?: (value: number) => string;
  defaultColor?: string;
}

export default function BarChart({
  data,
  title,
  height = 200,
  showValues = true,
  horizontal = false,
  maxValue,
  formatValue,
  defaultColor = '#4fc3f7',
}: BarChartProps) {
  const theme = useTheme();
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  const formatDisplayValue = (value: number) => {
    if (formatValue) return formatValue(value);
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  if (horizontal) {
    return (
      <Box>
        {title && (
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}
          >
            {title}
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {data.map((item, index) => (
            <Box key={index}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 0.5,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', fontSize: '0.813rem' }}
                >
                  {item.label}
                </Typography>
                {showValues && (
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.813rem' }}
                  >
                    {formatDisplayValue(item.value)}
                  </Typography>
                )}
              </Box>
              <Box
                sx={{
                  height: 8,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${(item.value / max) * 100}%`,
                    bgcolor: item.color || defaultColor,
                    borderRadius: 1,
                    transition: 'width 0.5s ease-in-out',
                  }}
                />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  // Vertical bar chart
  return (
    <Box>
      {title && (
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}
        >
          {title}
        </Typography>
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          height,
          gap: 1,
          pt: 2,
        }}
      >
        {data.map((item, index) => {
          const barHeight = (item.value / max) * (height - 40);
          return (
            <Box
              key={index}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                maxWidth: 60,
              }}
            >
              {showValues && (
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 0.5,
                    fontSize: '0.7rem',
                  }}
                >
                  {formatDisplayValue(item.value)}
                </Typography>
              )}
              <Tooltip title={`${item.label}: ${item.value.toLocaleString()}`}>
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: 40,
                    height: Math.max(barHeight, 4),
                    bgcolor: item.color || defaultColor,
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.5s ease-in-out',
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.85,
                    },
                  }}
                />
              </Tooltip>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  mt: 1,
                  fontSize: '0.7rem',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 60,
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
