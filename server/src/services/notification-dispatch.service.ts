import { NotificationChannel, TemplateLanguage, TemplateTone } from '@prisma/client';
import prisma from '../config/database';
import emailService from './email.service';
import smsService from './sms.service';
import templateService from './template.service';
import voiceService from './voice.service';
import whatsappService from './whatsapp.service';
import { recommendChannelByAge } from './preference.service';

type DispatchActionType =
  | 'assigned_channel'
  | 'send_email'
  | 'send_sms'
  | 'send_whatsapp'
  | 'voice_call';

export interface DispatchNotificationInput {
  customerId: string;
  actionType?: DispatchActionType;
  channel?: NotificationChannel;
  explicitChannel?: NotificationChannel | null;
  templateKey?: string;
  language?: TemplateLanguage;
  tone?: TemplateTone;
  debtId?: string;
  installmentId?: string;
  createdBy?: string;
}

export interface DispatchNotificationResult {
  success: boolean;
  notificationId?: string;
  channel?: NotificationChannel;
  recipient?: string | null;
  messageId?: string | null;
  callSid?: string | null;
  error?: string;
}

function mapActionTypeToChannel(actionType: DispatchActionType): NotificationChannel | null {
  switch (actionType) {
    case 'send_email':
      return 'email';
    case 'send_sms':
      return 'sms';
    case 'send_whatsapp':
      return 'whatsapp';
    case 'voice_call':
      return 'call_task';
    case 'assigned_channel':
      return null;
    default:
      return null;
  }
}

class NotificationDispatchService {
  private resolveAssignedChannel(preferredChannel: NotificationChannel | null, dateOfBirth: Date | null): NotificationChannel {
    return preferredChannel || recommendChannelByAge(dateOfBirth);
  }

  private resolveChannel(
    input: DispatchNotificationInput,
    preferredChannel: NotificationChannel | null,
    dateOfBirth: Date | null
  ): NotificationChannel {
    if (input.channel) {
      return input.channel;
    }

    if (input.explicitChannel) {
      return input.explicitChannel;
    }

    if (!input.actionType || input.actionType === 'assigned_channel') {
      return this.resolveAssignedChannel(preferredChannel, dateOfBirth);
    }

    const mapped = mapActionTypeToChannel(input.actionType);
    if (!mapped) {
      return this.resolveAssignedChannel(preferredChannel, dateOfBirth);
    }

    return mapped;
  }

  async send(input: DispatchNotificationInput): Promise<DispatchNotificationResult> {
    const templateKey = input.templateKey || 'debt_reminder';
    const createdBy = input.createdBy || 'system';

    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      include: {
        debts: {
          where: input.debtId
            ? { id: input.debtId }
            : { status: { in: ['open', 'in_collection'] } },
          select: {
            id: true,
            currentBalance: true,
            currency: true,
          },
        },
      },
    });

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    if (customer.status === 'do_not_contact') {
      return { success: false, error: 'Customer has opted out of contact' };
    }

    if (customer.status === 'blocked') {
      return { success: false, error: 'Customer is blocked' };
    }

    const channel = this.resolveChannel(input, customer.preferredChannel, customer.dateOfBirth);
    const language = input.language || customer.preferredLanguage || 'en';
    const tone = input.tone || customer.preferredTone || 'calm';

    const debt = customer.debts[0] || null;
    let installment = null;
    if (input.installmentId) {
      installment = await prisma.installment.findUnique({
        where: { id: input.installmentId },
      });
    }

    const template = await templateService.resolveTemplate(
      templateKey,
      channel,
      language,
      tone
    );

    if (!template) {
      return {
        success: false,
        error: `No template found for ${templateKey}/${channel}/${language}/${tone}`,
      };
    }

    const notificationId = crypto.randomUUID();
    const payload = templateService.buildPayload(
      customer,
      debt,
      installment,
      notificationId,
      language
    );
    const rendered = templateService.render(template, payload);

    if (channel === 'email' && !customer.email) {
      return { success: false, error: 'Customer has no email address' };
    }

    if ((channel === 'sms' || channel === 'whatsapp' || channel === 'call_task') && !customer.phone) {
      return { success: false, error: 'Customer has no phone number' };
    }

    try {
      if (channel === 'call_task') {
        await voiceService.initialize();
        if (!voiceService.isAvailable()) {
          return { success: false, error: 'Voice service is not configured' };
        }

        const voiceNotification = await prisma.notification.create({
          data: {
            id: notificationId,
            customerId: customer.id,
            debtId: debt?.id,
            installmentId: input.installmentId,
            channel: 'call_task',
            templateKey,
            payloadSnapshot: {
              ...payload,
              language,
              tone,
            },
            createdBy,
          },
        });

        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        const twimlUrl = `${baseUrl}/api/voice/twiml/${voiceNotification.id}`;

        const call = await voiceService.makeCall({
          to: customer.phone!,
          twimlUrl,
          notificationId: voiceNotification.id,
        });

        await prisma.notificationDelivery.create({
          data: {
            notificationId: voiceNotification.id,
            attemptNo: 1,
            provider: 'twilio_voice',
            providerMessageId: call.callSid || null,
            status: call.success ? 'sent' : 'failed',
            errorMessage: call.error || null,
            sentAt: call.success ? new Date() : null,
          },
        });

        return {
          success: call.success,
          notificationId: voiceNotification.id,
          channel,
          recipient: customer.phone,
          callSid: call.callSid || null,
          error: call.error,
        };
      }

      const notification = await prisma.notification.create({
        data: {
          id: notificationId,
          customerId: customer.id,
          debtId: debt?.id,
          installmentId: input.installmentId,
          channel,
          templateKey,
          payloadSnapshot: {
            ...payload,
            language,
            tone,
          },
          createdBy,
        },
      });

      let provider = '';
      let result: {
        success: boolean;
        messageId?: string;
        messageSid?: string;
        error?: string;
      };

      if (channel === 'email') {
        await emailService.initialize();
        if (!emailService.isAvailable()) {
          await prisma.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              attemptNo: 1,
              provider: 'gmail',
              status: 'failed',
              errorMessage: 'Email service is not configured',
            },
          });
          return { success: false, error: 'Email service is not configured', notificationId: notification.id, channel };
        }
        provider = 'gmail';
        result = await emailService.sendEmail({
          to: customer.email!,
          subject: rendered.subject || 'Payment Reminder',
          html: rendered.bodyHtml,
          text: rendered.bodyText,
        });
      } else if (channel === 'whatsapp') {
        await whatsappService.initialize();
        if (!whatsappService.isAvailable()) {
          await prisma.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              attemptNo: 1,
              provider: 'twilio_whatsapp',
              status: 'failed',
              errorMessage: 'WhatsApp service is not configured',
            },
          });
          return { success: false, error: 'WhatsApp service is not configured', notificationId: notification.id, channel };
        }
        provider = 'twilio_whatsapp';
        result = await whatsappService.sendMessage({
          to: customer.phone!,
          message: rendered.bodyText,
        });
      } else {
        await smsService.initialize();
        if (!smsService.isAvailable()) {
          await prisma.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              attemptNo: 1,
              provider: 'twilio_sms',
              status: 'failed',
              errorMessage: 'SMS service is not configured',
            },
          });
          return { success: false, error: 'SMS service is not configured', notificationId: notification.id, channel };
        }
        provider = 'twilio_sms';
        result = await smsService.sendSMS({
          to: customer.phone!,
          message: rendered.bodyText,
        });
      }

      await prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          attemptNo: 1,
          provider,
          providerMessageId: result.messageId || result.messageSid || null,
          status: result.success ? 'sent' : 'failed',
          errorMessage: result.error || null,
          sentAt: result.success ? new Date() : null,
        },
      });

      return {
        success: result.success,
        notificationId: notification.id,
        channel,
        recipient: channel === 'email' ? customer.email : customer.phone,
        messageId: result.messageId || result.messageSid || null,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown dispatch error',
      };
    }
  }
}

export default new NotificationDispatchService();
