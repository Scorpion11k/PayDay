import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { HomeBrainQueue } from '../../types/home-brain';

interface PriorityQueuesProps {
  title: string;
  queues: HomeBrainQueue[];
  onOpenQueue: (queue: HomeBrainQueue) => void;
}

function priorityColor(priority: HomeBrainQueue['priority']) {
  switch (priority) {
    case 'critical':
      return 'error';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    case 'low':
    default:
      return 'default';
  }
}

export default function PriorityQueues({ title, queues, onOpenQueue }: PriorityQueuesProps) {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {queues.map((queue) => (
          <Paper
            key={queue.queueId}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              flex: '1 1 260px',
              minWidth: 260,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {queue.title}
                </Typography>
                {queue.description && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {queue.description}
                  </Typography>
                )}
              </Box>
              <Chip size="small" label={queue.priority} color={priorityColor(queue.priority)} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {queue.count}
            </Typography>
            <Button
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              sx={{ alignSelf: 'flex-start', mt: 'auto' }}
              onClick={() => onOpenQueue(queue)}
            >
              {t('homeBrain.openQueue')}
            </Button>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
