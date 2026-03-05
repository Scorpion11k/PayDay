import { Prisma } from '@prisma/client';
import prisma from '../config/database';

export interface KolKasherCallOptions {
  to: string;
  message: string;
  customerName?: string;
  description?: string;
  customerId: string;
  notificationId?: string;
  retries?: number;
  retryDifferenceMinutes?: number;
}

export interface KolKasherCallResult {
  success: boolean;
  callId?: string;
  statusCode?: number;
  statusMessage?: string;
  voiceCallLogId?: string;
  error?: string;
}

interface KolKasherApiResponse {
  StatusCode: number;
  StatusMessage: string;
  Result?: number;
  result?: number;
  Msg?: string;
  ResData?: {
    Result?: number;
    HafalaID?: number;
    Msg?: string;
  };
}

class KolKasherService {
  private dnis: string = '';
  private password: string = '';
  private apiUrl: string = '';
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.dnis = process.env.KOL_KASHER_DNIS || '';
    this.password = process.env.KOL_KASHER_PASSWORD || '';
    this.apiUrl = process.env.KOL_KASHER_API_URL || 'https://api.kolkasher.co.il/api/KK/SendCalls';

    if (!this.dnis || !this.password) {
      console.warn('⚠️ Kol Kasher service not configured. Set KOL_KASHER_DNIS and KOL_KASHER_PASSWORD in .env');
      return;
    }

    console.log('✅ Kol Kasher voice service initialized');
    this.initialized = true;
  }

  isAvailable(): boolean {
    return this.initialized && !!this.dnis && !!this.password;
  }

  async sendVoiceCall(options: KolKasherCallOptions): Promise<KolKasherCallResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isAvailable()) {
      return { success: false, error: 'Kol Kasher service not configured' };
    }

    const phone = this.formatPhoneForKolKasher(options.to);
    const retries = options.retries ?? 3;
    const retryDiff = options.retryDifferenceMinutes ?? 10;

    const requestPayload = {
      dnis: this.dnis,
      password: this.password,
      data: {
        Tels: [{
          Tel: phone,
          FName: options.customerName?.split(' ')[0] || '',
          LName: options.customerName?.split(' ').slice(1).join(' ') || '',
        }],
        RecordingType: 2,
        Recording: options.message,
        SendDescrip: options.description || 'PayDay Voice Notification',
        StartTime: '',
        Retries: retries,
        RetryDifference: retryDiff,
        AlloweSendLate: 0,
        SendReport: 0,
      },
    };

    const baseUrl = process.env.BASE_URL;
    const isPublicUrl = baseUrl && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1');
    if (isPublicUrl) {
      (requestPayload.data as Record<string, unknown>).StatusCallback = `${baseUrl}/api/voice/kol-kasher/callback`;
    }

    let voiceCallLog;
    try {
      voiceCallLog = await prisma.voiceCallLog.create({
        data: {
          customerId: options.customerId,
          notificationId: options.notificationId || null,
          phone,
          messageText: options.message,
          description: options.description || 'PayDay Voice Notification',
          status: 'sending',
          retries,
        },
      });
    } catch (dbError) {
      console.error('❌ Failed to create voice call log:', dbError);
      return { success: false, error: 'Failed to create call log record' };
    }

    try {
      console.log(`📞 Kol Kasher: Sending voice call to ${phone}...`);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      let apiResponse: KolKasherApiResponse;
      const responseText = await response.text();

      try {
        apiResponse = JSON.parse(responseText);
      } catch {
        await prisma.voiceCallLog.update({
          where: { id: voiceCallLog.id },
          data: {
            status: 'error',
            statusCode: response.status,
            errorMessage: `Invalid API response: ${responseText.substring(0, 500)}`,
            apiResponseBody: { raw: responseText.substring(0, 1000) },
          },
        });

        console.error(`❌ Kol Kasher: Invalid JSON response (HTTP ${response.status})`);
        return {
          success: false,
          voiceCallLogId: voiceCallLog.id,
          statusCode: response.status,
          error: `Invalid API response (HTTP ${response.status})`,
        };
      }

      const isSuccess = response.ok &&
        (apiResponse.StatusCode === 200 || apiResponse.StatusCode === 0) &&
        apiResponse.StatusMessage?.toLowerCase() === 'success';

      const hafalaId = apiResponse.ResData?.HafalaID
        ? String(apiResponse.ResData.HafalaID)
        : undefined;

      await prisma.voiceCallLog.update({
        where: { id: voiceCallLog.id },
        data: {
          status: isSuccess ? 'sent' : 'failed',
          statusCode: apiResponse.StatusCode,
          statusMessage: apiResponse.StatusMessage || null,
          kolKasherCallId: hafalaId || null,
          apiResponseBody: apiResponse as unknown as Prisma.InputJsonValue,
          errorMessage: isSuccess ? null : (apiResponse.Msg || apiResponse.StatusMessage || `HTTP ${response.status}`),
        },
      });

      if (isSuccess) {
        console.log(`✅ Kol Kasher: Voice call sent successfully (HafalaID: ${hafalaId})`);
      } else {
        console.error(`❌ Kol Kasher: API error - ${apiResponse.StatusMessage} (code: ${apiResponse.StatusCode})`);
      }

      return {
        success: isSuccess,
        callId: hafalaId,
        statusCode: apiResponse.StatusCode,
        statusMessage: apiResponse.StatusMessage,
        voiceCallLogId: voiceCallLog.id,
        error: isSuccess ? undefined : (apiResponse.Msg || apiResponse.StatusMessage),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      await prisma.voiceCallLog.update({
        where: { id: voiceCallLog.id },
        data: {
          status: 'error',
          errorMessage: errorMsg,
        },
      });

      console.error('❌ Kol Kasher: Request failed:', errorMsg);
      return {
        success: false,
        voiceCallLogId: voiceCallLog.id,
        error: errorMsg,
      };
    }
  }

  async handleCallback(body: Record<string, unknown>): Promise<void> {
    const callId = String(body.CallId || body.callId || body.Result || '');
    const callStatus = String(body.Status || body.status || body.CallStatus || '');
    const duration = body.Duration || body.duration || body.CallDuration;

    console.log(`📞 Kol Kasher callback: CallId=${callId}, Status=${callStatus}`);

    if (!callId) {
      console.warn('⚠️ Kol Kasher callback: No call ID in payload');
      return;
    }

    const voiceCallLog = await prisma.voiceCallLog.findFirst({
      where: { kolKasherCallId: callId },
    });

    if (!voiceCallLog) {
      console.warn(`⚠️ Kol Kasher callback: No log found for call ID ${callId}`);
      return;
    }

    const statusMap: Record<string, string> = {
      completed: 'completed',
      answered: 'completed',
      busy: 'busy',
      'no-answer': 'no_answer',
      noanswer: 'no_answer',
      failed: 'failed',
      error: 'failed',
      canceled: 'canceled',
    };

    const normalizedStatus = statusMap[callStatus.toLowerCase()] || callStatus.toLowerCase() || 'unknown';

    await prisma.voiceCallLog.update({
      where: { id: voiceCallLog.id },
      data: {
        status: normalizedStatus,
        callbackBody: body as Prisma.InputJsonValue,
        duration: duration ? Number(duration) : undefined,
        answeredBy: body.AnsweredBy ? String(body.AnsweredBy) : undefined,
      },
    });

    if (voiceCallLog.notificationId) {
      const deliveryStatus = ['completed', 'answered'].includes(callStatus.toLowerCase())
        ? 'delivered'
        : 'failed';

      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId: voiceCallLog.notificationId,
          provider: 'kol_kasher',
        },
        data: {
          status: deliveryStatus as 'delivered' | 'failed',
          errorMessage: deliveryStatus === 'failed' ? `Call status: ${callStatus}` : null,
        },
      });
    }

    console.log(`✅ Kol Kasher callback processed: ${callId} -> ${normalizedStatus}`);
  }

  async getCallHistory(customerId: string, page = 1, limit = 20) {
    const [logs, total] = await Promise.all([
      prisma.voiceCallLog.findMany({
        where: { customerId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          notification: {
            select: {
              id: true,
              templateKey: true,
              channel: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.voiceCallLog.count({ where: { customerId } }),
    ]);

    return {
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCallStats() {
    const [total, byStatus] = await Promise.all([
      prisma.voiceCallLog.count(),
      prisma.voiceCallLog.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
    };
  }

  private formatPhoneForKolKasher(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+972')) {
      cleaned = '0' + cleaned.substring(4);
    } else if (cleaned.startsWith('972')) {
      cleaned = '0' + cleaned.substring(3);
    }

    return cleaned;
  }
}

export default new KolKasherService();
