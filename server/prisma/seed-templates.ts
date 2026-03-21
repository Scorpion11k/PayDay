/**
 * SCRUM-11: Multichannel Outreach Templates Seed Data
 * 
 * This file contains all 36 message templates for the PayDay AI collection system.
 * Templates cover 4 channels × 3 languages × 3 tones = 36 templates
 * 
 * Channels: email, sms, whatsapp, call_task
 * Languages: en (English), he (Hebrew), ar (Arabic)
 * Tones: calm, medium, heavy
 * 
 * Usage: Run `npx prisma db seed` after adding this to prisma/seed.ts
 */

import 'dotenv/config';
import { PrismaClient, NotificationChannel } from '@prisma/client';

const prisma = new PrismaClient();

// Type definitions matching Prisma schema
type TemplateLanguage = 'en' | 'he' | 'ar';
type TemplateTone = 'calm' | 'medium' | 'heavy';
type TemplateStatus = 'draft' | 'active' | 'archived';

interface TemplateData {
  key: string;
  channel: NotificationChannel;
  language: TemplateLanguage;
  tone: TemplateTone;
  name: string;
  description: string;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string;
  placeholders: string[];
  status: TemplateStatus;
  createdBy: string;
}

// ============================================
// GLOBAL PLACEHOLDERS (used across all templates)
// ============================================
// {CustomerName} - Customer's full name
// {CompanyName} - Creditor company name
// {Amount} - Debt amount (formatted with commas)
// {Currency} - Currency code (USD, ILS, etc.)
// {InvoiceNumber} - Invoice/reference number
// {DueDate} - Payment due date
// {DaysOverdue} - Number of days past due
// {PaymentLink} - Secure payment URL
// {SupportPhone} - Support phone number
// {SupportEmail} - Support email address
// {BusinessHours} - Support availability hours
// {CaseId} - Internal case reference
// {UnsubscribeText} - Opt-out instructions (SMS/WhatsApp)

// ============================================
// EMAIL TEMPLATES (HTML)
// ============================================

const emailTemplates: TemplateData[] = [
  // ----- CALM TONE -----
  {
    key: 'debt_reminder',
    channel: 'email',
    language: 'en',
    tone: 'calm',
    name: 'Friendly Payment Reminder (English)',
    description: 'Calm tone email reminder for initial contact - English',
    subject: 'Friendly payment reminder',
    bodyHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Payment Reminder</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 12px 0;font-size:20px;">Friendly payment reminder</h2>

      <p style="margin:0 0 12px 0;">Hi {CustomerName},</p>

      <p style="margin:0 0 12px 0;">
        A quick reminder that invoice <b>{InvoiceNumber}</b> for <b>{Currency} {Amount}</b> was due on <b>{DueDate}</b>.
        If you have already paid, please ignore this message.
      </p>

      <div style="margin:18px 0;">
        <a href="{PaymentLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
          Pay securely
        </a>
      </div>

      <p style="margin:0 0 12px 0;">
        Need help or want to confirm details? Reach us at {SupportPhone} or {SupportEmail} ({BusinessHours}).
      </p>

      <p style="margin:0;">
        Thanks,<br />
        {CompanyName}
      </p>

      <p style="margin:18px 0 0 0;font-size:12px;color:#666;">
        Reference: {CaseId}
      </p>
    </div>
  </div>
</body>
</html>`,
    bodyText: `Hi {CustomerName},

A quick reminder that invoice {InvoiceNumber} for {Currency} {Amount} was due on {DueDate}.
If you have already paid, please ignore this message.

Pay securely: {PaymentLink}

Need help or want to confirm details? Reach us at {SupportPhone} or {SupportEmail} ({BusinessHours}).

Thanks,
{CompanyName}

Reference: {CaseId}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DueDate', 'PaymentLink', 'SupportPhone', 'SupportEmail', 'BusinessHours', 'CompanyName', 'CaseId'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'email',
    language: 'he',
    tone: 'calm',
    name: 'תזכורת ידידותית לתשלום',
    description: 'Calm tone email reminder for initial contact - Hebrew',
    subject: 'תזכורת ידידותית לתשלום',
    bodyHtml: `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>תזכורת לתשלום</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6;text-align:right;">
      <h2 style="margin:0 0 12px 0;font-size:20px;">תזכורת ידידותית לתשלום</h2>

      <p style="margin:0 0 12px 0;">היי {CustomerName},</p>

      <p style="margin:0 0 12px 0;">
        תזכורת קצרה: חשבונית <b>{InvoiceNumber}</b> על סך <b>{Currency} {Amount}</b> הייתה אמורה להיות משולמת עד <b>{DueDate}</b>.
        אם כבר שילמת, אפשר להתעלם מההודעה.
      </p>

      <div style="margin:18px 0;">
        <a href="{PaymentLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
          לתשלום מאובטח
        </a>
      </div>

      <p style="margin:0 0 12px 0;">
        צריכים עזרה או אימות פרטים? אפשר ליצור קשר ב-{SupportPhone} או {SupportEmail} ({BusinessHours}).
      </p>

      <p style="margin:0;">
        תודה,<br />
        {CompanyName}
      </p>

      <p style="margin:18px 0 0 0;font-size:12px;color:#666;">
        אסמכתא: {CaseId}
      </p>
    </div>
  </div>
</body>
</html>`,
    bodyText: `היי {CustomerName},

תזכורת קצרה: חשבונית {InvoiceNumber} על סך {Currency} {Amount} הייתה אמורה להיות משולמת עד {DueDate}.
אם כבר שילמת, אפשר להתעלם מההודעה.

לתשלום מאובטח: {PaymentLink}

צריכים עזרה או אימות פרטים? אפשר ליצור קשר ב-{SupportPhone} או {SupportEmail} ({BusinessHours}).

תודה,
{CompanyName}

אסמכתא: {CaseId}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DueDate', 'PaymentLink', 'SupportPhone', 'SupportEmail', 'BusinessHours', 'CompanyName', 'CaseId'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'email',
    language: 'ar',
    tone: 'calm',
    name: 'تذكير ودي بالدفع',
    description: 'Calm tone email reminder for initial contact - Arabic',
    subject: 'تذكير ودي بالدفع',
    bodyHtml: `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>تذكير بالدفع</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.7;text-align:right;">
      <h2 style="margin:0 0 12px 0;font-size:20px;">تذكير ودي بالدفع</h2>

      <p style="margin:0 0 12px 0;">مرحباً {CustomerName}،</p>

      <p style="margin:0 0 12px 0;">
        تذكير سريع بأن الفاتورة <b>{InvoiceNumber}</b> بقيمة <b>{Currency} {Amount}</b> كان تاريخ استحقاقها <b>{DueDate}</b>.
        إذا تم الدفع بالفعل، يرجى تجاهل هذه الرسالة.
      </p>

      <div style="margin:18px 0;">
        <a href="{PaymentLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
          ادفع بأمان
        </a>
      </div>

      <p style="margin:0 0 12px 0;">
        هل تحتاج مساعدة أو تأكيد التفاصيل؟ تواصل معنا على {SupportPhone} أو {SupportEmail} ({BusinessHours}).
      </p>

      <p style="margin:0;">
        شكراً،<br />
        {CompanyName}
      </p>

      <p style="margin:18px 0 0 0;font-size:12px;color:#666;">
        مرجع: {CaseId}
      </p>
    </div>
  </div>
</body>
</html>`,
    bodyText: `مرحباً {CustomerName}،

تذكير سريع بأن الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} كان تاريخ استحقاقها {DueDate}.
إذا تم الدفع بالفعل، يرجى تجاهل هذه الرسالة.

ادفع بأمان: {PaymentLink}

هل تحتاج مساعدة أو تأكيد التفاصيل؟ تواصل معنا على {SupportPhone} أو {SupportEmail} ({BusinessHours}).

شكراً،
{CompanyName}

مرجع: {CaseId}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DueDate', 'PaymentLink', 'SupportPhone', 'SupportEmail', 'BusinessHours', 'CompanyName', 'CaseId'],
    status: 'active',
    createdBy: 'system'
  },

  // ----- MEDIUM TONE -----
  {
    key: 'debt_reminder',
    channel: 'email',
    language: 'en',
    tone: 'medium',
    name: 'Action Required: Outstanding Invoice (English)',
    description: 'Medium tone email reminder for follow-up - English',
    subject: 'Action Required: Outstanding Invoice',
    bodyHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Action Required: Outstanding Invoice</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 12px 0;font-size:20px;">Action required: outstanding invoice</h2>

      <p style="margin:0 0 12px 0;">Hi {CustomerName},</p>

      <p style="margin:0 0 12px 0;">
        Our records show invoice <b>{InvoiceNumber}</b> for <b>{Currency} {Amount}</b> is still unpaid and is now <b>{DaysOverdue}</b> days overdue
        (due date: <b>{DueDate}</b>).
      </p>

      <p style="margin:0 0 12px 0;">
        Please complete payment today or contact us if there is an issue so we can help.
      </p>

      <div style="margin:18px 0;">
        <a href="{PaymentLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
          Pay now
        </a>
      </div>

      <p style="margin:0 0 12px 0;">
        Support: {SupportPhone} | {SupportEmail} ({BusinessHours})
      </p>

      <p style="margin:0;">
        Regards,<br />
        {CompanyName}
      </p>

      <p style="margin:18px 0 0 0;font-size:12px;color:#666;">
        Reference: {CaseId}
      </p>
    </div>
  </div>
</body>
</html>`,
    bodyText: `Hi {CustomerName},

Our records show invoice {InvoiceNumber} for {Currency} {Amount} is still unpaid and is now {DaysOverdue} days overdue (due date: {DueDate}).

Please complete payment today or contact us if there is an issue so we can help.

Pay now: {PaymentLink}

Support: {SupportPhone} | {SupportEmail} ({BusinessHours})

Regards,
{CompanyName}

Reference: {CaseId}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'DueDate', 'PaymentLink', 'SupportPhone', 'SupportEmail', 'BusinessHours', 'CompanyName', 'CaseId'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'email',
    language: 'he',
    tone: 'medium',
    name: 'נדרש טיפול: חשבונית פתוחה',
    description: 'Medium tone email reminder for follow-up - Hebrew',
    subject: 'נדרש טיפול: חשבונית פתוחה',
    bodyHtml: `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>נדרש טיפול: חשבונית פתוחה</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6;text-align:right;">
      <h2 style="margin:0 0 12px 0;font-size:20px;">נדרש טיפול: חשבונית פתוחה</h2>

      <p style="margin:0 0 12px 0;">היי {CustomerName},</p>

      <p style="margin:0 0 12px 0;">
        לפי הרישומים שלנו, חשבונית <b>{InvoiceNumber}</b> על סך <b>{Currency} {Amount}</b> טרם שולמה והיא באיחור של <b>{DaysOverdue}</b> ימים
        (תאריך יעד: <b>{DueDate}</b>).
      </p>

      <p style="margin:0 0 12px 0;">
        נשמח שתשלים/י תשלום היום או ליצור איתנו קשר אם יש בעיה כדי שנוכל לעזור.
      </p>

      <div style="margin:18px 0;">
        <a href="{PaymentLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
          לתשלום עכשיו
        </a>
      </div>

      <p style="margin:0 0 12px 0;">
        תמיכה: {SupportPhone} | {SupportEmail} ({BusinessHours})
      </p>

      <p style="margin:0;">
        בברכה,<br />
        {CompanyName}
      </p>

      <p style="margin:18px 0 0 0;font-size:12px;color:#666;">
        אסמכתא: {CaseId}
      </p>
    </div>
  </div>
</body>
</html>`,
    bodyText: `היי {CustomerName},

לפי הרישומים שלנו, חשבונית {InvoiceNumber} על סך {Currency} {Amount} טרם שולמה והיא באיחור של {DaysOverdue} ימים (תאריך יעד: {DueDate}).

נשמח שתשלים/י תשלום היום או ליצור איתנו קשר אם יש בעיה כדי שנוכל לעזור.

לתשלום עכשיו: {PaymentLink}

תמיכה: {SupportPhone} | {SupportEmail} ({BusinessHours})

בברכה,
{CompanyName}

אסמכתא: {CaseId}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'DueDate', 'PaymentLink', 'SupportPhone', 'SupportEmail', 'BusinessHours', 'CompanyName', 'CaseId'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'email',
    language: 'ar',
    tone: 'medium',
    name: 'مطلوب إجراء: فاتورة غير مدفوعة',
    description: 'Medium tone email reminder for follow-up - Arabic',
    subject: 'مطلوب إجراء: فاتورة غير مدفوعة',
    bodyHtml: `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>مطلوب إجراء: فاتورة غير مدفوعة</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.7;text-align:right;">
      <h2 style="margin:0 0 12px 0;font-size:20px;">مطلوب إجراء: فاتورة غير مدفوعة</h2>

      <p style="margin:0 0 12px 0;">مرحباً {CustomerName}،</p>

      <p style="margin:0 0 12px 0;">
        تشير سجلاتنا إلى أن الفاتورة <b>{InvoiceNumber}</b> بقيمة <b>{Currency} {Amount}</b> لم يتم سدادها بعد، وهي متأخرة <b>{DaysOverdue}</b> يوماً
        (تاريخ الاستحقاق: <b>{DueDate}</b>).
      </p>

      <p style="margin:0 0 12px 0;">
        نرجو إتمام الدفع اليوم أو التواصل معنا إذا كانت هناك مشكلة لنساعدك.
      </p>

      <div style="margin:18px 0;">
        <a href="{PaymentLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
          ادفع الآن
        </a>
      </div>

      <p style="margin:0 0 12px 0;">
        الدعم: {SupportPhone} | {SupportEmail} ({BusinessHours})
      </p>

      <p style="margin:0;">
        مع التحية،<br />
        {CompanyName}
      </p>

      <p style="margin:18px 0 0 0;font-size:12px;color:#666;">
        مرجع: {CaseId}
      </p>
    </div>
  </div>
</body>
</html>`,
    bodyText: `مرحباً {CustomerName}،

تشير سجلاتنا إلى أن الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} لم يتم سدادها بعد، وهي متأخرة {DaysOverdue} يوماً (تاريخ الاستحقاق: {DueDate}).

نرجو إتمام الدفع اليوم أو التواصل معنا إذا كانت هناك مشكلة لنساعدك.

ادفع الآن: {PaymentLink}

الدعم: {SupportPhone} | {SupportEmail} ({BusinessHours})

مع التحية،
{CompanyName}

مرجع: {CaseId}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'DueDate', 'PaymentLink', 'SupportPhone', 'SupportEmail', 'BusinessHours', 'CompanyName', 'CaseId'],
    status: 'active',
    createdBy: 'system'
  },

  // ----- HEAVY TONE -----
  {
    key: 'debt_reminder',
    channel: 'email',
    language: 'en',
    tone: 'heavy',
    name: 'Final Notice: Immediate Attention Required (English)',
    description: 'Heavy tone email reminder for final notice - English',
    subject: 'Final Notice: Immediate Attention Required',
    bodyHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Final Notice: Immediate Attention Required</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 12px 0;font-size:20px;">Final notice: immediate attention required</h2>

      <p style="margin:0 0 12px 0;">Hi {CustomerName},</p>

      <p style="margin:0 0 12px 0;">
        Invoice <b>{InvoiceNumber}</b> for <b>{Currency} {Amount}</b> remains unpaid and is now <b>{DaysOverdue}</b> days overdue
        (due date: <b>{DueDate}</b>).
      </p>

      <p style="margin:0 0 12px 0;">
        Please complete payment immediately. If you believe there is an error, contact us today so we can review and resolve it.
      </p>

      <div style="margin:18px 0;">
        <a href="{PaymentLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
          Pay immediately
        </a>
      </div>

      <p style="margin:0 0 12px 0;">
        Contact: {SupportPhone} | {SupportEmail} ({BusinessHours})
      </p>

      <p style="margin:0;">
        {CompanyName}
      </p>

      <p style="margin:18px 0 0 0;font-size:12px;color:#666;">
        Reference: {CaseId}
      </p>
    </div>
  </div>
</body>
</html>`,
    bodyText: `Hi {CustomerName},

Invoice {InvoiceNumber} for {Currency} {Amount} remains unpaid and is now {DaysOverdue} days overdue (due date: {DueDate}).

Please complete payment immediately. If you believe there is an error, contact us today so we can review and resolve it.

Pay immediately: {PaymentLink}

Contact: {SupportPhone} | {SupportEmail} ({BusinessHours})

{CompanyName}

Reference: {CaseId}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'DueDate', 'PaymentLink', 'SupportPhone', 'SupportEmail', 'BusinessHours', 'CompanyName', 'CaseId'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'email',
    language: 'he',
    tone: 'heavy',
    name: 'התראה אחרונה: נדרש טיפול מיידי',
    description: 'Heavy tone email reminder for final notice - Hebrew',
    subject: 'התראה אחרונה: נדרש טיפול מיידי',
    bodyHtml: `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>התראה אחרונה: נדרש טיפול מיידי</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6;text-align:right;">
      <h2 style="margin:0 0 12px 0;font-size:20px;">התראה אחרונה: נדרש טיפול מיידי</h2>

      <p style="margin:0 0 12px 0;">היי {CustomerName},</p>

      <p style="margin:0 0 12px 0;">
        חשבונית <b>{InvoiceNumber}</b> על סך <b>{Currency} {Amount}</b> עדיין לא שולמה והיא באיחור של <b>{DaysOverdue}</b> ימים
        (תאריך יעד: <b>{DueDate}</b>).
      </p>

      <p style="margin:0 0 12px 0;">
        נשמח שתשלים/י תשלום באופן מיידי. אם יש טעות או מחלוקת, אנא צרו קשר עוד היום כדי שנוכל לבדוק ולפתור.
      </p>

      <div style="margin:18px 0;">
        <a href="{PaymentLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
          לתשלום מיידי
        </a>
      </div>

      <p style="margin:0 0 12px 0;">
        קשר: {SupportPhone} | {SupportEmail} ({BusinessHours})
      </p>

      <p style="margin:0;">
        {CompanyName}
      </p>

      <p style="margin:18px 0 0 0;font-size:12px;color:#666;">
        אסמכתא: {CaseId}
      </p>
    </div>
  </div>
</body>
</html>`,
    bodyText: `היי {CustomerName},

חשבונית {InvoiceNumber} על סך {Currency} {Amount} עדיין לא שולמה והיא באיחור של {DaysOverdue} ימים (תאריך יעד: {DueDate}).

נשמח שתשלים/י תשלום באופן מיידי. אם יש טעות או מחלוקת, אנא צרו קשר עוד היום כדי שנוכל לבדוק ולפתור.

לתשלום מיידי: {PaymentLink}

קשר: {SupportPhone} | {SupportEmail} ({BusinessHours})

{CompanyName}

אסמכתא: {CaseId}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'DueDate', 'PaymentLink', 'SupportPhone', 'SupportEmail', 'BusinessHours', 'CompanyName', 'CaseId'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'email',
    language: 'ar',
    tone: 'heavy',
    name: 'إشعار أخير: مطلوب إجراء فوري',
    description: 'Heavy tone email reminder for final notice - Arabic',
    subject: 'إشعار أخير: مطلوب إجراء فوري',
    bodyHtml: `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>إشعار أخير: مطلوب إجراء فوري</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.7;text-align:right;">
      <h2 style="margin:0 0 12px 0;font-size:20px;">إشعار أخير: مطلوب إجراء فوري</h2>

      <p style="margin:0 0 12px 0;">مرحباً {CustomerName}،</p>

      <p style="margin:0 0 12px 0;">
        لا تزال الفاتورة <b>{InvoiceNumber}</b> بقيمة <b>{Currency} {Amount}</b> غير مدفوعة، وهي متأخرة <b>{DaysOverdue}</b> يوماً
        (تاريخ الاستحقاق: <b>{DueDate}</b>).
      </p>

      <p style="margin:0 0 12px 0;">
        يرجى إتمام الدفع فوراً. إذا كنت تعتقد بوجود خطأ أو نزاع، تواصل معنا اليوم لمراجعة الأمر وحله.
      </p>

      <div style="margin:18px 0;">
        <a href="{PaymentLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
          ادفع فوراً
        </a>
      </div>

      <p style="margin:0 0 12px 0;">
        للتواصل: {SupportPhone} | {SupportEmail} ({BusinessHours})
      </p>

      <p style="margin:0;">
        {CompanyName}
      </p>

      <p style="margin:18px 0 0 0;font-size:12px;color:#666;">
        مرجع: {CaseId}
      </p>
    </div>
  </div>
</body>
</html>`,
    bodyText: `مرحباً {CustomerName}،

لا تزال الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} غير مدفوعة، وهي متأخرة {DaysOverdue} يوماً (تاريخ الاستحقاق: {DueDate}).

يرجى إتمام الدفع فوراً. إذا كنت تعتقد بوجود خطأ أو نزاع، تواصل معنا اليوم لمراجعة الأمر وحله.

ادفع فوراً: {PaymentLink}

للتواصل: {SupportPhone} | {SupportEmail} ({BusinessHours})

{CompanyName}

مرجع: {CaseId}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'DueDate', 'PaymentLink', 'SupportPhone', 'SupportEmail', 'BusinessHours', 'CompanyName', 'CaseId'],
    status: 'active',
    createdBy: 'system'
  }
];

// ============================================
// SMS / WHATSAPP TEMPLATES (Text Only)
// ============================================

const smsWhatsAppTemplates: TemplateData[] = [
  // ----- CALM TONE -----
  {
    key: 'debt_reminder',
    channel: 'sms',
    language: 'en',
    tone: 'calm',
    name: 'Friendly SMS Reminder (English)',
    description: 'Calm tone SMS reminder - English',
    subject: null,
    bodyHtml: null,
    bodyText: `Hi {CustomerName}, a quick reminder that invoice {InvoiceNumber} for {Currency} {Amount} was due on {DueDate}.
Pay here: {PaymentLink}
Need help? {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DueDate', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'sms',
    language: 'he',
    tone: 'calm',
    name: 'תזכורת SMS ידידותית',
    description: 'Calm tone SMS reminder - Hebrew',
    subject: null,
    bodyHtml: null,
    bodyText: `תזכורת: {Currency} {Amount} לתשלום. {PaymentLink}`,
    placeholders: ['Currency', 'Amount', 'PaymentLink'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'sms',
    language: 'ar',
    tone: 'calm',
    name: 'تذكير SMS ودي',
    description: 'Calm tone SMS reminder - Arabic',
    subject: null,
    bodyHtml: null,
    bodyText: `مرحباً {CustomerName}، تذكير سريع بأن الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} كان تاريخ استحقاقها {DueDate}.
للدفع: {PaymentLink}
للمساعدة: {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DueDate', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },

  // ----- MEDIUM TONE -----
  {
    key: 'debt_reminder',
    channel: 'sms',
    language: 'en',
    tone: 'medium',
    name: 'Overdue SMS Notice (English)',
    description: 'Medium tone SMS reminder - English',
    subject: null,
    bodyHtml: null,
    bodyText: `Hi {CustomerName}, invoice {InvoiceNumber} for {Currency} {Amount} is now {DaysOverdue} days overdue (due {DueDate}).
Please pay today: {PaymentLink}
Support: {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'DueDate', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'sms',
    language: 'he',
    tone: 'medium',
    name: 'הודעת SMS על איחור',
    description: 'Medium tone SMS reminder - Hebrew',
    subject: null,
    bodyHtml: null,
    bodyText: `{Currency} {Amount} באיחור. לתשלום: {PaymentLink}`,
    placeholders: ['Currency', 'Amount', 'PaymentLink'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'sms',
    language: 'ar',
    tone: 'medium',
    name: 'إشعار SMS بالتأخير',
    description: 'Medium tone SMS reminder - Arabic',
    subject: null,
    bodyHtml: null,
    bodyText: `مرحباً {CustomerName}، الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} متأخرة {DaysOverdue} يوماً (الاستحقاق {DueDate}).
يرجى الدفع اليوم: {PaymentLink}
الدعم: {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'DueDate', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },

  // ----- HEAVY TONE -----
  {
    key: 'debt_reminder',
    channel: 'sms',
    language: 'en',
    tone: 'heavy',
    name: 'Final SMS Reminder (English)',
    description: 'Heavy tone SMS reminder - English',
    subject: null,
    bodyHtml: null,
    bodyText: `Final reminder: invoice {InvoiceNumber} for {Currency} {Amount} is overdue ({DaysOverdue} days). Please pay immediately: {PaymentLink}
If there is an issue, contact us today: {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'sms',
    language: 'he',
    tone: 'heavy',
    name: 'התראת SMS אחרונה',
    description: 'Heavy tone SMS reminder - Hebrew',
    subject: null,
    bodyHtml: null,
    bodyText: `דחוף: {Currency} {Amount}. שלמו עכשיו: {PaymentLink}`,
    placeholders: ['Currency', 'Amount', 'PaymentLink'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'sms',
    language: 'ar',
    tone: 'heavy',
    name: 'إشعار SMS أخير',
    description: 'Heavy tone SMS reminder - Arabic',
    subject: null,
    bodyHtml: null,
    bodyText: `إشعار أخير: الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} متأخرة ({DaysOverdue} يوماً). يرجى الدفع فوراً: {PaymentLink}
إذا كانت هناك مشكلة، تواصل معنا اليوم: {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },

  // WhatsApp templates (same content as SMS)
  {
    key: 'debt_reminder',
    channel: 'whatsapp',
    language: 'en',
    tone: 'calm',
    name: 'Friendly WhatsApp Reminder (English)',
    description: 'Calm tone WhatsApp reminder - English',
    subject: null,
    bodyHtml: null,
    bodyText: `Hi {CustomerName}, a quick reminder that invoice {InvoiceNumber} for {Currency} {Amount} was due on {DueDate}.
Pay here: {PaymentLink}
Need help? {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DueDate', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'whatsapp',
    language: 'he',
    tone: 'calm',
    name: 'תזכורת WhatsApp ידידותית',
    description: 'Calm tone WhatsApp reminder - Hebrew',
    subject: null,
    bodyHtml: null,
    bodyText: `היי {CustomerName}, תזכורת: {Currency} {Amount} לתשלום.
{PaymentLink}`,
    placeholders: ['CustomerName', 'Currency', 'Amount', 'PaymentLink'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'whatsapp',
    language: 'ar',
    tone: 'calm',
    name: 'تذكير WhatsApp ودي',
    description: 'Calm tone WhatsApp reminder - Arabic',
    subject: null,
    bodyHtml: null,
    bodyText: `مرحباً {CustomerName}، تذكير سريع بأن الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} كان تاريخ استحقاقها {DueDate}.
للدفع: {PaymentLink}
للمساعدة: {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DueDate', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'whatsapp',
    language: 'en',
    tone: 'medium',
    name: 'Overdue WhatsApp Notice (English)',
    description: 'Medium tone WhatsApp reminder - English',
    subject: null,
    bodyHtml: null,
    bodyText: `Hi {CustomerName}, invoice {InvoiceNumber} for {Currency} {Amount} is now {DaysOverdue} days overdue (due {DueDate}).
Please pay today: {PaymentLink}
Support: {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'DueDate', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'whatsapp',
    language: 'he',
    tone: 'medium',
    name: 'הודעת WhatsApp על איחור',
    description: 'Medium tone WhatsApp reminder - Hebrew',
    subject: null,
    bodyHtml: null,
    bodyText: `{CustomerName}, {Currency} {Amount} באיחור. לתשלום היום:
{PaymentLink}`,
    placeholders: ['CustomerName', 'Currency', 'Amount', 'PaymentLink'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'whatsapp',
    language: 'ar',
    tone: 'medium',
    name: 'إشعار WhatsApp بالتأخير',
    description: 'Medium tone WhatsApp reminder - Arabic',
    subject: null,
    bodyHtml: null,
    bodyText: `مرحباً {CustomerName}، الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} متأخرة {DaysOverdue} يوماً (الاستحقاق {DueDate}).
يرجى الدفع اليوم: {PaymentLink}
الدعم: {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['CustomerName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'DueDate', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'whatsapp',
    language: 'en',
    tone: 'heavy',
    name: 'Final WhatsApp Reminder (English)',
    description: 'Heavy tone WhatsApp reminder - English',
    subject: null,
    bodyHtml: null,
    bodyText: `Final reminder: invoice {InvoiceNumber} for {Currency} {Amount} is overdue ({DaysOverdue} days). Please pay immediately: {PaymentLink}
If there is an issue, contact us today: {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'whatsapp',
    language: 'he',
    tone: 'heavy',
    name: 'התראת WhatsApp אחרונה',
    description: 'Heavy tone WhatsApp reminder - Hebrew',
    subject: null,
    bodyHtml: null,
    bodyText: `התראה: {Currency} {Amount}. לתשלום מיידי:
{PaymentLink}`,
    placeholders: ['Currency', 'Amount', 'PaymentLink'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'whatsapp',
    language: 'ar',
    tone: 'heavy',
    name: 'إشعار WhatsApp أخير',
    description: 'Heavy tone WhatsApp reminder - Arabic',
    subject: null,
    bodyHtml: null,
    bodyText: `إشعار أخير: الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} متأخرة ({DaysOverdue} يوماً). يرجى الدفع فوراً: {PaymentLink}
إذا كانت هناك مشكلة، تواصل معنا اليوم: {SupportPhone}. {UnsubscribeText}`,
    placeholders: ['InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue', 'PaymentLink', 'SupportPhone', 'UnsubscribeText'],
    status: 'active',
    createdBy: 'system'
  }
];

// ============================================
// VOICE CALL TEMPLATES (Kosher Voice Scripts)
// ============================================
// Notes for voice implementation:
// - Plain voice, no music, no jokes, no slang
// - Use [pause Xs] markers for pauses
// - Key confirmation: "Press 1 for payment link, Press 2 for support"

const voiceTemplates: TemplateData[] = [
  // ----- CALM TONE -----
  {
    key: 'debt_reminder',
    channel: 'call_task',
    language: 'en',
    tone: 'calm',
    name: 'Friendly Voice Reminder (English)',
    description: 'Calm tone voice call script - English (kosher voice)',
    subject: null,
    bodyHtml: null,
    bodyText: `Hello {CustomerName}. This is an automated call from {CompanyName}. [pause 1s]
This is a friendly reminder that invoice {InvoiceNumber} for {Currency} {Amount} was due on {DueDate}. [pause 1s]
To receive a secure payment link by message, press 1. To speak with support, press 2. [pause 1s]
You can also call us at {SupportPhone}. Thank you.`,
    placeholders: ['CustomerName', 'CompanyName', 'InvoiceNumber', 'Currency', 'Amount', 'DueDate', 'SupportPhone'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'call_task',
    language: 'he',
    tone: 'calm',
    name: 'שיחה קולית ידידותית',
    description: 'Calm tone voice call script - Hebrew (kosher voice)',
    subject: null,
    bodyHtml: null,
    bodyText: `שלום {CustomerName}. זו שיחה אוטומטית מ-{CompanyName}. [pause 1s]
תזכורת ידידותית: חשבונית {InvoiceNumber} על סך {Currency} {Amount} הייתה אמורה להיות משולמת עד {DueDate}. [pause 1s]
לקבלת לינק לתשלום בהודעה, הקש/י 1. לשיחה עם תמיכה, הקש/י 2. [pause 1s]
אפשר גם להתקשר אלינו: {SupportPhone}. תודה.`,
    placeholders: ['CustomerName', 'CompanyName', 'InvoiceNumber', 'Currency', 'Amount', 'DueDate', 'SupportPhone'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'call_task',
    language: 'ar',
    tone: 'calm',
    name: 'مكالمة صوتية ودية',
    description: 'Calm tone voice call script - Arabic (kosher voice)',
    subject: null,
    bodyHtml: null,
    bodyText: `مرحباً {CustomerName}. هذه مكالمة آلية من {CompanyName}. [pause 1s]
تذكير ودي بأن الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} كان تاريخ استحقاقها {DueDate}. [pause 1s]
لإرسال رابط دفع آمن برسالة، اضغط 1. للتحدث مع الدعم، اضغط 2. [pause 1s]
يمكنك أيضاً الاتصال بنا على {SupportPhone}. شكراً لك.`,
    placeholders: ['CustomerName', 'CompanyName', 'InvoiceNumber', 'Currency', 'Amount', 'DueDate', 'SupportPhone'],
    status: 'active',
    createdBy: 'system'
  },

  // ----- MEDIUM TONE -----
  {
    key: 'debt_reminder',
    channel: 'call_task',
    language: 'en',
    tone: 'medium',
    name: 'Overdue Voice Notice (English)',
    description: 'Medium tone voice call script - English (kosher voice)',
    subject: null,
    bodyHtml: null,
    bodyText: `Hello {CustomerName}. This is {CompanyName}. [pause 1s]
Our records show invoice {InvoiceNumber} for {Currency} {Amount} is {DaysOverdue} days overdue. [pause 1s]
Please arrange payment today. To receive a secure payment link by message, press 1. For support, press 2. [pause 1s]
Thank you.`,
    placeholders: ['CustomerName', 'CompanyName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'call_task',
    language: 'he',
    tone: 'medium',
    name: 'שיחה קולית על איחור',
    description: 'Medium tone voice call script - Hebrew (kosher voice)',
    subject: null,
    bodyHtml: null,
    bodyText: `שלום {CustomerName}. כאן {CompanyName}. [pause 1s]
לפי הרישומים שלנו, חשבונית {InvoiceNumber} על סך {Currency} {Amount} באיחור של {DaysOverdue} ימים. [pause 1s]
נשמח להסדרת התשלום היום. לקבלת לינק לתשלום בהודעה, הקש/י 1. לתמיכה, הקש/י 2. [pause 1s]
תודה.`,
    placeholders: ['CustomerName', 'CompanyName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'call_task',
    language: 'ar',
    tone: 'medium',
    name: 'مكالمة صوتية بالتأخير',
    description: 'Medium tone voice call script - Arabic (kosher voice)',
    subject: null,
    bodyHtml: null,
    bodyText: `مرحباً {CustomerName}. معك {CompanyName}. [pause 1s]
تشير سجلاتنا إلى أن الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} متأخرة {DaysOverdue} يوماً. [pause 1s]
يرجى ترتيب الدفع اليوم. لإرسال رابط دفع برسالة، اضغط 1. للدعم، اضغط 2. [pause 1s]
شكراً لك.`,
    placeholders: ['CustomerName', 'CompanyName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue'],
    status: 'active',
    createdBy: 'system'
  },

  // ----- HEAVY TONE -----
  {
    key: 'debt_reminder',
    channel: 'call_task',
    language: 'en',
    tone: 'heavy',
    name: 'Final Voice Reminder (English)',
    description: 'Heavy tone voice call script - English (kosher voice)',
    subject: null,
    bodyHtml: null,
    bodyText: `Hello {CustomerName}. This is {CompanyName}. [pause 1s]
This is a final reminder. Invoice {InvoiceNumber} for {Currency} {Amount} remains unpaid and is overdue by {DaysOverdue} days. [pause 1s]
Please pay immediately. To receive a secure payment link by message, press 1. To speak with support today, press 2. [pause 1s]
Thank you.`,
    placeholders: ['CustomerName', 'CompanyName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'call_task',
    language: 'he',
    tone: 'heavy',
    name: 'שיחת התראה אחרונה',
    description: 'Heavy tone voice call script - Hebrew (kosher voice)',
    subject: null,
    bodyHtml: null,
    bodyText: `שלום {CustomerName}. כאן {CompanyName}. [pause 1s]
זו התראה אחרונה. חשבונית {InvoiceNumber} על סך {Currency} {Amount} עדיין לא שולמה והיא באיחור של {DaysOverdue} ימים. [pause 1s]
נא להסדיר תשלום מיידית. לקבלת לינק לתשלום בהודעה, הקש/י 1. לתמיכה היום, הקש/י 2. [pause 1s]
תודה.`,
    placeholders: ['CustomerName', 'CompanyName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue'],
    status: 'active',
    createdBy: 'system'
  },
  {
    key: 'debt_reminder',
    channel: 'call_task',
    language: 'ar',
    tone: 'heavy',
    name: 'مكالمة إشعار أخير',
    description: 'Heavy tone voice call script - Arabic (kosher voice)',
    subject: null,
    bodyHtml: null,
    bodyText: `مرحباً {CustomerName}. هذه {CompanyName}. [pause 1s]
هذا تذكير أخير. الفاتورة {InvoiceNumber} بقيمة {Currency} {Amount} ما زالت غير مدفوعة وهي متأخرة {DaysOverdue} يوماً. [pause 1s]
يرجى الدفع فوراً. لإرسال رابط دفع برسالة، اضغط 1. للتحدث مع الدعم اليوم، اضغط 2. [pause 1s]
شكراً لك.`,
    placeholders: ['CustomerName', 'CompanyName', 'InvoiceNumber', 'Currency', 'Amount', 'DaysOverdue'],
    status: 'active',
    createdBy: 'system'
  }
];

// ============================================
// SEED FUNCTION
// ============================================

export async function seedTemplates() {
  console.log('🌱 Seeding message templates...');

  const allTemplates = [
    ...emailTemplates,
    ...smsWhatsAppTemplates,
    ...voiceTemplates
  ];

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const template of allTemplates) {
    try {
      // Check if template already exists
      const existing = await prisma.messageTemplate.findFirst({
        where: {
          key: template.key,
          channel: template.channel,
          language: template.language as any,
          tone: template.tone as any
        }
      });

      if (existing) {
        // Update existing template
        await prisma.messageTemplate.update({
          where: { id: existing.id },
          data: {
            name: template.name,
            description: template.description,
            subject: template.subject,
            bodyHtml: template.bodyHtml,
            bodyText: template.bodyText,
            placeholders: template.placeholders,
            status: template.status as any
          }
        });
        updated++;
        continue;
      }

      // Create new template
      await prisma.messageTemplate.create({
        data: {
          key: template.key,
          channel: template.channel,
          language: template.language as any,
          tone: template.tone as any,
          name: template.name,
          description: template.description,
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          bodyText: template.bodyText,
          placeholders: template.placeholders,
          status: template.status as any,
          createdBy: template.createdBy
        }
      });
      created++;
    } catch (error) {
      failed++;
      console.error(`Failed to create/update template: ${template.name}`, error);
    }
  }

  console.log(`✅ Templates seeded: ${created} created, ${updated} updated`);
  console.log(`   Total templates: ${allTemplates.length}`);
  console.log(`   - Email: ${emailTemplates.length}`);
  console.log(`   - SMS/WhatsApp: ${smsWhatsAppTemplates.length}`);
  console.log(`   - Voice: ${voiceTemplates.length}`);

  if (failed > 0) {
    throw new Error(`Template seed failed for ${failed} template(s)`);
  }
}

// Run if executed directly
if (require.main === module) {
  seedTemplates()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}

export default seedTemplates;
