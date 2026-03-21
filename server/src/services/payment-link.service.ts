import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { ValidationError } from '../types';

interface PaymentLinkTokenPayload {
  v: 1;
  customerId: string;
  debtId?: string;
  notificationId?: string;
  issuedAt: number;
}

interface CreatePaymentLinkInput {
  customerId: string;
  debtId?: string;
  notificationId?: string;
}

class PaymentLinkService {
  private getSecret() {
    return process.env.PAYMENT_LINK_SECRET || 'payday-dev-payment-link-secret';
  }

  private getBaseUrl() {
    const fallback = 'http://localhost:5173';
    return (
      process.env.PAYMENT_BASE_URL ||
      process.env.CORS_ORIGIN ||
      process.env.BASE_URL ||
      fallback
    ).replace(/\/+$/, '');
  }

  private sign(encodedPayload: string) {
    return createHmac('sha256', this.getSecret()).update(encodedPayload).digest('base64url');
  }

  private encodePayload(payload: PaymentLinkTokenPayload) {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  createToken(input: CreatePaymentLinkInput) {
    const encodedPayload = this.encodePayload({
      v: 1,
      customerId: input.customerId,
      debtId: input.debtId,
      notificationId: input.notificationId,
      issuedAt: Date.now(),
    });

    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  createLink(input: CreatePaymentLinkInput) {
    return `${this.getBaseUrl()}/pay/${this.createToken(input)}`;
  }

  parseToken(token: string) {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      throw new ValidationError('Invalid payment link');
    }

    const expectedSignature = Buffer.from(this.sign(encodedPayload), 'base64url');
    const receivedSignature = Buffer.from(signature, 'base64url');

    if (
      expectedSignature.length !== receivedSignature.length ||
      !timingSafeEqual(expectedSignature, receivedSignature)
    ) {
      throw new ValidationError('Invalid payment link');
    }

    let payload: PaymentLinkTokenPayload;

    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as PaymentLinkTokenPayload;
    } catch {
      throw new ValidationError('Invalid payment link');
    }

    if (
      payload.v !== 1 ||
      typeof payload.customerId !== 'string' ||
      payload.customerId.trim().length === 0 ||
      typeof payload.issuedAt !== 'number'
    ) {
      throw new ValidationError('Invalid payment link');
    }

    return payload;
  }

  buildProviderTxnId(token: string, notificationId?: string) {
    if (notificationId) {
      return `pay_link:${notificationId}`;
    }

    const digest = createHash('sha256').update(token).digest('hex').slice(0, 24);
    return `pay_link:${digest}`;
  }
}

export default new PaymentLinkService();
