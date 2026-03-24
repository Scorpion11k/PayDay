import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { COLUMN_DEFS, DEFAULT_COLUMN_ORDER, type ColumnDef } from '../components/customers/columnDefs';

const STORAGE_KEY = 'payday-customers-table-config';

export interface CustomersTableConfig {
  version: 1;
  columnOrder: string[];
  hiddenColumns: string[];
  rowsPerPage: number;
}

const DEFAULT_CONFIG: CustomersTableConfig = {
  version: 1,
  columnOrder: DEFAULT_COLUMN_ORDER,
  hiddenColumns: [],
  rowsPerPage: 20,
};

const VALID_ROWS_PER_PAGE = [10, 20, 50, 100];

function validateConfig(saved: CustomersTableConfig): CustomersTableConfig {
  const knownIds = new Set(COLUMN_DEFS.map((c) => c.id));

  // Filter out unknown column IDs from saved order
  const validOrder = saved.columnOrder.filter((id) => knownIds.has(id));

  // Append any new columns that aren't in the saved order
  const savedSet = new Set(validOrder);
  for (const col of COLUMN_DEFS) {
    if (!savedSet.has(col.id)) {
      validOrder.push(col.id);
    }
  }

  // Filter hidden columns to only known IDs, exclude non-hideable columns
  const hideableIds = new Set(COLUMN_DEFS.filter((c) => c.hideable).map((c) => c.id));
  const validHidden = saved.hiddenColumns.filter((id) => hideableIds.has(id));

  const rowsPerPage = VALID_ROWS_PER_PAGE.includes(saved.rowsPerPage) ? saved.rowsPerPage : 20;

  return {
    version: 1,
    columnOrder: validOrder,
    hiddenColumns: validHidden,
    rowsPerPage,
  };
}

export function useCustomersTableConfig() {
  const [rawConfig, setRawConfig] = useLocalStorage<CustomersTableConfig>(STORAGE_KEY, DEFAULT_CONFIG);

  const config = useMemo(() => validateConfig(rawConfig), [rawConfig]);

  const updateConfig = useCallback((update: Partial<Omit<CustomersTableConfig, 'version'>>) => {
    setRawConfig((prev) => validateConfig({ ...prev, ...update, version: 1 }));
  }, [setRawConfig]);

  const resetToDefaults = useCallback(() => {
    setRawConfig(DEFAULT_CONFIG);
  }, [setRawConfig]);

  const getVisibleOrderedColumns = useCallback((): ColumnDef[] => {
    const hiddenSet = new Set(config.hiddenColumns);
    return config.columnOrder
      .map((id) => COLUMN_DEFS.find((col) => col.id === id))
      .filter((col): col is ColumnDef => col != null && !hiddenSet.has(col.id));
  }, [config]);

  return { config, updateConfig, resetToDefaults, getVisibleOrderedColumns };
}
