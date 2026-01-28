import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import templateService, { formatCurrencyForLanguage } from '../services/template.service';
import { ValidationError, NotFoundError } from '../types';

// Validation schemas
const templateCreateSchema = z.object({
  key: z.string().min(1, 'Template key is required'),
  channel: z.enum(['email', 'sms', 'whatsapp', 'call_task']),
  language: z.enum(['en', 'he', 'ar']),
  tone: z.enum(['calm', 'medium', 'heavy']),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().min(1, 'Body text is required'),
  status: z.enum(['draft', 'active', 'archived']).optional().default('active'),
  createdBy: z.string().optional().default('system')
});

const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  bodyHtml: z.string().optional().nullable(),
  bodyText: z.string().min(1).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  updatedBy: z.string().optional()
});

const previewSchema = z.object({
  sampleData: z.record(z.string()).optional()
});

const listQuerySchema = z.object({
  channel: z.enum(['email', 'sms', 'whatsapp', 'call_task']).optional(),
  language: z.enum(['en', 'he', 'ar']).optional(),
  tone: z.enum(['calm', 'medium', 'heavy']).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  key: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

class TemplatesController {
  /**
   * List all templates with filtering and pagination
   */
  async list(req: Request, res: Response) {
    const validation = listQuerySchema.safeParse(req.query);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const { channel, language, tone, status, key, page, limit } = validation.data;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;
    if (language) where.language = language;
    if (tone) where.tone = tone;
    if (status) where.status = status;
    if (key) where.key = key;

    // Get total count
    const total = await prisma.messageTemplate.count({ where });

    // Get paginated results
    const templates = await prisma.messageTemplate.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [
        { channel: 'asc' },
        { language: 'asc' },
        { tone: 'asc' }
      ],
      select: {
        id: true,
        key: true,
        channel: true,
        language: true,
        tone: true,
        name: true,
        description: true,
        subject: true,
        status: true,
        version: true,
        placeholders: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  }

  /**
   * Get a single template by ID
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const template = await prisma.messageTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new NotFoundError('Template');
    }

    res.json({
      success: true,
      data: template
    });
  }

  /**
   * Create a new template
   */
  async create(req: Request, res: Response) {
    const validation = templateCreateSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const data = validation.data;

    // Validate email-specific fields
    if (data.channel === 'email') {
      if (!data.subject) {
        throw new ValidationError('Subject is required for email templates');
      }
      if (!data.bodyHtml) {
        throw new ValidationError('HTML body is required for email templates');
      }
    }

    // Check for duplicate
    const existing = await prisma.messageTemplate.findFirst({
      where: {
        key: data.key,
        channel: data.channel,
        language: data.language,
        tone: data.tone
      }
    });

    if (existing) {
      throw new ValidationError(
        `Template with key "${data.key}" already exists for ${data.channel}/${data.language}/${data.tone}`
      );
    }

    // Extract placeholders
    const placeholders = templateService.extractPlaceholders(data.bodyText);
    if (data.bodyHtml) {
      const htmlPlaceholders = templateService.extractPlaceholders(data.bodyHtml);
      htmlPlaceholders.forEach(p => {
        if (!placeholders.includes(p)) placeholders.push(p);
      });
    }

    const template = await prisma.messageTemplate.create({
      data: {
        key: data.key,
        channel: data.channel,
        language: data.language,
        tone: data.tone,
        name: data.name,
        description: data.description,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText,
        placeholders,
        status: data.status,
        createdBy: data.createdBy
      }
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully'
    });
  }

  /**
   * Update an existing template
   */
  async update(req: Request, res: Response) {
    const { id } = req.params;
    
    const validation = templateUpdateSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const data = validation.data;

    // Check if template exists
    const existing = await prisma.messageTemplate.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('Template');
    }

    // Extract placeholders if body changed
    let placeholders = existing.placeholders;
    if (data.bodyText || data.bodyHtml) {
      placeholders = templateService.extractPlaceholders(data.bodyText || existing.bodyText);
      const htmlBody = data.bodyHtml !== undefined ? data.bodyHtml : existing.bodyHtml;
      if (htmlBody) {
        const htmlPlaceholders = templateService.extractPlaceholders(htmlBody);
        htmlPlaceholders.forEach(p => {
          if (!placeholders.includes(p)) placeholders.push(p);
        });
      }
    }

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText,
        status: data.status,
        placeholders,
        version: { increment: 1 },
        updatedBy: data.updatedBy || 'system'
      }
    });

    res.json({
      success: true,
      data: template,
      message: 'Template updated successfully'
    });
  }

  /**
   * Archive a template (soft delete)
   */
  async archive(req: Request, res: Response) {
    const { id } = req.params;

    const existing = await prisma.messageTemplate.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('Template');
    }

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: {
        status: 'archived',
        updatedBy: 'system'
      }
    });

    res.json({
      success: true,
      data: template,
      message: 'Template archived successfully'
    });
  }

  /**
   * Preview a template with sample data
   */
  async preview(req: Request, res: Response) {
    const { id } = req.params;
    
    const validation = previewSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const template = await prisma.messageTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new NotFoundError('Template');
    }

    // Default sample data - use appropriate currency based on template language
    const defaultSampleData = {
      CustomerName: template.language === 'he' ? 'ישראל ישראלי' : 'John Doe',
      Amount: '1,500.00',
      Currency: formatCurrencyForLanguage('ILS', template.language),
      InvoiceNumber: 'INV-2026-001',
      DueDate: template.language === 'he' ? '15 בינואר, 2026' : 'January 15, 2026',
      DaysOverdue: '11',
      PaymentLink: 'https://pay.example.com/abc123',
      SupportPhone: '+972-3-555-0123',
      SupportEmail: 'support@payday.ai',
      BusinessHours: template.language === 'he' ? '09:00 - 17:00' : '9 AM - 5 PM',
      CompanyName: 'PayDay AI',
      CaseId: 'CASE-12345',
      UnsubscribeText: template.language === 'he' ? 'השב/י STOP להסרה' : 'Reply STOP to opt out'
    };

    // Merge with provided sample data
    const sampleData = {
      ...defaultSampleData,
      ...(validation.data.sampleData || {})
    };

    // Render template
    const rendered = templateService.render(template, sampleData as any);

    res.json({
      success: true,
      data: {
        subject: rendered.subject,
        bodyHtml: rendered.bodyHtml,
        bodyText: rendered.bodyText,
        placeholders: template.placeholders
      }
    });
  }

  /**
   * Get template keys (distinct values)
   */
  async getKeys(req: Request, res: Response) {
    const templates = await prisma.messageTemplate.findMany({
      distinct: ['key'],
      select: { key: true }
    });

    res.json({
      success: true,
      data: templates.map(t => t.key)
    });
  }
}

export default new TemplatesController();
