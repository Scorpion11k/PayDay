import { ReactNode } from 'react';
import {
  TableCell,
  TableSortLabel,
  Typography,
  Chip,
  Stack,
  Box,
} from '@mui/material';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  Warning as WarningIcon,
  WhatsApp as WhatsAppIcon,
  Sms as SmsIcon,
  Call as CallIcon,
  Inventory2 as ProductIcon,
} from '@mui/icons-material';
import type { TFunction } from 'i18next';

type SortField = 'fullName' | 'email' | 'status' | 'createdAt' | 'totalDebtAmount' | 'isOverdue' | 'payments';
type SortOrder = 'asc' | 'desc';

export interface CustomerProduct {
  id: string;
  name: string;
  price: number;
}

interface Customer {
  id: string;
  externalRef: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: 'active' | 'do_not_contact' | 'blocked';
  preferredLanguage: 'en' | 'he' | 'ar' | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  dateOfBirth: string | null;
  preferredChannel: 'sms' | 'email' | 'whatsapp' | 'call_task' | null;
  createdAt: string;
  totalDebtAmount: number;
  isOverdue: boolean;
  overdueDays: number;
  _count: { debts: number; payments: number };
  products?: CustomerProduct[];
}

const statusColors: Record<Customer['status'], 'success' | 'warning' | 'error'> = {
  active: 'success',
  do_not_contact: 'warning',
  blocked: 'error',
};

export interface ColumnDef {
  id: string;
  labelKey: string;
  sortField?: SortField;
  align?: 'left' | 'center' | 'right';
  hideable: boolean;
  renderHeader: (params: {
    t: TFunction;
    sortBy: SortField;
    sortOrder: SortOrder;
    onSort: (field: SortField) => void;
  }) => ReactNode;
  renderCell: (params: {
    customer: Customer;
    t: TFunction;
    language: string;
  }) => ReactNode;
}

function SortableHeader({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
  align,
}: {
  field: SortField;
  label: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <TableCell sx={{ fontWeight: 600 }} align={align}>
      <TableSortLabel
        active={sortBy === field}
        direction={sortBy === field ? sortOrder : 'asc'}
        onClick={() => onSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

export const COLUMN_DEFS: ColumnDef[] = [
  {
    id: 'fullName',
    labelKey: 'customers.columns.name',
    sortField: 'fullName',
    hideable: false,
    renderHeader: ({ t, sortBy, sortOrder, onSort }) => (
      <SortableHeader field="fullName" label={t('customers.columns.name')} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
    ),
    renderCell: ({ customer }) => (
      <TableCell>
        <Typography variant="body1" fontWeight={500}>{customer.fullName}</Typography>
      </TableCell>
    ),
  },
  {
    id: 'contact',
    labelKey: 'customers.columns.contact',
    sortField: 'email',
    hideable: true,
    renderHeader: ({ t, sortBy, sortOrder, onSort }) => (
      <SortableHeader field="email" label={t('customers.columns.contact')} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
    ),
    renderCell: ({ customer, t }) => (
      <TableCell>
        <Stack spacing={0.5}>
          {customer.email && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">{customer.email}</Typography>
            </Box>
          )}
          {customer.phone && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">{customer.phone}</Typography>
            </Box>
          )}
          {!customer.email && !customer.phone && (
            <Typography variant="body2" color="text.disabled">{t('customers.noContactInfo')}</Typography>
          )}
        </Stack>
      </TableCell>
    ),
  },
  {
    id: 'preferredChannel',
    labelKey: 'customers.preferredChannel',
    hideable: true,
    renderHeader: ({ t }) => (
      <TableCell sx={{ fontWeight: 600 }}>{t('customers.preferredChannel')}</TableCell>
    ),
    renderCell: ({ customer, t }) => {
      const channel = customer.preferredChannel;
      if (!channel) {
        return <TableCell><Typography variant="body2" color="text.disabled">—</Typography></TableCell>;
      }
      const channelConfig: Record<NonNullable<Customer['preferredChannel']>, { label: string; color: 'primary' | 'success' | 'warning' | 'secondary'; icon: React.ReactElement }> = {
        email: { label: t('common.email'), color: 'primary', icon: <EmailIcon sx={{ fontSize: 16 }} /> },
        sms: { label: 'SMS', color: 'warning', icon: <SmsIcon sx={{ fontSize: 16 }} /> },
        whatsapp: { label: 'WhatsApp', color: 'success', icon: <WhatsAppIcon sx={{ fontSize: 16 }} /> },
        call_task: { label: t('common.voiceCall'), color: 'secondary', icon: <CallIcon sx={{ fontSize: 16 }} /> },
      };
      const config = channelConfig[channel];
      return (
        <TableCell>
          <Chip size="small" icon={config.icon} label={config.label} color={config.color} variant="outlined" />
        </TableCell>
      );
    },
  },
  {
    id: 'preferredLanguage',
    labelKey: 'customers.preferredLanguage',
    hideable: true,
    renderHeader: ({ t }) => (
      <TableCell sx={{ fontWeight: 600 }}>{t('customers.preferredLanguage')}</TableCell>
    ),
    renderCell: ({ customer }) => {
      const lang = customer.preferredLanguage;
      if (!lang) {
        return <TableCell><Typography variant="body2" color="text.disabled">—</Typography></TableCell>;
      }
      const langLabels: Record<NonNullable<Customer['preferredLanguage']>, string> = { en: 'EN', he: 'HE', ar: 'AR' };
      return (
        <TableCell>
          <Chip size="small" label={langLabels[lang]} variant="outlined" sx={{ minWidth: 40 }} />
        </TableCell>
      );
    },
  },
  {
    id: 'externalRef',
    labelKey: 'customers.columns.externalRef',
    hideable: true,
    renderHeader: ({ t }) => (
      <TableCell sx={{ fontWeight: 600 }}>{t('customers.columns.externalRef')}</TableCell>
    ),
    renderCell: ({ customer }) => (
      <TableCell>
        <Typography variant="body2" color="text.secondary">{customer.externalRef || '—'}</Typography>
      </TableCell>
    ),
  },
  {
    id: 'gender',
    labelKey: 'customers.columns.gender',
    hideable: true,
    renderHeader: ({ t }) => (
      <TableCell sx={{ fontWeight: 600 }}>{t('customers.columns.gender')}</TableCell>
    ),
    renderCell: ({ customer, t }) => {
      const gender = customer.gender;
      if (!gender) {
        return <TableCell><Typography variant="body2" color="text.disabled">—</Typography></TableCell>;
      }
      const genderLabels: Record<NonNullable<Customer['gender']>, string> = {
        male: t('common.male'),
        female: t('common.female'),
        other: t('common.other'),
        prefer_not_to_say: t('common.preferNotToSay'),
      };
      return (
        <TableCell>
          <Typography variant="body2">{genderLabels[gender]}</Typography>
        </TableCell>
      );
    },
  },
  {
    id: 'age',
    labelKey: 'customers.columns.age',
    hideable: true,
    renderHeader: ({ t }) => (
      <TableCell sx={{ fontWeight: 600 }}>{t('customers.columns.age')}</TableCell>
    ),
    renderCell: ({ customer }) => {
      const dob = customer.dateOfBirth;
      if (!dob) {
        return <TableCell><Typography variant="body2" color="text.disabled">—</Typography></TableCell>;
      }
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return (
        <TableCell>
          <Typography variant="body2">{age}</Typography>
        </TableCell>
      );
    },
  },
  {
    id: 'status',
    labelKey: 'customers.columns.status',
    sortField: 'status',
    hideable: true,
    renderHeader: ({ t, sortBy, sortOrder, onSort }) => (
      <SortableHeader field="status" label={t('customers.columns.status')} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
    ),
    renderCell: ({ customer, t }) => {
      const labels: Record<Customer['status'], string> = {
        active: t('customers.status.active'),
        do_not_contact: t('customers.status.doNotContact'),
        blocked: t('customers.status.blocked'),
      };
      return (
        <TableCell>
          <Chip label={labels[customer.status]} color={statusColors[customer.status]} size="small" variant="outlined" />
        </TableCell>
      );
    },
  },
  {
    id: 'overdue',
    labelKey: 'customers.columns.overdue',
    sortField: 'isOverdue',
    align: 'center',
    hideable: true,
    renderHeader: ({ t, sortBy, sortOrder, onSort }) => (
      <SortableHeader field="isOverdue" label={t('customers.columns.overdue')} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} align="center" />
    ),
    renderCell: ({ customer, t }) => (
      <TableCell align="center">
        {customer.overdueDays > 0 ? (
          <Typography
            variant="body2"
            sx={{
              color: 'error.main',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
            }}
          >
            <WarningIcon sx={{ fontSize: 16 }} />
            {t('customers.columns.overdueDays', { days: customer.overdueDays })}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">—</Typography>
        )}
      </TableCell>
    ),
  },
  {
    id: 'totalDebt',
    labelKey: 'customers.columns.totalDebt',
    sortField: 'totalDebtAmount',
    align: 'right',
    hideable: true,
    renderHeader: ({ t, sortBy, sortOrder, onSort }) => (
      <SortableHeader field="totalDebtAmount" label={t('customers.columns.totalDebt')} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} align="right" />
    ),
    renderCell: ({ customer, language }) => (
      <TableCell align="right">
        <Typography
          variant="body2"
          fontWeight={customer.totalDebtAmount > 0 ? 600 : 400}
          color={customer.totalDebtAmount > 0 ? 'error.main' : 'text.secondary'}
        >
          {customer.totalDebtAmount > 0
            ? `₪${customer.totalDebtAmount.toLocaleString(language === 'he' ? 'he-IL' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '₪0.00'}
        </Typography>
      </TableCell>
    ),
  },
  {
    id: 'payments',
    labelKey: 'customers.columns.payments',
    sortField: 'payments',
    align: 'center',
    hideable: true,
    renderHeader: ({ t, sortBy, sortOrder, onSort }) => (
      <SortableHeader field="payments" label={t('customers.columns.payments')} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} align="center" />
    ),
    renderCell: ({ customer }) => (
      <TableCell align="center">
        <Chip
          label={customer._count.payments}
          size="small"
          sx={{
            bgcolor: customer._count.payments > 0 ? 'success.light' : 'grey.200',
            color: customer._count.payments > 0 ? 'success.dark' : 'text.secondary',
            fontWeight: 500,
          }}
        />
      </TableCell>
    ),
  },
  {
    id: 'products',
    labelKey: 'customers.columns.products',
    hideable: true,
    align: 'center',
    renderHeader: ({ t }) => (
      <TableCell sx={{ fontWeight: 600 }} align="center">{t('customers.columns.products')}</TableCell>
    ),
    renderCell: ({ customer }) => {
      const count = customer.products?.length ?? 0;
      return (
        <TableCell align="center">
          {count > 0 ? (
            <Chip
              size="small"
              icon={<ProductIcon sx={{ fontSize: 16 }} />}
              label={count}
              variant="outlined"
              color="info"
            />
          ) : (
            <Typography variant="body2" color="text.disabled">—</Typography>
          )}
        </TableCell>
      );
    },
  },
  {
    id: 'created',
    labelKey: 'customers.columns.created',
    sortField: 'createdAt',
    hideable: true,
    renderHeader: ({ t, sortBy, sortOrder, onSort }) => (
      <SortableHeader field="createdAt" label={t('customers.columns.created')} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
    ),
    renderCell: ({ customer, language }) => {
      const formatted = new Date(customer.createdAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      return (
        <TableCell>
          <Typography variant="body2" color="text.secondary">{formatted}</Typography>
        </TableCell>
      );
    },
  },
];

export const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map((col) => col.id);
