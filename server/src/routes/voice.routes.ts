import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import templateService from '../services/template.service';
import smsService from '../services/sms.service';
import { TemplateLanguage, TemplateTone } from '@prisma/client';

const router = Router();

/**
 * GET /api/voice/twiml/:notificationId
 * Generate TwiML for an outbound voice call
 */
router.get('/twiml/:notificationId', async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        customer: true,
        debt: true,
        installment: true
      }
    });

    if (!notification) {
      res.type('text/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid request.</Say></Response>'
      );
      return;
    }

    const payloadSnapshot = notification.payloadSnapshot as Record<string, string>;
    const language = (payloadSnapshot.language || 'en') as TemplateLanguage;
    const tone = (payloadSnapshot.tone || 'calm') as TemplateTone;

    const template = await prisma.messageTemplate.findFirst({
      where: {
        key: notification.templateKey,
        channel: 'call_task',
        language,
        tone,
        status: 'active'
      }
    });

    if (!template) {
      res.type('text/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Template not found.</Say></Response>'
      );
      return;
    }

    // Build payload from notification data
    const payload = templateService.buildPayload(
      notification.customer,
      notification.debt,
      notification.installment,
      notification.id,
      language
    );

    // Render the template
    const rendered = templateService.renderText(template.bodyText, payload);

    // Generate TwiML
    const twiml = templateService.generateTwiML(rendered, language);

    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Error generating TwiML:', error);
    res.type('text/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say></Response>'
    );
  }
});

/**
 * POST /api/voice/gather
 * Handle keypress during voice call
 */
router.post('/gather', async (req: Request, res: Response) => {
  try {
    const { Digits, CallSid } = req.body;

    let response = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (Digits === '1') {
      // User pressed 1 - Send payment link via SMS
      response += '<Say>We will send you a payment link by SMS. Thank you.</Say>';

      // Try to find the notification associated with this call
      const delivery = await prisma.notificationDelivery.findFirst({
        where: { providerMessageId: CallSid },
        include: {
          notification: {
            include: { customer: true, debt: true }
          }
        }
      });

      if (delivery?.notification?.customer?.phone) {
        const payload = delivery.notification.payloadSnapshot as Record<string, string>;
        const paymentLink = payload.PaymentLink || templateService.buildPayload(
          delivery.notification.customer,
          delivery.notification.debt,
          null,
          delivery.notification.id,
          'en'
        ).PaymentLink;

        // Send SMS with payment link
        await smsService.sendSMS({
          to: delivery.notification.customer.phone,
          message: `Here is your secure payment link: ${paymentLink}`
        });
      }
    } else if (Digits === '2') {
      // User pressed 2 - Transfer to support
      const supportPhone = process.env.SUPPORT_PHONE;
      if (supportPhone) {
        response += '<Say>Connecting you to support. Please hold.</Say>';
        response += `<Dial>${supportPhone}</Dial>`;
      } else {
        response += '<Say>Our support team will contact you shortly. Thank you.</Say>';
      }
    } else {
      response += '<Say>Invalid option. Goodbye.</Say>';
    }

    response += '</Response>';
    res.type('text/xml').send(response);
  } catch (error) {
    console.error('Error handling gather:', error);
    res.type('text/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Goodbye.</Say></Response>'
    );
  }
});

/**
 * POST /api/voice/status
 * Handle call status updates from Twilio
 */
router.post('/status', async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;

    // Map Twilio call status to our delivery status
    const statusMap: Record<string, 'delivered' | 'failed'> = {
      completed: 'delivered',
      busy: 'failed',
      failed: 'failed',
      'no-answer': 'failed',
      canceled: 'failed'
    };

    const newStatus = statusMap[CallStatus];

    if (newStatus) {
      await prisma.notificationDelivery.updateMany({
        where: { providerMessageId: CallSid },
        data: {
          status: newStatus,
          errorMessage: CallStatus !== 'completed' ? CallStatus : null
        }
      });

      console.log(`📞 Call ${CallSid} status: ${CallStatus} -> ${newStatus}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling call status:', error);
    res.sendStatus(500);
  }
});

/**
 * POST /api/voice/amd
 * Handle answering machine detection results
 */
router.post('/amd', async (req: Request, res: Response) => {
  try {
    const { CallSid, AnsweredBy } = req.body;

    console.log(`📞 Call ${CallSid} answered by: ${AnsweredBy}`);

    // We could use this to potentially hang up or leave a voicemail
    // For now, just log it

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling AMD:', error);
    res.sendStatus(500);
  }
});

export default router;
