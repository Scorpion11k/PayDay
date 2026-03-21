import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutline as CheckCircleOutlineIcon,
  CreditCard as CreditCardIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  getPaymentLinkPreview,
  payDebtFromLink,
  type PaymentLinkCompletionResult,
  type PaymentLinkPreview,
} from '../services/api';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function PaymentPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PaymentLinkPreview | null>(null);
  const [completion, setCompletion] = useState<PaymentLinkCompletionResult | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing payment link.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getPaymentLinkPreview(token);
        if (!cancelled) {
          setPreview(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load payment link.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handlePay = async () => {
    if (!token) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await payDebtFromLink(token);
      setCompletion(result);
      setPreview((currentPreview) =>
        currentPreview
          ? {
              ...currentPreview,
              status: 'already_paid',
              amount: result.debt.remainingBalance,
            }
          : currentPreview
      );
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : 'Failed to complete payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentCurrency = completion?.debt.currency || preview?.currency || 'ILS';
  const currentAmount = completion ? completion.debt.remainingBalance : preview?.amount ?? 0;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 4, md: 8 },
        px: 2,
        background:
          'radial-gradient(circle at top, rgba(25,118,210,0.16), transparent 30%), linear-gradient(180deg, #f6fbff 0%, #eef5ff 45%, #f8fafc 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
          }}
        >
          <Box
            sx={{
              px: { xs: 3, md: 4 },
              py: { xs: 3.5, md: 4 },
              color: '#fff',
              background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)',
            }}
          >
            <Typography variant="overline" sx={{ letterSpacing: 1.5, opacity: 0.88 }}>
              Secure Payment Link
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>
              Pay Your Debt
            </Typography>
            <Typography variant="body1" sx={{ mt: 1.5, opacity: 0.9 }}>
              Review the amount below and confirm the payment in one click.
            </Typography>
          </Box>

          <Box sx={{ px: { xs: 3, md: 4 }, py: { xs: 3, md: 4 }, bgcolor: '#fff' }}>
            {loading ? (
              <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
                <CircularProgress />
                <Typography color="text.secondary">Loading payment details...</Typography>
              </Stack>
            ) : (
              <Stack spacing={3}>
                {error && <Alert severity="error">{error}</Alert>}

                {preview && (
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      bgcolor: completion ? '#f8fff9' : '#f8fafc',
                    }}
                  >
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Customer
                        </Typography>
                        <Typography variant="h6" fontWeight={700}>
                          {preview.customer.fullName}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Invoice
                          </Typography>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {preview.debt.invoiceNumber}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Status
                          </Typography>
                          <Typography variant="subtitle1" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                            {completion ? completion.status.replace('_', ' ') : preview.status.replace('_', ' ')}
                          </Typography>
                        </Box>
                      </Stack>

                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 3,
                          background: completion
                            ? 'linear-gradient(135deg, #ecfdf3 0%, #f7fffb 100%)'
                            : 'linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%)',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {completion ? 'Remaining balance' : 'Amount to pay'}
                        </Typography>
                        <Typography variant="h3" fontWeight={800} sx={{ mt: 0.5 }}>
                          {formatCurrency(currentAmount, currentCurrency)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                )}

                {completion ? (
                  <Alert
                    icon={<CheckCircleOutlineIcon />}
                    severity={completion.status === 'paid' ? 'success' : 'info'}
                  >
                    {completion.status === 'paid'
                      ? `Payment received for ${formatCurrency(completion.payment?.amount || 0, completion.debt.currency)}. Any active collection flow for this debt has been stopped.`
                      : 'This debt was already paid. No additional charge was created.'}
                  </Alert>
                ) : preview?.status === 'already_paid' ? (
                  <Alert severity="success">
                    This debt has already been paid. No further collection steps should continue.
                  </Alert>
                ) : (
                  <Button
                    variant="contained"
                    size="large"
                    disabled={!preview || submitting}
                    startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <CreditCardIcon />}
                    onClick={() => void handlePay()}
                    sx={{
                      py: 1.4,
                      borderRadius: 999,
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '1rem',
                      background: 'linear-gradient(135deg, #0f766e 0%, #10b981 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #115e59 0%, #059669 100%)',
                      },
                    }}
                  >
                    {submitting
                      ? 'Processing payment...'
                      : `Pay ${formatCurrency(preview?.amount || 0, preview?.currency || 'ILS')}`}
                  </Button>
                )}

                <Typography variant="body2" color="text.secondary">
                  This demo payment page records the payment immediately and updates the customer debt status in PayDay.
                </Typography>

                <Button
                  component={RouterLink}
                  to="/"
                  color="inherit"
                  endIcon={<OpenInNewIcon fontSize="small" />}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                >
                  Back to PayDay
                </Button>
              </Stack>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
