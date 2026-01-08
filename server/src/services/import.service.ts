import prisma from '../config/database';
import ExcelJS from 'exceljs';
import { ValidationError } from '../types';
import { Prisma } from '@prisma/client';

export interface ImportResult {
  success: boolean;
  imported: {
    customers: number;
    debts: number;
    installments: number;
  };
  errors: string[];
  skipped: number;
}

export interface ExcelRow {
  [key: string]: string | number | Date | undefined;
}

// Column mapping for flexible import
export interface ColumnMapping {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  externalRef?: string;
  debtAmount?: string;
  currency?: string;
  dueDate?: string;
  installmentAmount?: string;
  sequenceNo?: string;
}

// Default column mappings (Hebrew translated headers)
const DEFAULT_MAPPINGS: Record<string, keyof ColumnMapping> = {
  // English
  'customer name': 'customerName',
  'name': 'customerName',
  'full name': 'customerName',
  'email': 'customerEmail',
  'phone': 'customerPhone',
  'telephone': 'customerPhone',
  'external ref': 'externalRef',
  'external reference': 'externalRef',
  'reference': 'externalRef',
  'amount': 'debtAmount',
  'debt amount': 'debtAmount',
  'total amount': 'debtAmount',
  'original amount': 'debtAmount',
  'currency': 'currency',
  'due date': 'dueDate',
  'payment date': 'dueDate',
  'installment': 'installmentAmount',
  'installment amount': 'installmentAmount',
  'payment amount': 'installmentAmount',
  'sequence': 'sequenceNo',
  'seq': 'sequenceNo',
  '#': 'sequenceNo',
  // Hebrew (transliterated)
  'שם לקוח': 'customerName',
  'שם': 'customerName',
  'אימייל': 'customerEmail',
  'דוא"ל': 'customerEmail',
  'טלפון': 'customerPhone',
  'סכום': 'debtAmount',
  'סכום חוב': 'debtAmount',
  'מטבע': 'currency',
  'תאריך פירעון': 'dueDate',
  'תשלום': 'installmentAmount',
};

class ImportService {
  /**
   * Extract the actual value from an Excel cell, handling formulas, rich text, and hyperlinks
   */
  private extractCellValue(cell: ExcelJS.Cell): string | number | Date | undefined {
    const value = cell.value;
    
    if (value == null) {
      return undefined;
    }
    
    // Handle Date objects directly
    if (value instanceof Date) {
      return value;
    }
    
    // Handle primitive types (string, number, boolean)
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'boolean') {
      return String(value);
    }
    
    // Handle formula cells - get the calculated result
    if (typeof value === 'object' && 'result' in value) {
      const result = (value as { result: unknown }).result;
      if (result instanceof Date) {
        return result;
      }
      if (typeof result === 'string' || typeof result === 'number') {
        return result;
      }
      if (result != null) {
        return String(result);
      }
      return undefined;
    }
    
    // Handle rich text cells - concatenate all text parts
    if (typeof value === 'object' && 'richText' in value) {
      const richText = (value as { richText: Array<{ text: string }> }).richText;
      return richText.map(part => part.text).join('');
    }
    
    // Handle hyperlink cells - get the text value
    if (typeof value === 'object' && 'text' in value) {
      return (value as { text: string }).text;
    }
    
    // Handle shared string or other object types - use cell.text as fallback
    if (cell.text) {
      return cell.text;
    }
    
    // Last resort - try to get string representation
    return String(value);
  }

  /**
   * Parse Excel file buffer and return rows
   */
  async parseExcel(buffer: Buffer): Promise<{ headers: string[]; rows: ExcelRow[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet || worksheet.rowCount === 0) {
      throw new ValidationError('Excel file is empty');
    }

    // Get headers from first row
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      const value = this.extractCellValue(cell);
      headers[colNumber - 1] = value != null ? String(value) : '';
    });

    // Get data rows (skip header)
    const rows: ExcelRow[] = [];
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData: ExcelRow = {};
      let hasAnyValue = false;
      
      headers.forEach((header, idx) => {
        const cell = row.getCell(idx + 1);
        const value = this.extractCellValue(cell);
        
        if (value instanceof Date) {
          rowData[header] = value;
          hasAnyValue = true;
        } else if (value != null && value !== '') {
          rowData[header] = typeof value === 'number' ? value : String(value);
          hasAnyValue = true;
        } else {
          rowData[header] = '';
        }
      });
      
      // Only add rows that have at least one non-empty value
      if (hasAnyValue) {
        rows.push(rowData);
      }
    }

    if (rows.length === 0) {
      throw new ValidationError('Excel file has no data rows');
    }
    
    return { headers, rows };
  }

  /**
   * Auto-detect column mappings from headers
   */
  detectMappings(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {};
    
    for (const header of headers) {
      const normalized = header.toLowerCase().trim();
      const mappedField = DEFAULT_MAPPINGS[normalized];
      
      if (mappedField) {
        mapping[mappedField] = header;
      }
    }

    return mapping;
  }

  /**
   * Import data from Excel rows into database
   */
  async importData(
    rows: ExcelRow[],
    mapping: ColumnMapping,
    defaultCurrency = 'USD'
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: { customers: 0, debts: 0, installments: 0 },
      errors: [],
      skipped: 0,
    };

    // Group rows by customer (based on name/email)
    const customerGroups = new Map<string, ExcelRow[]>();
    
    for (const row of rows) {
      const customerKey = this.getCustomerKey(row, mapping);
      if (!customerKey) {
        result.skipped++;
        continue;
      }
      
      if (!customerGroups.has(customerKey)) {
        customerGroups.set(customerKey, []);
      }
      customerGroups.get(customerKey)!.push(row);
    }

    // Process each customer group in a transaction
    for (const [customerKey, customerRows] of customerGroups) {
      try {
        await prisma.$transaction(async (tx) => {
          // Create or find customer
          const firstRow = customerRows[0];
          const customerName = mapping.customerName 
            ? String(firstRow[mapping.customerName] || '').trim()
            : customerKey;
          
          const customerData: Prisma.CustomerCreateInput = {
            fullName: customerName,
            email: mapping.customerEmail 
              ? String(firstRow[mapping.customerEmail] || '').trim() || undefined
              : undefined,
            phone: mapping.customerPhone
              ? String(firstRow[mapping.customerPhone] || '').trim() || undefined
              : undefined,
            externalRef: mapping.externalRef
              ? String(firstRow[mapping.externalRef] || '').trim() || undefined
              : undefined,
          };

          // Check if customer exists by externalRef or email
          let customer = null;
          if (customerData.externalRef) {
            customer = await tx.customer.findUnique({
              where: { externalRef: customerData.externalRef },
            });
          }
          if (!customer && customerData.email) {
            customer = await tx.customer.findFirst({
              where: { email: customerData.email },
            });
          }

          if (!customer) {
            customer = await tx.customer.create({ data: customerData });
            result.imported.customers++;
          }

          // Calculate total debt from rows
          let totalDebt = 0;
          const currency = mapping.currency
            ? String(firstRow[mapping.currency] || defaultCurrency).trim().toUpperCase()
            : defaultCurrency;

          for (const row of customerRows) {
            const amount = this.parseAmount(row, mapping);
            if (amount > 0) {
              totalDebt += amount;
            }
          }

          if (totalDebt > 0) {
            // Create debt
            const debt = await tx.debt.create({
              data: {
                customerId: customer.id,
                originalAmount: totalDebt,
                currentBalance: totalDebt,
                currency: currency.substring(0, 3),
                status: 'open',
              },
            });
            result.imported.debts++;

            // Create installments from rows
            let sequenceNo = 1;
            for (const row of customerRows) {
              const installmentAmount = this.parseInstallmentAmount(row, mapping);
              const dueDate = this.parseDueDate(row, mapping);

              if (installmentAmount > 0) {
                await tx.installment.create({
                  data: {
                    debtId: debt.id,
                    sequenceNo: mapping.sequenceNo 
                      ? parseInt(String(row[mapping.sequenceNo])) || sequenceNo
                      : sequenceNo,
                    dueDate: dueDate || new Date(),
                    amountDue: installmentAmount,
                    status: dueDate && dueDate < new Date() ? 'overdue' : 'due',
                  },
                });
                result.imported.installments++;
                sequenceNo++;
              }
            }
          }
        });
      } catch (error) {
        result.errors.push(`Error processing customer "${customerKey}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private getCustomerKey(row: ExcelRow, mapping: ColumnMapping): string | null {
    // Try to get a unique customer identifier
    if (mapping.externalRef && row[mapping.externalRef]) {
      return String(row[mapping.externalRef]).trim();
    }
    if (mapping.customerEmail && row[mapping.customerEmail]) {
      return String(row[mapping.customerEmail]).trim().toLowerCase();
    }
    if (mapping.customerName && row[mapping.customerName]) {
      return String(row[mapping.customerName]).trim().toLowerCase();
    }
    return null;
  }

  private parseAmount(row: ExcelRow, mapping: ColumnMapping): number {
    if (!mapping.debtAmount) return 0;
    const value = row[mapping.debtAmount];
    if (!value) return 0;
    
    // Handle string amounts with currency symbols
    const cleaned = String(value).replace(/[^\d.-]/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  private parseInstallmentAmount(row: ExcelRow, mapping: ColumnMapping): number {
    // First try installment amount field
    if (mapping.installmentAmount) {
      const value = row[mapping.installmentAmount];
      if (value) {
        const cleaned = String(value).replace(/[^\d.-]/g, '');
        const amount = parseFloat(cleaned);
        if (!isNaN(amount) && amount > 0) return amount;
      }
    }
    // Fall back to debt amount (treat each row as an installment)
    return this.parseAmount(row, mapping);
  }

  private parseDueDate(row: ExcelRow, mapping: ColumnMapping): Date | null {
    if (!mapping.dueDate) return null;
    const value = row[mapping.dueDate];
    if (!value) return null;

    // Handle Excel date serial numbers
    if (typeof value === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    }

    // Handle date strings
    const date = new Date(String(value));
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Preview import without saving
   */
  async previewImport(
    rows: ExcelRow[],
    mapping: ColumnMapping
  ): Promise<{
    customers: number;
    debts: number;
    installments: number;
    sampleData: Array<{
      customerName: string;
      email?: string;
      phone?: string;
      debtAmount: number;
      currency: string;
      installments: number;
    }>;
  }> {
    const customerGroups = new Map<string, ExcelRow[]>();
    
    for (const row of rows) {
      const customerKey = this.getCustomerKey(row, mapping);
      if (!customerKey) continue;
      
      if (!customerGroups.has(customerKey)) {
        customerGroups.set(customerKey, []);
      }
      customerGroups.get(customerKey)!.push(row);
    }

    const sampleData = [];
    let totalInstallments = 0;

    for (const [, customerRows] of customerGroups) {
      const firstRow = customerRows[0];
      let totalDebt = 0;
      let installmentCount = 0;

      for (const row of customerRows) {
        const amount = this.parseInstallmentAmount(row, mapping);
        if (amount > 0) {
          totalDebt += amount;
          installmentCount++;
        }
      }

      totalInstallments += installmentCount;

      if (sampleData.length < 5) {
        sampleData.push({
          customerName: mapping.customerName 
            ? String(firstRow[mapping.customerName] || 'Unknown').trim()
            : 'Unknown',
          email: mapping.customerEmail 
            ? String(firstRow[mapping.customerEmail] || '').trim() || undefined
            : undefined,
          phone: mapping.customerPhone
            ? String(firstRow[mapping.customerPhone] || '').trim() || undefined
            : undefined,
          debtAmount: totalDebt,
          currency: mapping.currency
            ? String(firstRow[mapping.currency] || 'USD').trim().toUpperCase()
            : 'USD',
          installments: installmentCount,
        });
      }
    }

    return {
      customers: customerGroups.size,
      debts: customerGroups.size,
      installments: totalInstallments,
      sampleData,
    };
  }
}

export default new ImportService();

