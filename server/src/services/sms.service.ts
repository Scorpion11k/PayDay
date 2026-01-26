import twilio from 'twilio';

export interface SMSOptions {
  to: string;
  message: string;
}

export interface SMSResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

class SMSService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string = '';
  private initialized = false;

  /**
   * Initialize Twilio client for SMS
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const smsNumber = process.env.TWILIO_SMS_NUMBER;

    if (!accountSid || !authToken || !smsNumber) {
      console.warn('⚠️ SMS service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SMS_NUMBER in .env');
      return;
    }

    try {
      this.client = twilio(accountSid, authToken);
      this.fromNumber = smsNumber;
      
      // Test connection
      await this.client.api.accounts(accountSid).fetch();
      
      console.log('✅ SMS service initialized');
      this.initialized = true;
    } catch (error) {
      console.error('❌ SMS service connection failed:', error);
      this.client = null;
    }
  }

  /**
   * Check if SMS service is available
   */
  isAvailable(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Send an SMS message
   */
  async sendSMS(options: SMSOptions): Promise<SMSResult> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      // Only set statusCallback if BASE_URL is a public URL (not localhost)
      // Twilio requires publicly accessible callback URLs
      const baseUrl = process.env.BASE_URL;
      const isPublicUrl = baseUrl && 
        !baseUrl.includes('localhost') && 
        !baseUrl.includes('127.0.0.1');

      const result = await this.client.messages.create({
        body: options.message,
        from: this.fromNumber,
        to: this.formatPhoneNumber(options.to),
        statusCallback: isPublicUrl 
          ? `${baseUrl}/api/messaging/sms-status`
          : undefined
      });

      console.log('📱 SMS sent:', result.sid);
      return { success: true, messageSid: result.sid };
    } catch (error) {
      console.error('❌ Failed to send SMS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Format phone number for SMS
   * Ensures the number starts with country code
   */
  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If it doesn't start with +, add country code
    if (!cleaned.startsWith('+')) {
      // If it starts with 0, assume Israeli number
      if (cleaned.startsWith('0')) {
        cleaned = '+972' + cleaned.substring(1);
      } else if (cleaned.length === 10) {
        // Assume US number
        cleaned = '+1' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }

    return cleaned;
  }
}

export default new SMSService();
