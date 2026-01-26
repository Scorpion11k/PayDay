import twilio from 'twilio';

export interface VoiceCallOptions {
  to: string;
  twimlUrl: string;
  notificationId?: string;
}

export interface VoiceCallResult {
  success: boolean;
  callSid?: string;
  error?: string;
}

class VoiceService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string = '';
  private initialized = false;

  /**
   * Initialize Twilio client for Voice
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const voiceNumber = process.env.TWILIO_VOICE_NUMBER;

    if (!accountSid || !authToken || !voiceNumber) {
      console.warn('⚠️ Voice service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VOICE_NUMBER in .env');
      return;
    }

    try {
      this.client = twilio(accountSid, authToken);
      this.fromNumber = voiceNumber;
      
      // Test connection
      await this.client.api.accounts(accountSid).fetch();
      
      console.log('✅ Voice service initialized');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Voice service connection failed:', error);
      this.client = null;
    }
  }

  /**
   * Check if Voice service is available
   */
  isAvailable(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Make an outbound voice call
   */
  async makeCall(options: VoiceCallOptions): Promise<VoiceCallResult> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      return { success: false, error: 'Voice service not configured' };
    }

    try {
      const callOptions: Parameters<typeof this.client.calls.create>[0] = {
        to: this.formatPhoneNumber(options.to),
        from: this.fromNumber,
        url: options.twimlUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        machineDetection: 'DetectMessageEnd' as const,
      };

      // Only add status callbacks if BASE_URL is a public URL (not localhost)
      // Twilio requires publicly accessible callback URLs
      const baseUrl = process.env.BASE_URL;
      const isPublicUrl = baseUrl && 
        !baseUrl.includes('localhost') && 
        !baseUrl.includes('127.0.0.1');

      if (isPublicUrl) {
        callOptions.statusCallback = `${baseUrl}/api/voice/status`;
        callOptions.asyncAmd = 'true';
        callOptions.asyncAmdStatusCallback = `${baseUrl}/api/voice/amd`;
      }

      const call = await this.client.calls.create(callOptions);

      console.log('📞 Voice call initiated:', call.sid);
      return { success: true, callSid: call.sid };
    } catch (error) {
      console.error('❌ Failed to make voice call:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Format phone number for voice calls
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

export default new VoiceService();
