import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

type StripeClient = InstanceType<typeof Stripe>;

export type RefundReason = 'requested_by_customer' | 'duplicate' | 'fraudulent';
export const REFUND_REASONS: RefundReason[] = ['requested_by_customer', 'duplicate', 'fraudulent'];

/** What the admin booking page shows for a card payment. Amounts in euros. */
export interface CardPaymentSummary {
  provider: 'stripe';
  paymentIntentId: string;
  status: string;
  livemode: boolean;
  amount: number;
  amountRefunded: number;
  refundable: number;
  fullyRefunded: boolean;
  disputed: boolean;
  paidAt: string | null;
  method: { type: string; brand?: string; last4?: string; country?: string; wallet?: string } | null;
  receiptUrl: string | null;
  dashboardUrl: string;
  refunds: {
    id: string;
    amount: number;
    status: string;
    reason: string | null;
    note: string | null;
    createdAt: string;
  }[];
}

/** Stripe is the source of truth for what was charged and what went back. */
async function loadCharge(stripe: StripeClient, paymentIntentId: string) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
  const charge = paymentIntent.latest_charge;
  if (!charge || typeof charge === 'string') {
    throw new BadRequestException('This payment has no charge on Stripe');
  }
  return { paymentIntent, charge };
}

/** The booking fields that mirror the charge's refund state. */
export function refundFields(charge: Stripe.Charge, refundId?: string) {
  const fully = charge.amount_refunded >= charge.amount;
  return {
    refundAmount: charge.amount_refunded / 100,
    ...(charge.amount_refunded > 0 ? { refundedAt: new Date() } : {}),
    // A partial refund leaves the rest of the stay paid.
    paymentStatus: fully ? 'REFUNDED' : 'PAID',
    ...(refundId ? { stripeRefundId: refundId } : {}),
  } as const;
}

export async function describeCardPayment(
  stripe: StripeClient,
  paymentIntentId: string,
): Promise<{ summary: CardPaymentSummary; charge: Stripe.Charge }> {
  const { paymentIntent, charge } = await loadCharge(stripe, paymentIntentId);
  const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
  const details = charge.payment_method_details;

  return {
    charge,
    summary: {
      provider: 'stripe',
      paymentIntentId,
      status: paymentIntent.status,
      livemode: paymentIntent.livemode,
      amount: charge.amount / 100,
      amountRefunded: charge.amount_refunded / 100,
      refundable: (charge.amount - charge.amount_refunded) / 100,
      fullyRefunded: charge.amount_refunded >= charge.amount,
      disputed: !!charge.disputed,
      paidAt: charge.created ? new Date(charge.created * 1000).toISOString() : null,
      method: details
        ? {
            type: details.type,
            brand: details.card?.brand,
            last4: details.card?.last4,
            country: details.card?.country,
            wallet: details.card?.wallet?.type,
          }
        : null,
      receiptUrl: charge.receipt_url || null,
      dashboardUrl: `https://dashboard.stripe.com/${paymentIntent.livemode ? '' : 'test/'}payments/${paymentIntentId}`,
      refunds: refunds.data.map((r) => ({
        id: r.id,
        amount: r.amount / 100,
        status: r.status,
        reason: r.reason || null,
        note: r.metadata?.note || null,
        createdAt: new Date(r.created * 1000).toISOString(),
      })),
    },
  };
}

/**
 * Refunds part or all of a card payment. With no amount, refunds whatever is
 * still refundable. The idempotency key is tied to how much had been refunded
 * before, so a double click returns the same refund instead of a second one,
 * while a deliberate second partial refund still goes through.
 */
export async function refundCardPayment(
  stripe: StripeClient,
  opts: {
    paymentIntentId: string;
    bookingId: string;
    bookingNumber?: string;
    amount?: number;
    reason?: RefundReason;
    note?: string;
  },
): Promise<{ refund: Stripe.Refund; charge: Stripe.Charge }> {
  const { charge } = await loadCharge(stripe, opts.paymentIntentId);
  const refundableCents = charge.amount - charge.amount_refunded;
  if (refundableCents <= 0) {
    throw new BadRequestException('This payment has already been fully refunded');
  }

  const cents = opts.amount == null ? refundableCents : Math.round(Number(opts.amount) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > refundableCents) {
    throw new BadRequestException(
      `The refund must be between €0.01 and €${(refundableCents / 100).toFixed(2)}`,
    );
  }

  const refund = await stripe.refunds.create(
    {
      payment_intent: opts.paymentIntentId,
      amount: cents,
      reason: REFUND_REASONS.includes(opts.reason) ? opts.reason : 'requested_by_customer',
      metadata: {
        bookingId: opts.bookingId,
        bookingNumber: opts.bookingNumber || '',
        note: (opts.note || '').slice(0, 500),
      },
    },
    { idempotencyKey: `refund:${opts.bookingId}:${charge.amount_refunded}:${cents}` },
  );

  // The charge as it stands after this refund.
  const after = { ...charge, amount_refunded: charge.amount_refunded + cents } as Stripe.Charge;
  return { refund, charge: after };
}
