import { Request, Response } from 'express';
import { z } from 'zod';
import importService, { ColumnMapping } from '../services/import.service';
import { ValidationError } from '../types';

const columnMappingSchema = z.object({
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  region: z.string().optional(),
  religion: z.string().optional(),
  externalRef: z.string().optional(),
  debtAmount: z.string().optional(),
  currency: z.string().optional(),
  dueDate: z.string().optional(),
  installmentAmount: z.string().optional(),
  sequenceNo: z.string().optional(),
});

const importOptionsSchema = z.object({
  mapping: columnMappingSchema.optional(),
  defaultCurrency: z.string().length(3).default('USD'),
});

class ImportController {
  /**
   * Parse uploaded Excel file and return headers + preview
   */
  async parseFile(req: Request, res: Response) {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { headers, rows } = await importService.parseExcel(req.file.buffer);
    const detectedMapping = importService.detectMappings(headers);

    res.json({
      success: true,
      data: {
        headers,
        rowCount: rows.length,
        detectedMapping,
        sampleRows: rows.slice(0, 5),
      },
    });
  }

  /**
   * Preview import results without saving
   */
  async previewImport(req: Request, res: Response) {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const options = importOptionsSchema.parse(req.body);
    const { headers, rows } = await importService.parseExcel(req.file.buffer);
    
    // Use provided mapping or auto-detect
    let mapping: ColumnMapping;
    if (options.mapping && Object.keys(options.mapping).length > 0) {
      mapping = options.mapping;
    } else {
      mapping = importService.detectMappings(headers);
    }

    const preview = await importService.previewImport(rows, mapping);

    res.json({
      success: true,
      data: preview,
    });
  }

  /**
   * Execute import and save to database
   */
  async executeImport(req: Request, res: Response) {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    // Parse options from form data
    let options: { mapping?: ColumnMapping; defaultCurrency: string } = { 
      mapping: {}, 
      defaultCurrency: 'USD' 
    };
    if (req.body.options) {
      try {
        const parsed = importOptionsSchema.parse(JSON.parse(req.body.options));
        options = {
          mapping: parsed.mapping || {},
          defaultCurrency: parsed.defaultCurrency,
        };
      } catch {
        // Use defaults if parsing fails
      }
    }

    const { headers, rows } = await importService.parseExcel(req.file.buffer);
    
    // Use provided mapping or auto-detect
    let mapping: ColumnMapping;
    if (options.mapping && Object.keys(options.mapping).length > 0) {
      mapping = options.mapping;
    } else {
      mapping = importService.detectMappings(headers);
    }

    const result = await importService.importData(
      rows,
      mapping,
      options.defaultCurrency
    );

    res.json({
      success: result.success,
      data: result,
      message: result.success 
        ? `Successfully imported ${result.imported.customers} customers, ${result.imported.debts} debts, ${result.imported.installments} installments`
        : `Import completed with ${result.errors.length} errors`,
    });
  }
}

export default new ImportController();

