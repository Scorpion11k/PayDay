import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import emailService from '../services/email.service';
import whatsappService from '../services/whatsapp.service';
import { ValidationError, NotFoundError } from '../types';

const sendReminderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  channel: z.enum(['email', 'whatsapp']),
  templateKey: z.string().optional().default('debt_reminder'),
});

class MessagingController {
  /**
   * Get messaging service status
   */
  async getStatus(req: Request, res: Response) {
    // Initialize services if not already
    await emailService.initialize();
    await whatsappService.initialize();

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

    const { customerId, channel, templateKey } = validation.data;

    // Get customer with their debts
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        debts: {
          where: { status: { in: ['open', 'in_collection'] } },
          select: {
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

    // Calculate total debt
    const totalDebt = customer.debts.reduce(
      (sum, debt) => sum + Number(debt.currentBalance),
      0
    );
    const currency = customer.debts[0]?.currency || 'USD';

    // Send based on channel
    let result: { success: boolean; messageId?: string; messageSid?: string; error?: string };

    if (channel === 'email') {
      if (!customer.email) {
        throw new ValidationError('Customer has no email address');
      }

      await emailService.initialize();
      
      if (!emailService.isAvailable()) {
        throw new ValidationError('Email service is not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD in environment variables.');
      }

      result = await emailService.sendDebtReminder({
        customerName: customer.fullName,
        email: customer.email,
        totalDebt: totalDebt > 0 ? totalDebt : undefined,
        currency,
      });
    } else {
      if (!customer.phone) {
        throw new ValidationError('Customer has no phone number');
      }

      await whatsappService.initialize();
      
      if (!whatsappService.isAvailable()) {
        throw new ValidationError('WhatsApp service is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER in environment variables.');
      }

      result = await whatsappService.sendDebtReminder({
        customerName: customer.fullName,
        phone: customer.phone,
        totalDebt: totalDebt > 0 ? totalDebt : undefined,
        currency,
      });
    }

    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        customerId,
        channel,
        templateKey,
        payloadSnapshot: {
          customerName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
          totalDebt,
          currency,
          sentAt: new Date().toISOString(),
        },
        createdBy: 'system',
      },
    });

    // Create delivery record
    await prisma.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        attemptNo: 1,
        provider: channel === 'email' ? 'gmail' : 'twilio',
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

    res.json({
      success: true,
      message: `${channel === 'email' ? 'Email' : 'WhatsApp'} reminder sent successfully to ${customer.fullName}`,
      data: {
        notificationId: notification.id,
        messageId: result.messageId || result.messageSid,
        channel,
        recipient: channel === 'email' ? customer.email : customer.phone,
      },
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
}

export default new MessagingController();

