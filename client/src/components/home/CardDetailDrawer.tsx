import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type {
  HomeBrainActionIntent,
  HomeBrainRecommendationCard,
  HomeBrainChannel,
  HomeBrainLanguage,
  HomeBrainPriority,
  HomeBrainTone,
} from '../../types/home-brain';

interface CardDetailDrawerProps {
  open: boolean;
  card: HomeBrainRecommendationCard | null;
  intent: HomeBrainActionIntent | null;
  onClose: () => void;
  onModify: (modifications: Record<string, unknown>) => Promise<void> | void;
  onApprove: (modifications: Record<string, unknown>) => Promise<void> | void;
}

const channelOptions: HomeBrainChannel[] = ['whatsapp', 'sms', 'email', 'call_task'];
const languageOptions: HomeBrainLanguage[] = ['en', 'he', 'ar'];
const toneOptions: HomeBrainTone[] = ['calm', 'medium', 'heavy'];
const severityOptions: HomeBrainPriority[] = ['critical', 'high', 'medium', 'low'];

export default function CardDetailDrawer({
  open,
  card,
  intent,
  onClose,
  onModify,
  onApprove,
}: CardDetailDrawerProps) {
  const { t } = useTranslation();
  const initialDraft = useMemo<Record<string, unknown>>(() => {
    if (!intent) return {};
    return { ...intent.payload };
  }, [intent]);

  const [draft, setDraft] = useState<Record<string, unknown>>(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const removableCustomerIds = Array.isArray(draft.customerIds) ? (draft.customerIds as string[]) : [];

  const updateDraft = (patch: Record<string, unknown>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const removeCustomer = (customerId: string) => {
    updateDraft({
      customerIds: removableCustomerIds.filter((id) => id !== customerId),
    });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          bgcolor: '#fff',
          color: 'text.primary',
        },
      }}
    >
      <Box
        sx={{
          width: { xs: '100vw', sm: 420 },
          height: '100%',
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
          bgcolor: '#fff',
        }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            {t('homeBrain.recommendationDetails')}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {card?.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {card?.body}
          </Typography>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            {t('homeBrain.explainability')}
          </Typography>
          <Typography variant="body2">{card?.explainability.whyNow}</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            {card?.explainability.keySignals.map((signal) => (
              <Chip key={signal} size="small" label={signal} variant="outlined" />
            ))}
          </Stack>
        </Box>

        {intent && (
          <>
            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {t('homeBrain.editablePayload')}
            </Typography>

            {(intent.type === 'send_bulk_reminders' || intent.type === 'switch_channel_for_cohort') && (
              <>
                {intent.type === 'send_bulk_reminders' ? (
                  <FormControl fullWidth>
                    <InputLabel>{t('homeBrain.channel')}</InputLabel>
                    <Select
                      label={t('homeBrain.channel')}
                      value={String(draft.channel || intent.payload.channel)}
                      onChange={(event) => updateDraft({ channel: event.target.value })}
                    >
                      {channelOptions.map((channel) => (
                        <MenuItem key={channel} value={channel}>
                          {channel}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <FormControl fullWidth>
                    <InputLabel>{t('homeBrain.toChannel')}</InputLabel>
                    <Select
                      label={t('homeBrain.toChannel')}
                      value={String(draft.toChannel || intent.payload.toChannel)}
                      onChange={(event) => updateDraft({ toChannel: event.target.value })}
                    >
                      {channelOptions.map((channel) => (
                        <MenuItem key={channel} value={channel}>
                          {channel}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <FormControl fullWidth>
                  <InputLabel>{t('homeBrain.language')}</InputLabel>
                  <Select
                    label={t('homeBrain.language')}
                    value={String(draft.language || intent.payload.language)}
                    onChange={(event) => updateDraft({ language: event.target.value })}
                  >
                    {languageOptions.map((language) => (
                      <MenuItem key={language} value={language}>
                        {language}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>{t('homeBrain.tone')}</InputLabel>
                  <Select
                    label={t('homeBrain.tone')}
                    value={String(draft.tone || intent.payload.tone)}
                    onChange={(event) => updateDraft({ tone: event.target.value })}
                  >
                    {toneOptions.map((tone) => (
                      <MenuItem key={tone} value={tone}>
                        {tone}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}

            {intent.type === 'materialize_collection_flow' && (
              <>
                <TextField
                  label={t('homeBrain.flowName')}
                  fullWidth
                  value={String(draft.flowName || intent.payload.flowName)}
                  onChange={(event) => updateDraft({ flowName: event.target.value })}
                />
                <TextField
                  label={t('homeBrain.description')}
                  fullWidth
                  multiline
                  minRows={3}
                  value={String(draft.description || intent.payload.description || '')}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                />
              </>
            )}

            {(intent.type === 'notify_management' || intent.type === 'create_internal_alert') && (
              <>
                <FormControl fullWidth>
                  <InputLabel>{t('homeBrain.severity')}</InputLabel>
                  <Select
                    label={t('homeBrain.severity')}
                    value={String(draft.severity || intent.payload.severity)}
                    onChange={(event) => updateDraft({ severity: event.target.value })}
                  >
                    {severityOptions.map((severity) => (
                      <MenuItem key={severity} value={severity}>
                        {severity}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {intent.type === 'create_internal_alert' && (
                  <FormControl fullWidth>
                    <InputLabel>{t('homeBrain.audience')}</InputLabel>
                    <Select
                      label={t('homeBrain.audience')}
                      value={String(draft.audience || intent.payload.audience)}
                      onChange={(event) => updateDraft({ audience: event.target.value })}
                    >
                      {['management', 'operations', 'collections'].map((audience) => (
                        <MenuItem key={audience} value={audience}>
                          {audience}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <TextField
                  label={t('homeBrain.title')}
                  fullWidth
                  value={String(draft.title || intent.payload.title)}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                />
                <TextField
                  label={t('homeBrain.body')}
                  fullWidth
                  multiline
                  minRows={4}
                  value={String(draft.body || intent.payload.body)}
                  onChange={(event) => updateDraft({ body: event.target.value })}
                />
              </>
            )}

            {(intent.type === 'send_bulk_reminders' ||
              intent.type === 'switch_channel_for_cohort' ||
              intent.type === 'assign_flow_to_customers') && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('homeBrain.customers')} ({removableCustomerIds.length})
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {removableCustomerIds.map((customerId) => (
                    <Chip key={customerId} label={customerId.slice(0, 8)} onDelete={() => removeCustomer(customerId)} />
                  ))}
                </Stack>
              </Box>
            )}
          </>
        )}

        <Box
          sx={{
            mt: 'auto',
            display: 'flex',
            gap: 1,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: '#fff',
          }}
        >
          <Button sx={{ flex: 1 }} variant="outlined" onClick={() => onModify(draft)} disabled={!intent}>
            {t('homeBrain.saveChanges')}
          </Button>
          <Button sx={{ flex: 1 }} variant="contained" onClick={() => onApprove(draft)}>
            {t('homeBrain.approve')}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
