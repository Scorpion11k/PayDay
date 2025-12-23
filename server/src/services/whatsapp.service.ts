import twilio from 'twilio';

export interface WhatsAppOptions {
  to: string;
  message: string;
}

export interface DebtReminderData {
  customerName: string;
  phone: string;
  totalDebt?: number;
  currency?: string;
  dueDate?: string;
}

class WhatsAppService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string = '';
  private initialized = false;

  /**
   * Initialize Twilio client for WhatsApp
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !whatsappNumber) {
      console.warn('⚠️ WhatsApp service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER in .env');
      return;
    }

    try {
      this.client = twilio(accountSid, authToken);
      this.fromNumber = whatsappNumber;
      
      // Test connection by fetching account info
      await this.client.api.accounts(accountSid).fetch();
      
      console.log('✅ WhatsApp (Twilio) service connected successfully');
      this.initialized = true;
    } catch (error) {
      console.error('❌ WhatsApp service connection failed:', error);
      this.client = null;
    }
  }

  /**
   * Check if WhatsApp service is available
   */
  isAvailable(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Format phone number for WhatsApp
   * Ensures the number starts with country code
   */
  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +, assume it needs one
    if (!cleaned.startsWith('+')) {
      // If it starts with 0, remove it and add country code
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      // Default to US country code if no code provided
      // You might want to make this configurable
      if (cleaned.length === 10) {
        cleaned = '+1' + cleaned;
      } else if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
      }
    }
    
    return `whatsapp:${cleaned}`;
  }

  /**
   * Send a WhatsApp message
   */
  async sendMessage(options: WhatsAppOptions): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      return { success: false, error: 'WhatsApp service not configured' };
    }

    try {
      const message = await this.client.messages.create({
        body: options.message,
        from: `whatsapp:${this.fromNumber}`,
        to: this.formatPhoneNumber(options.to),
      });

      console.log('📱 WhatsApp message sent:', message.sid);
      return { success: true, messageSid: message.sid };
    } catch (error) {
      console.error('❌ Failed to send WhatsApp message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send a debt payment reminder via WhatsApp
   */
  async sendDebtReminder(data: DebtReminderData): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    let message = `🔔 *Payment Reminder*\n\n`;
    message += `Dear ${data.customerName},\n\n`;
    message += `This is a friendly reminder about your outstanding balance.\n\n`;
    
    if (data.totalDebt) {
      message += `💰 *Amount Due:* ${data.currency || 'USD'} ${data.totalDebt.toLocaleString()}\n`;
    }
    
    if (data.dueDate) {
      message += `📅 *Due Date:* ${data.dueDate}\n`;
    }
    
    message += `\nPlease make your payment at your earliest convenience to avoid any additional fees.\n\n`;
    message += `If you have already made the payment, please disregard this message.\n\n`;
    message += `_PayDay AI Collection System_`;

    return this.sendMessage({
      to: data.phone,
      message,
    });
  }
}

export default new WhatsAppService();

