import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { HomeBrainRecommendationCard } from '../../types/home-brain';

interface RecommendationCardProps {
  card: HomeBrainRecommendationCard;
  status?: 'approved' | 'modified' | 'skipped' | 'resolved' | 'failed';
  onApprove: (card: HomeBrainRecommendationCard) => void;
  onModify: (card: HomeBrainRecommendationCard) => void;
  onSkip: (card: HomeBrainRecommendationCard) => void;
  onResolve: (card: HomeBrainRecommendationCard) => void;
}

function borderColor(priority: HomeBrainRecommendationCard['priority']) {
  switch (priority) {
    case 'critical':
      return '#d32f2f';
    case 'high':
      return '#ed6c02';
    case 'medium':
      return '#1976d2';
    case 'low':
    default:
      return '#90a4ae';
  }
}

export default function RecommendationCard({
  card,
  status,
  onApprove,
  onModify,
  onSkip,
  onResolve,
}: RecommendationCardProps) {
  const { t } = useTranslation();

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: status ? 'divider' : borderColor(card.priority),
        flex: '1 1 320px',
        minWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        opacity: status === 'skipped' ? 0.6 : 1,
      }}
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip size="small" label={card.priority} />
        <Chip size="small" label={card.type.replace('_', ' ')} variant="outlined" />
        {status && <Chip size="small" label={status} color={status === 'failed' ? 'error' : 'success'} />}
        {card.badges.map((badge) => (
          <Chip key={badge} size="small" label={badge} variant="outlined" />
        ))}
      </Stack>

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75 }}>
          {card.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {card.body}
        </Typography>
      </Box>

      <Box>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700 }}>
          {t('homeBrain.whyNow')}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {card.explainability.whyNow}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          {card.explainability.keySignals.map((signal) => (
            <Chip key={signal} size="small" label={signal} variant="outlined" />
          ))}
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
        <Button variant="contained" onClick={() => onApprove(card)}>
          {t('homeBrain.approve')}
        </Button>
        <Button variant="outlined" onClick={() => onModify(card)}>
          {t('homeBrain.modify')}
        </Button>
        <Button variant="text" color="inherit" onClick={() => onSkip(card)}>
          {t('homeBrain.skip')}
        </Button>
        <Button variant="text" color="success" onClick={() => onResolve(card)}>
          {t('homeBrain.resolve')}
        </Button>
      </Stack>
    </Paper>
  );
}
