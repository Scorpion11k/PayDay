import nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface DebtReminderData {
  customerName: string;
  email: string;
  totalDebt?: number;
  currency?: string;
  dueDate?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private initialized = false;

  /**
   * Initialize the email transporter
   * Uses Gmail SMTP by default
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      console.warn('⚠️ Email service not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    // Verify connection
    try {
      await this.transporter.verify();
      console.log('✅ Email service connected successfully');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      this.transporter = null;
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable(): boolean {
    return this.initialized && this.transporter !== null;
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.transporter) {
      await this.initialize();
    }

    if (!this.transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"PayDay AI" <${process.env.GMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log('📧 Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send a debt payment reminder email
   */
  async sendDebtReminder(data: DebtReminderData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const subject = 'Payment Reminder - PayDay AI';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e3a5f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .footer { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .amount { font-size: 24px; color: #1e3a5f; font-weight: bold; }
    .button { display: inline-block; background-color: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">PayDay AI</h1>
      <p style="margin: 5px 0 0 0;">Payment Reminder</p>
    </div>
    <div class="content">
      <p>Dear <strong>${data.customerName}</strong>,</p>
      
      <p>This is a friendly reminder about your outstanding balance.</p>
      
      ${data.totalDebt ? `
      <p style="text-align: center; margin: 30px 0;">
        <span class="amount">${data.currency || '₪'} ${data.totalDebt.toLocaleString()}</span>
        <br><small>Outstanding Balance</small>
      </p>
      ` : ''}
      
      ${data.dueDate ? `<p><strong>Due Date:</strong> ${data.dueDate}</p>` : ''}
      
      <p>Please make your payment at your earliest convenience to avoid any additional fees or service interruptions.</p>
      
      <p>If you have already made the payment, please disregard this message. If you have any questions or need to discuss payment arrangements, please don't hesitate to contact us.</p>
      
      <p style="text-align: center;">
        <a href="#" class="button">Make Payment</a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated message from PayDay AI Collection System.</p>
      <p>If you believe you received this message in error, please contact our support team.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Dear ${data.customerName},

This is a friendly reminder about your outstanding balance.

${data.totalDebt ? `Outstanding Balance: ${data.currency || '₪'} ${data.totalDebt.toLocaleString()}` : ''}
${data.dueDate ? `Due Date: ${data.dueDate}` : ''}

Please make your payment at your earliest convenience to avoid any additional fees or service interruptions.

If you have already made the payment, please disregard this message.

Best regards,
PayDay AI Collection Team
    `;

    return this.sendEmail({
      to: data.email,
      subject,
      text,
      html,
    });
  }
}

export default new EmailService();

