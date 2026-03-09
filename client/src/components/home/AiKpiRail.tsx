import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  WarningAmber as WarningIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import StatCard from '../Dashboard/StatCard';
import type { HomeBrainKpi } from '../../types/home-brain';

interface AiKpiRailProps {
  kpis: HomeBrainKpi[];
}

const iconMap: Record<string, ReactNode> = {
  total_overdue_balance: <MoneyIcon />,
  overdue_customers: <PeopleIcon />,
  collected_today: <TrendingUpIcon />,
  critical_accounts: <WarningIcon />,
};

function formatKpiValue(kpi: HomeBrainKpi): string | number {
  if (kpi.format === 'currency' && typeof kpi.value === 'number') {
    return `₪${kpi.value.toLocaleString()}`;
  }
  if (kpi.format === 'percent' && typeof kpi.value === 'number') {
    return `${kpi.value.toFixed(1)}%`;
  }
  return kpi.value;
}

export default function AiKpiRail({ kpis }: AiKpiRailProps) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {kpis.map((kpi) => (
        <Box key={kpi.key} sx={{ flex: '1 1 220px', minWidth: 220 }}>
          <StatCard
            title={kpi.label}
            value={formatKpiValue(kpi)}
            subtitle={kpi.trend?.label}
            icon={iconMap[kpi.key] || <TrendingUpIcon />}
            color={
              kpi.trend?.direction === 'down'
                ? '#d32f2f'
                : kpi.trend?.direction === 'up'
                  ? '#2e7d32'
                  : '#1e3a5f'
            }
            trend={
              kpi.trend?.value !== undefined
                ? {
                    value: kpi.trend.value,
                    label: kpi.trend.label,
                    isPositiveGood: kpi.trend.direction !== 'down',
                  }
                : undefined
            }
          />
        </Box>
      ))}
    </Box>
  );
}
