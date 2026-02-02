import { Box, Typography, useTheme } from '@mui/material';

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  title?: string;
  showLegend?: boolean;
  centerLabel?: string;
  centerValue?: string | number;
}

export default function DonutChart({
  segments,
  size = 160,
  thickness = 24,
  title,
  showLegend = true,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const theme = useTheme();
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercentage = 0;

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
          alignItems: 'center',
          gap: 3,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ position: 'relative', width: size, height: size }}>
          <svg width={size} height={size}>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
              strokeWidth={thickness}
            />
            {/* Segments */}
            {segments.map((segment, index) => {
              const percentage = total > 0 ? (segment.value / total) * 100 : 0;
              const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
              const rotation = (accumulatedPercentage / 100) * 360 - 90;
              accumulatedPercentage += percentage;

              return (
                <circle
                  key={index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  strokeDasharray={strokeDasharray}
                  strokeLinecap="butt"
                  transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                  style={{ transition: 'stroke-dasharray 0.5s ease-in-out' }}
                />
              );
            })}
          </svg>
          {(centerLabel || centerValue !== undefined) && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}
            >
              {centerValue !== undefined && (
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    lineHeight: 1.2,
                  }}
                >
                  {typeof centerValue === 'number' ? centerValue.toLocaleString() : centerValue}
                </Typography>
              )}
              {centerLabel && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                  }}
                >
                  {centerLabel}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {showLegend && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {segments.map((segment, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: segment.color,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', fontSize: '0.813rem' }}
                >
                  {segment.label}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.813rem' }}
                >
                  {segment.value.toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
