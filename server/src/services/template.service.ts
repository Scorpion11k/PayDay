import Handlebars from 'handlebars';
import prisma from '../config/database';
import { Customer, Installment, MessageTemplate, NotificationChannel, TemplateLanguage, TemplateTone } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Partial debt type for payload building (only fields we need)
interface DebtInfo {
  id: string;
  currentBalance: Decimal;
  currency: string;
}

// Unsubscribe text by language
const UNSUBSCRIBE_TEXT: Record<string, string> = {
  en: 'Reply STOP to opt out',
  he: 'השב/י STOP להסרה',
  ar: 'للإلغاء أرسل STOP'
};

// Voice mapping for TwiML generation
const VOICE_MAP: Record<string, string> = {
  en: 'Polly.Joanna',
  he: 'Polly.Dalia',
  ar: 'Polly.Zeina'
};

// Locale mapping for date formatting
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  he: 'he-IL',
  ar: 'ar-SA'
};

// Currency display by language
const CURRENCY_DISPLAY: Record<string, Record<string, string>> = {
  ILS: { en: '₪', he: 'ש"ח', ar: '₪' },
  USD: { en: '$', he: '$', ar: '$' },
  EUR: { en: '€', he: '€', ar: '€' },
  GBP: { en: '£', he: '£', ar: '£' },
};

/**
 * Format currency code for display based on language
 */
export function formatCurrencyForLanguage(currencyCode: string, language: string): string {
  const code = currencyCode?.toUpperCase() || 'ILS';
  const langDisplays = CURRENCY_DISPLAY[code];
  if (langDisplays && langDisplays[language]) {
    return langDisplays[language];
  }
  // Fallback to currency code if no mapping found
  return code;
}

export interface TemplatePayload {
  CustomerName: string;
  CompanyName: string;
  Amount: string;
  Currency: string;
  InvoiceNumber: string;
  DueDate: string;
  DaysOverdue: string;
  PaymentLink: string;
  SupportPhone: string;
  SupportEmail: string;
  BusinessHours: string;
  CaseId: string;
  UnsubscribeText: string;
}

export interface RenderedTemplate {
  subject?: string;
  bodyHtml?: string;
  bodyText: string;
}

class TemplateService {
  /**
   * Find a template by key, channel, language, and tone
   */
  async findTemplate(
    key: string,
    channel: NotificationChannel,
    language: TemplateLanguage,
    tone: TemplateTone
  ): Promise<MessageTemplate | null> {
    return prisma.messageTemplate.findFirst({
      where: {
        key,
        channel,
        language,
        tone,
        status: 'active'
      }
    });
  }

  /**
   * Resolve template with fallback logic
   * If exact match not found, falls back to 'en' language then 'calm' tone
   */
  async resolveTemplate(
    key: string,
    channel: NotificationChannel,
    language: TemplateLanguage = 'en',
    tone: TemplateTone = 'calm'
  ): Promise<MessageTemplate | null> {
    // Try exact match first
    let template = await this.findTemplate(key, channel, language, tone);
    if (template) return template;

    // Try with English language
    if (language !== 'en') {
      template = await this.findTemplate(key, channel, 'en', tone);
      if (template) return template;
    }

    // Try with calm tone
    if (tone !== 'calm') {
      template = await this.findTemplate(key, channel, language, 'calm');
      if (template) return template;
    }

    // Final fallback: English + calm
    return this.findTemplate(key, channel, 'en', 'calm');
  }

  /**
   * Build payload from customer, debt, and installment data
   */
  buildPayload(
    customer: Customer,
    debt?: DebtInfo | null,
    installment?: Installment | null,
    notificationId?: string,
    language: TemplateLanguage = 'en'
  ): TemplatePayload {
    const dueDate = installment?.dueDate || new Date();
    const daysOverdue = Math.max(0, Math.floor(
      (Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
    ));

    return {
      CustomerName: customer.fullName,
      CompanyName: process.env.COMPANY_NAME || 'PayDay AI',
      Amount: this.formatAmount(debt?.currentBalance),
      Currency: formatCurrencyForLanguage(debt?.currency || 'ILS', language),
      InvoiceNumber: debt?.id?.slice(0, 8).toUpperCase() || 'N/A',
      DueDate: this.formatDate(dueDate, language),
      DaysOverdue: String(daysOverdue),
      PaymentLink: this.generatePaymentLink(customer.id, debt?.id),
      SupportPhone: process.env.SUPPORT_PHONE || '',
      SupportEmail: process.env.SUPPORT_EMAIL || '',
      BusinessHours: process.env.BUSINESS_HOURS || '9 AM - 5 PM',
      CaseId: notificationId?.slice(0, 8).toUpperCase() || '',
      UnsubscribeText: UNSUBSCRIBE_TEXT[language] || UNSUBSCRIBE_TEXT.en
    };
  }

  /**
   * Render template with payload using Handlebars
   */
  render(template: MessageTemplate, payload: TemplatePayload): RenderedTemplate {
    const renderedBodyText = this.renderText(template.bodyText, payload);
    const renderedBodyHtml = template.bodyHtml
      ? this.renderText(template.bodyHtml, payload)
      : undefined;
    const renderedSubject = template.subject
      ? this.renderText(template.subject, payload)
      : undefined;

    return {
      subject: renderedSubject,
      bodyHtml: renderedBodyHtml,
      bodyText: renderedBodyText
    };
  }

  /**
   * Render a single text string with payload
   */
  renderText(templateText: string, payload: TemplatePayload): string {
    // Convert {Placeholder} to {{{Placeholder}}} for Handlebars (triple braces = no HTML escaping)
    const handlebarsTemplate = templateText.replace(
      /\{(\w+)\}/g,
      '{{{$1}}}'
    );
    const compiled = Handlebars.compile(handlebarsTemplate);
    return compiled(payload);
  }

  /**
   * Extract placeholders from template text
   */
  extractPlaceholders(templateText: string): string[] {
    const matches = templateText.matchAll(/\{(\w+)\}/g);
    return [...new Set([...matches].map(m => m[1]))];
  }

  /**
   * Validate template has all required placeholders
   */
  validatePlaceholders(
    templateText: string,
    required: string[] = ['CustomerName', 'Amount']
  ): { valid: boolean; missing: string[] } {
    const used = this.extractPlaceholders(templateText);
    const missing = required.filter(r => !used.includes(r));
    return { valid: missing.length === 0, missing };
  }

  /**
   * Generate TwiML for voice calls
   */
  generateTwiML(script: string, language: TemplateLanguage = 'en'): string {
    const voice = VOICE_MAP[language] || VOICE_MAP.en;

    // Replace [pause Xs] markers with TwiML pauses
    let ssml = script.replace(
      /\[pause (\d+)s?\]/gi,
      '<break time="$1s"/>'
    );

    // Escape XML special characters (but preserve break tags)
    ssml = ssml
      .replace(/&(?!amp;)/g, '&amp;')
      .replace(/<(?!break)/g, '&lt;')
      .replace(/(?<!\/")>/g, '&gt;');

    // Restore break tags
    ssml = ssml.replace(/&lt;break time="(\d+)s"\/&gt;/g, '<break time="$1s"/>');

    // Get gather prompt based on language
    const gatherPrompt = this.getGatherPrompt(language);

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">
    <prosody rate="95%">${ssml}</prosody>
  </Say>
  <Gather numDigits="1" timeout="10" action="/api/voice/gather">
    <Say voice="${voice}">${gatherPrompt}</Say>
  </Gather>
</Response>`;
  }

  /**
   * Get gather prompt in the appropriate language
   */
  private getGatherPrompt(language: TemplateLanguage): string {
    const prompts: Record<string, string> = {
      en: 'Press 1 for payment link. Press 2 for support.',
      he: 'הקש 1 לקבלת לינק לתשלום. הקש 2 לתמיכה.',
      ar: 'اضغط 1 لرابط الدفع. اضغط 2 للدعم.'
    };
    return prompts[language] || prompts.en;
  }

  /**
   * Format amount for display
   */
  private formatAmount(amount?: Decimal | number | null): string {
    if (amount === null || amount === undefined) return '0.00';
    return Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Format date based on language
   */
  private formatDate(date: Date, language: string): string {
    const locale = LOCALE_MAP[language] || LOCALE_MAP.en;
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Generate payment link
   */
  private generatePaymentLink(customerId: string, debtId?: string): string {
    const baseUrl = process.env.PAYMENT_BASE_URL || 'https://pay.payday.ai';
    const token = Buffer.from(`${customerId}:${debtId || ''}`).toString('base64url');
    return `${baseUrl}/${token}`;
  }
}

export default new TemplateService();
