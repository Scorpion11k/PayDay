import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import emailService from '../services/email.service';
import whatsappService from '../services/whatsapp.service';
import smsService from '../services/sms.service';
import voiceService from '../services/voice.service';
import templateService from '../services/template.service';
import { ValidationError, NotFoundError } from '../types';
import { TemplateLanguage, TemplateTone, NotificationChannel, Prisma } from '@prisma/client';
import { isEligibleForChannel, recommendChannelByAge, recommendLanguageByRegion, getDefaultTone } from '../services/preference.service';

const sendReminderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  channel: z.enum(['email', 'whatsapp', 'sms', 'call_task']),
  templateKey: z.string().optional().default('debt_reminder'),
  language: z.enum(['en', 'he', 'ar']).optional(),
  tone: z.enum(['calm', 'medium', 'heavy']).optional(),
  debtId: z.string().uuid().optional(),
  installmentId: z.string().uuid().optional()
});

const previewReminderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  channel: z.enum(['email', 'whatsapp', 'sms', 'call_task']),
  templateKey: z.string().optional().default('debt_reminder'),
  language: z.enum(['en', 'he', 'ar']).optional(),
  tone: z.enum(['calm', 'medium', 'heavy']).optional()
});

const bulkSendSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1).max(500).optional(),
  selectAll: z.boolean().optional(),
  excludedCustomerIds: z.array(z.string().uuid()).optional(),
  filters: z.object({
    search: z.string().optional(),
    status: z.enum(['active', 'do_not_contact', 'blocked']).optional(),
  }).optional(),
  templateKey: z.string().optional().default('debt_reminder'),
  overrideChannel: z.enum(['email', 'whatsapp', 'sms', 'call_task']).optional(),
  overrideLanguage: z.enum(['en', 'he', 'ar']).optional(),
  overrideTone: z.enum(['calm', 'medium', 'heavy']).optional(),
}).refine((data) => data.selectAll || (data.customerIds && data.customerIds.length > 0), {
  message: 'Select all or provide at least one customer',
});

class MessagingController {
  /**
   * Get messaging service status
   */
  async getStatus(req: Request, res: Response) {
    // Initialize services if not already
    await Promise.all([
      emailService.initialize(),
      whatsappService.initialize(),
      smsService.initialize(),
      voiceService.initialize()
    ]);

    res.json({
      success: true,
      data: {
        email: {
          available: emailService.isAvailable(),
          provider: 'Gmail (Nodemailer)',
        },
        whatsapp: {
          available: whatsappService.isAvailable(),
          provider: 'Twilio',
        },
        sms: {
          available: smsService.isAvailable(),
          provider: 'Twilio',
        },
        voice: {
          available: voiceService.isAvailable(),
          provider: 'Twilio',
        },
      },
    });
  }

  /**
   * Send a payment reminder to a customer
   */
  async sendReminder(req: Request, res: Response) {
    const validation = sendReminderSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const { customerId, channel, templateKey, debtId, installmentId } = validation.data;
    let { language, tone } = validation.data;

    // Get customer with their debts and preferences
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        debts: {
          where: debtId 
            ? { id: debtId }
            : { status: { in: ['open', 'in_collection'] } },
          select: {
            id: true,
            originalAmount: true,
            currentBalance: true,
            currency: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer');
    }

    // Check customer status
    if (customer.status === 'do_not_contact') {
      throw new ValidationError('Customer has opted out of contact');
    }

    if (customer.status === 'blocked') {
      throw new ValidationError('Customer is blocked');
    }

    // Resolve language and tone from customer preferences or defaults
    language = language || customer.preferredLanguage || 'en';
    tone = tone || customer.preferredTone || 'calm';

    // Get debt and installment if specified
    const debt = customer.debts[0] || null;
    let installment = null;
    if (installmentId) {
      installment = await prisma.installment.findUnique({
        where: { id: installmentId }
      });
    }

    // Resolve template
    const template = await templateService.resolveTemplate(
      templateKey,
      channel as NotificationChannel,
      language as TemplateLanguage,
      tone as TemplateTone
    );

    if (!template) {
      throw new ValidationError(
        `No template found for ${templateKey}/${channel}/${language}/${tone}`
      );
    }

    // Build payload
    const notificationId = crypto.randomUUID();
    const payload = templateService.buildPayload(
      customer,
      debt,
      installment,
      notificationId,
      language as TemplateLanguage
    );

    // Render template
    const rendered = templateService.render(template, payload);

    // Send based on channel
    let result: { success: boolean; messageId?: string; messageSid?: string; callSid?: string; error?: string };
    let provider: string;

    switch (channel) {
      case 'email':
        if (!customer.email) {
          throw new ValidationError('Customer has no email address');
        }
        await emailService.initialize();
        if (!emailService.isAvailable()) {
          throw new ValidationError('Email service is not configured');
        }
        result = await emailService.sendEmail({
          to: customer.email,
          subject: rendered.subject || 'Payment Reminder',
          html: rendered.bodyHtml,
          text: rendered.bodyText
        });
        provider = 'gmail';
        break;

      case 'whatsapp':
        if (!customer.phone) {
          throw new ValidationError('Customer has no phone number');
        }
        await whatsappService.initialize();
        if (!whatsappService.isAvailable()) {
          throw new ValidationError('WhatsApp service is not configured');
        }
        result = await whatsappService.sendMessage({
          to: customer.phone,
          message: rendered.bodyText
        });
        provider = 'twilio_whatsapp';
        break;

      case 'sms':
        if (!customer.phone) {
          throw new ValidationError('Customer has no phone number');
        }
        await smsService.initialize();
        if (!smsService.isAvailable()) {
          throw new ValidationError('SMS service is not configured');
        }
        result = await smsService.sendSMS({
          to: customer.phone,
          message: rendered.bodyText
        });
        provider = 'twilio_sms';
        break;

      case 'call_task':
        if (!customer.phone) {
          throw new ValidationError('Customer has no phone number');
        }
        await voiceService.initialize();
        if (!voiceService.isAvailable()) {
          throw new ValidationError('Voice service is not configured');
        }

        // Create notification first to get ID for TwiML URL
        const voiceNotification = await prisma.notification.create({
          data: {
            id: notificationId,
            customerId,
            debtId: debt?.id,
            installmentId,
            channel: 'call_task',
            templateKey,
            payloadSnapshot: {
              ...payload,
              language,
              tone
            },
            createdBy: 'system',
          },
        });

        // Generate TwiML URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        const twimlUrl = `${baseUrl}/api/voice/twiml/${voiceNotification.id}`;

        result = await voiceService.makeCall({
          to: customer.phone,
          twimlUrl,
          notificationId: voiceNotification.id
        });

        // Create delivery record
        await prisma.notificationDelivery.create({
          data: {
            notificationId: voiceNotification.id,
            attemptNo: 1,
            provider: 'twilio_voice',
            providerMessageId: result.callSid || null,
            status: result.success ? 'sent' : 'failed',
            errorMessage: result.error || null,
            sentAt: result.success ? new Date() : null,
          },
        });

        if (!result.success) {
          res.status(500).json({
            success: false,
            error: result.error || 'Failed to initiate call',
            data: { notificationId: voiceNotification.id },
          });
          return;
        }

        res.json({
          success: true,
          message: `Voice call initiated to ${customer.fullName}`,
          data: {
            notificationId: voiceNotification.id,
            callSid: result.callSid,
            channel,
            recipient: customer.phone,
            templateUsed: {
              key: templateKey,
              language,
              tone
            }
          },
        });
        return;

      default:
        throw new ValidationError(`Unsupported channel: ${channel}`);
    }

    // Create notification record (for non-voice channels)
    const notification = await prisma.notification.create({
      data: {
        id: notificationId,
        customerId,
        debtId: debt?.id,
        installmentId,
        channel: channel as NotificationChannel,
        templateKey,
        payloadSnapshot: {
          ...payload,
          language,
          tone
        },
        createdBy: 'system',
      },
    });

    // Create delivery record
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

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send message',
        data: { notificationId: notification.id },
      });
      return;
    }

    const channelLabel = {
      email: 'Email',
      sms: 'SMS',
      whatsapp: 'WhatsApp',
      call_task: 'Voice Call'
    }[channel];

    res.json({
      success: true,
      message: `${channelLabel} reminder sent successfully to ${customer.fullName}`,
      data: {
        notificationId: notification.id,
        messageId: result.messageId || result.messageSid,
        channel,
        recipient: channel === 'email' ? customer.email : customer.phone,
        templateUsed: {
          key: templateKey,
          language,
          tone
        }
      },
    });
  }

  /**
   * Preview a reminder without sending it
   */
  async previewReminder(req: Request, res: Response) {
    const validation = previewReminderSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const { customerId, channel, templateKey } = validation.data;
    let { language, tone } = validation.data;

    // Get customer with their debts
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        debts: {
          where: { status: { in: ['open', 'in_collection'] } },
          select: {
            id: true,
            originalAmount: true,
            currentBalance: true,
            currency: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer');
    }

    // Resolve language and tone from customer preferences or defaults
    language = language || customer.preferredLanguage || 'en';
    tone = tone || customer.preferredTone || 'calm';

    // Get debt
    const debt = customer.debts[0] || null;

    // Resolve template
    const template = await templateService.resolveTemplate(
      templateKey,
      channel as NotificationChannel,
      language as TemplateLanguage,
      tone as TemplateTone
    );

    if (!template) {
      throw new ValidationError(
        `No template found for ${templateKey}/${channel}/${language}/${tone}`
      );
    }

    // Build payload
    const payload = templateService.buildPayload(
      customer,
      debt,
      null,
      'preview-id',
      language as TemplateLanguage
    );

    // Render template
    const rendered = templateService.render(template, payload);

    res.json({
      success: true,
      data: {
        subject: rendered.subject,
        bodyText: rendered.bodyText,
        bodyHtml: rendered.bodyHtml,
        templateName: template.name,
        channel,
        language,
        tone
      }
    });
  }

  /**
   * Test email configuration
   */
  async testEmail(req: Request, res: Response) {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email address is required');
    }

    await emailService.initialize();
    
    if (!emailService.isAvailable()) {
      throw new ValidationError('Email service is not configured');
    }

    const result = await emailService.sendEmail({
      to: email,
      subject: 'PayDay AI - Test Email',
      text: 'This is a test email from PayDay AI. If you received this, your email configuration is working correctly!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #1e3a5f;">✅ Email Configuration Test</h2>
          <p>This is a test email from <strong>PayDay AI</strong>.</p>
          <p>If you received this, your email configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">PayDay AI Collection System</p>
        </div>
      `,
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Test email sent successfully',
      data: { messageId: result.messageId },
    });
  }

  /**
   * Test WhatsApp configuration
   */
  async testWhatsApp(req: Request, res: Response) {
    const { phone } = req.body;

    if (!phone) {
      throw new ValidationError('Phone number is required');
    }

    await whatsappService.initialize();
    
    if (!whatsappService.isAvailable()) {
      throw new ValidationError('WhatsApp service is not configured');
    }

    const result = await whatsappService.sendMessage({
      to: phone,
      message: '✅ *PayDay AI - Test Message*\n\nThis is a test message. If you received this, your WhatsApp configuration is working correctly!',
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Test WhatsApp message sent successfully',
      data: { messageSid: result.messageSid },
    });
  }

  /**
   * Test SMS configuration
   */
  async testSMS(req: Request, res: Response) {
    const { phone } = req.body;

    if (!phone) {
      throw new ValidationError('Phone number is required');
    }

    await smsService.initialize();
    
    if (!smsService.isAvailable()) {
      throw new ValidationError('SMS service is not configured');
    }

    const result = await smsService.sendSMS({
      to: phone,
      message: 'PayDay AI Test: This is a test SMS. If you received this, your SMS configuration is working correctly!',
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Test SMS sent successfully',
      data: { messageSid: result.messageSid },
    });
  }

  /**
   * Bulk send notifications to multiple customers
   * Uses customer preferences for channel/language/tone unless overridden
   */
  async bulkSend(req: Request, res: Response) {
    const validation = bulkSendSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const { customerIds, selectAll, excludedCustomerIds, filters, templateKey, overrideChannel, overrideLanguage, overrideTone } = validation.data;

    const where: Prisma.CustomerWhereInput = {
      status: { notIn: ['blocked', 'do_not_contact'] },
    };

    if (selectAll) {
      if (filters?.status) {
        where.status = filters.status;
      }
      if (filters?.search) {
        where.OR = [
          { fullName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search } },
          { externalRef: { contains: filters.search } },
        ];
      }
      if (excludedCustomerIds && excludedCustomerIds.length > 0) {
        where.NOT = { id: { in: excludedCustomerIds } };
      }
    } else {
      where.id = { in: customerIds };
    }

    // Fetch all customers with their preferences and debts
    const customers = await prisma.customer.findMany({
      where,
      include: {
        debts: {
          where: { status: { in: ['open', 'in_collection'] } },
          select: {
            id: true,
            originalAmount: true,
            currentBalance: true,
            currency: true,
          },
        },
      },
    });

    // Initialize results tracking
    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      breakdown: {} as Record<string, { sent: number; failed: number; skipped: number }>,
      errors: [] as Array<{ customerId: string; error: string }>,
    };

    // Initialize services
    await Promise.all([
      emailService.initialize(),
      whatsappService.initialize(),
      smsService.initialize(),
      voiceService.initialize()
    ]);

    // Process each customer
    for (const customer of customers) {
      // Resolve channel - use override, preference, or auto-calculate
      const channel = overrideChannel || 
                      customer.preferredChannel || 
                      recommendChannelByAge(customer.dateOfBirth);
      
      // Resolve language - use override, preference, or auto-calculate
      const language = (overrideLanguage || 
                       customer.preferredLanguage || 
                       recommendLanguageByRegion(customer.region)) as TemplateLanguage;
      
      // Resolve tone - use override, preference, or default
      const tone = (overrideTone || 
                   customer.preferredTone || 
                   getDefaultTone()) as TemplateTone;

      // Initialize channel breakdown if not exists
      if (!results.breakdown[channel]) {
        results.breakdown[channel] = { sent: 0, failed: 0, skipped: 0 };
      }

      // Check eligibility for the channel
      if (!isEligibleForChannel(customer, channel)) {
        results.skipped++;
        results.breakdown[channel].skipped++;
        continue;
      }

      try {
        // Resolve template
        const template = await templateService.resolveTemplate(
          templateKey,
          channel as NotificationChannel,
          language,
          tone
        );

        if (!template) {
          results.failed++;
          results.breakdown[channel].failed++;
          results.errors.push({
            customerId: customer.id,
            error: `No template found for ${templateKey}/${channel}/${language}/${tone}`
          });
          continue;
        }

        // Get debt
        const debt = customer.debts[0] || null;

        // Build payload
        const notificationId = crypto.randomUUID();
        const payload = templateService.buildPayload(
          customer,
          debt,
          null,
          notificationId,
          language
        );

        // Render template
        const rendered = templateService.render(template, payload);

        // Send based on channel
        let result: { success: boolean; messageId?: string; messageSid?: string; callSid?: string; error?: string };
        let provider: string;

        switch (channel) {
          case 'email':
            if (!emailService.isAvailable()) {
              throw new Error('Email service is not configured');
            }
            result = await emailService.sendEmail({
              to: customer.email!,
              subject: rendered.subject || 'Payment Reminder',
              html: rendered.bodyHtml,
              text: rendered.bodyText
            });
            provider = 'gmail';
            break;

          case 'whatsapp':
            if (!whatsappService.isAvailable()) {
              throw new Error('WhatsApp service is not configured');
            }
            result = await whatsappService.sendMessage({
              to: customer.phone!,
              message: rendered.bodyText
            });
            provider = 'twilio_whatsapp';
            break;

          case 'sms':
            if (!smsService.isAvailable()) {
              throw new Error('SMS service is not configured');
            }
            result = await smsService.sendSMS({
              to: customer.phone!,
              message: rendered.bodyText
            });
            provider = 'twilio_sms';
            break;

          case 'call_task':
            // For bulk operations, skip voice calls (too expensive/intensive)
            results.skipped++;
            results.breakdown[channel].skipped++;
            continue;

          default:
            throw new Error(`Unsupported channel: ${channel}`);
        }

        if (result.success) {
          // Create notification record
          const notification = await prisma.notification.create({
            data: {
              id: notificationId,
              customerId: customer.id,
              debtId: debt?.id,
              channel: channel as NotificationChannel,
              templateKey,
              payloadSnapshot: {
                ...payload,
                language,
                tone
              },
              createdBy: 'bulk_send',
            },
          });

          // Create delivery record
          await prisma.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              attemptNo: 1,
              provider,
              providerMessageId: result.messageId || result.messageSid || null,
              status: 'sent',
              sentAt: new Date(),
            },
          });

          results.sent++;
          results.breakdown[channel].sent++;
        } else {
          results.failed++;
          results.breakdown[channel].failed++;
          results.errors.push({
            customerId: customer.id,
            error: result.error || 'Unknown error'
          });
        }
      } catch (error) {
        results.failed++;
        results.breakdown[channel].failed++;
        results.errors.push({
          customerId: customer.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Add info about customers that were excluded (blocked/do_not_contact)
    if (!selectAll && customerIds) {
      const excludedCount = customerIds.length - customers.length;
      if (excludedCount > 0) {
        results.skipped += excludedCount;
      }
    }

    res.json({
      success: true,
      message: `Bulk send completed: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`,
      data: results,
    });
  }

  /**
   * SMS delivery status webhook
   */
  async smsStatus(req: Request, res: Response) {
    const { MessageSid, MessageStatus } = req.body;

    const statusMap: Record<string, 'delivered' | 'failed'> = {
      delivered: 'delivered',
      undelivered: 'failed',
      failed: 'failed'
    };

    const newStatus = statusMap[MessageStatus];

    if (newStatus) {
      await prisma.notificationDelivery.updateMany({
        where: { providerMessageId: MessageSid },
        data: {
          status: newStatus,
          errorMessage: MessageStatus !== 'delivered' ? MessageStatus : null
        }
      });
    }

    res.sendStatus(200);
  }
}

export default new MessagingController();
