import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Divider,
  Box,
} from '@mui/material';
import { DragIndicator as DragIcon } from '@mui/icons-material';
import { COLUMN_DEFS, type ColumnDef } from './columnDefs';
import type { CustomersTableConfig } from '../../hooks/useCustomersTableConfig';

interface ColumnSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  config: CustomersTableConfig;
  onSave: (config: Partial<Omit<CustomersTableConfig, 'version'>>) => void;
  onReset: () => void;
}

export default function ColumnSettingsDialog({ open, onClose, config, onSave, onReset }: ColumnSettingsDialogProps) {
  const { t } = useTranslation();

  // Working copies of config (reset when dialog opens)
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Reset working state when dialog opens
  const handleEnter = () => {
    setColumnOrder([...config.columnOrder]);
    setHiddenColumns(new Set(config.hiddenColumns));
    setRowsPerPage(config.rowsPerPage);
  };

  const handleToggleColumn = (colId: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) {
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItem.current = index;
  };

  const handleDrop = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from === to) return;

    setColumnOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleSave = () => {
    onSave({
      columnOrder,
      hiddenColumns: Array.from(hiddenColumns),
      rowsPerPage,
    });
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  // Build ordered column list with definitions
  const orderedColumns: (ColumnDef & { index: number })[] = columnOrder
    .map((id, index) => {
      const def = COLUMN_DEFS.find((c) => c.id === id);
      return def ? { ...def, index } : null;
    })
    .filter((c): c is ColumnDef & { index: number } => c != null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      TransitionProps={{ onEnter: handleEnter }}
    >
      <DialogTitle>{t('customers.tableSettings.title')}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          {t('customers.tableSettings.columnOrder')}
        </Typography>
        <List dense disablePadding>
          {orderedColumns.map((col) => (
            <ListItem
              key={col.id}
              draggable
              onDragStart={() => handleDragStart(col.index)}
              onDragOver={(e) => handleDragOver(e, col.index)}
              onDrop={handleDrop}
              sx={{
                cursor: 'grab',
                '&:hover': { bgcolor: 'action.hover' },
                borderRadius: 1,
                userSelect: 'none',
              }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <DragIcon fontSize="small" color="action" />
              </ListItemIcon>
              <Checkbox
                edge="start"
                checked={!hiddenColumns.has(col.id)}
                disabled={!col.hideable}
                onChange={() => handleToggleColumn(col.id)}
                size="small"
                sx={{ mr: 1 }}
              />
              <ListItemText primary={t(col.labelKey)} />
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{t('customers.tableSettings.rowsPerPage')}</InputLabel>
            <Select
              value={rowsPerPage}
              label={t('customers.tableSettings.rowsPerPage')}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Button onClick={handleReset} color="inherit" size="small">
          {t('customers.tableSettings.resetDefaults')}
        </Button>
        <Box>
          <Button onClick={onClose} sx={{ mr: 1 }}>
            {t('customers.tableSettings.cancel')}
          </Button>
          <Button onClick={handleSave} variant="contained">
            {t('customers.tableSettings.save')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
