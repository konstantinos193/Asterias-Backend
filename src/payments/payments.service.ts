import { BookingWriter } from '../bookings/domain/booking-writer.service';
import { Inject, Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { STRIPE_CLIENT, StripeClient } from '../stripe/stripe.module';
import { ClientSession, Connection, Model } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Room, RoomSchema } from '../models/room.model';
import { Booking, BookingSchema } from '../models/booking.model';
import { PricingService } from '../pricing/pricing.service';
import { AvailabilityEngine } from '../availability/availability-engine';
import Stripe from 'stripe';
import { refundFields } from './stripe-refunds';
import {
  CHECKOUT_LOCALES,
  CheckoutLocale,
  SITE_URL,
  localizedRoomName,
  publicImageUrl,
  stayDescription,
  submitNote,
} from './checkout-copy';
import { CreateCashBookingDto } from './dto/create-cash-booking.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { BookingNumberService } from '../common/booking-number/booking-number.service';
import { SettingsService } from '../settings/settings.service';
import { EmailService } from '../email/email.service';
import { BOOKING_STATUS, CURRENCY, PAYMENT_METHOD, PAYMENT_STATUS } from '../common/enums';

/**
 * Sites the Stripe page may send the guest back to.
 *
 * Driven by RETURN_ORIGINS, falling back to CORS_ORIGINS — "which origins are
 * ours" is one question and should have one answer. This was a hardcoded array
 * that included the two localhost origins in production as well, which is the
 * same class of bug that was fixed for CORS in main.ts: a page able to get the
 * browser to a localhost origin was a trusted return destination for a live
 * payment.
 */
function returnOrigins(): string[] {
  const configured = (process.env.RETURN_ORIGINS || process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length) return configured;

  return process.env.NODE_ENV === 'production'
    ? ['https://asteriashome.gr', 'https://www.asteriashome.gr']
    : ['http://localhost:3000', 'http://localhost:3001'];
}

/** Stripe metadata values are capped at 500 characters; longer notes span keys. */
const META_CHUNK = 500;
const NOTE_CHUNKS = 4;

@Injectable()
export class PaymentsService {
  private stripe: InstanceType<typeof Stripe>;

  /**
   * Bookings being created right now, by PaymentIntent id. The return page and
   * the webhook usually arrive within the same second for one payment; the
   * second caller waits for the first instead of racing it to a duplicate.
   */
  private readonly bookingInFlight = new Map<string, Promise<any>>();

  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly writer: BookingWriter,
    @InjectModel(Room.name) private roomModel: Model<Room>,
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectConnection() private connection: Connection,
    private pricingService: PricingService,
    private readonly availability: AvailabilityEngine,
    private readonly bookingNumbers: BookingNumberService,
    private readonly settingsService: SettingsService,
    @Inject(STRIPE_CLIENT) stripe: StripeClient,
  ) {
    // The client is injected rather than constructed here. There were three
    // independent Stripe clients in the codebase — this one, one in
    // AdminService, and one in HealthController with an 'sk_test_dummy'
    // fallback — with no shared configuration and no pinned API version.
    this.stripe = stripe;
  }

  async createPaymentIntent(createPaymentIntentDto: CreatePaymentIntentDto) {
    this.requireStripe();

    const { roomId, checkIn, checkOut, adults, children = 0, offerId } = createPaymentIntentDto;

    // Check if room exists
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    await this.assertWithinBookingWindow(checkIn, checkOut);

    // Quick check; the atomic one runs inside the booking transaction.
    await this.availability.assertSellable(roomId, new Date(checkIn), new Date(checkOut));

    const priced = await this.priceStay(room, checkIn, checkOut, adults, children, offerId);

    // The currency is fixed, not taken from the request.
    //
    // This route is public, and `currency` used to be an unvalidated optional
    // string on the DTO that was passed straight through here. The amount is
    // computed by PricingService in euro cents, so a caller who sent a cheaper
    // unit was charged the euro figure in it.
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: priced.amountCents,
      currency: CURRENCY,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: priced.metadata,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: priced.amountCents / 100,
      currency: CURRENCY,
      appliedOffer: priced.appliedOffer,
      originalPrice: priced.basePrice,
      discountAmount: priced.discountAmount,
      finalPrice: priced.finalPrice,
      vatAmount: parseFloat(priced.vatAmount.toFixed(2)),
      municipalFee: parseFloat(priced.municipalFee.toFixed(2)),
      environmentalTax: parseFloat(priced.environmentalTax.toFixed(2)),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Starts a payment on Stripe's hosted page. The guest's details travel in the
   * session metadata, so the booking can be created from the session alone:
   * by the return page, or by the webhook when the guest never comes back.
   */
  async createCheckoutSession(dto: CreateCheckoutSessionDto, origin?: string) {
    this.requireStripe();

    const { roomId, checkIn, checkOut, adults, children = 0, guestInfo, specialRequests, offerId } = dto;
    const lang: CheckoutLocale = CHECKOUT_LOCALES.includes(dto.language) ? dto.language : 'el';

    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    await this.assertWithinBookingWindow(checkIn, checkOut);
    await this.availability.assertSellable(roomId, new Date(checkIn), new Date(checkOut));

    const priced = await this.priceStay(room, checkIn, checkOut, adults, children, offerId);
    const roomName = localizedRoomName(room, lang);
    const image = publicImageUrl(room.image || room.images?.[0]);

    const note = String(specialRequests ?? guestInfo.specialRequests ?? '').slice(0, META_CHUNK * NOTE_CHUNKS);
    const metadata: Record<string, string> = {
      ...priced.metadata,
      guestFirstName: guestInfo.firstName,
      guestLastName: guestInfo.lastName,
      guestEmail: guestInfo.email,
      guestPhone: guestInfo.phone,
      guestLanguage: lang,
    };
    for (let i = 0; i * META_CHUNK < note.length; i++) {
      metadata[`note${i}`] = note.slice(i * META_CHUNK, (i + 1) * META_CHUNK);
    }

    // Back to the same booking page, so the summary can be rebuilt from the URL.
    const base = returnOrigins().includes(origin)
      ? origin
      : (process.env.FRONTEND_URL || SITE_URL).replace(/\/$/, '');
    const stay = new URLSearchParams({
      roomId,
      checkIn,
      checkOut,
      adults: String(adults),
      children: String(children),
      ...(dto.offerId ? { offerId: dto.offerId } : {}),
    }).toString();

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      submit_type: 'book',
      locale: lang,
      customer_email: guestInfo.email,
      // Stripe's minimum. Keeps the gap between the availability check above
      // and the payment short.
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: priced.amountCents,
            product_data: {
              name: roomName,
              description: stayDescription(
                lang,
                new Date(checkIn),
                new Date(checkOut),
                priced.nights,
                Number(adults),
                Number(children) || 0,
              ),
              ...(image ? { images: [image] } : {}),
            },
          },
        },
      ],
      custom_text: { submit: { message: submitNote(lang) } },
      branding_settings: {
        display_name: 'Asterias Homes',
        // Site palette: sand ground, plum accent (asterias-homes tailwind.config.ts).
        background_color: '#F5F1E9',
        button_color: '#8B4B5C',
        border_style: 'rounded',
        font_family: 'source_sans_pro',
        icon: { type: 'url', url: `${SITE_URL}/favicon.png` },
      },
      metadata,
      payment_intent_data: {
        description: `Asterias Homes · ${roomName} · ${checkIn} → ${checkOut}`,
        metadata,
      },
      success_url: `${base}/${lang}/book?${stay}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/${lang}/book?${stay}&payment=cancelled`,
    };

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.create(params);
    } catch (error: any) {
      // The look of the page must never cost a booking: if Stripe rejects the
      // branding or the photo, open the plain page instead.
      const param: string = error?.param || '';
      if (!param.startsWith('branding_settings') && !param.includes('images')) throw error;
      this.logger.warn(`Stripe rejected ${param} on checkout, retrying without it: ${error.message}`);
      const { branding_settings, ...plain } = params;
      delete plain.line_items[0].price_data.product_data.images;
      session = await this.stripe.checkout.sessions.create(plain);
    }

    return { url: session.url, sessionId: session.id };
  }

  /** Called by the page Stripe returns the guest to. */
  async confirmCheckoutSession(sessionId: string) {
    this.requireStripe();

    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      // Bank transfers and the like complete the page before the money moves;
      // the webhook books the stay once it does.
      if (session.status === 'complete') {
        return { pending: true, message: 'Payment is processing' };
      }
      throw new HttpException('Payment not completed', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.bookCheckoutSession(session);
    } catch (error: any) {
      if (!(error instanceof HttpException)) throw error;
      // Paid, but the stay cannot be booked. 409 tells the page to show the
      // guest our contact details instead of a retry.
      // The most important log line in the system: a guest has been charged
      // and has no room. It went to console.error with no level and no
      // structure, so it was indistinguishable from ordinary noise in
      // `docker logs`. Logger.error at least carries a level and a context
      // that a log shipper can filter on.
      this.logger.error(
        `PAID BUT NOT BOOKED: Stripe session ${session.id}, payment ${session.payment_intent}, ` +
          `${session.metadata?.guestEmail}: ${error.message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException(error.message, HttpStatus.CONFLICT);
    }
  }

  async handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    this.requireStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new HttpException('Stripe webhook is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!rawBody || !signature) {
      throw new HttpException('Missing Stripe signature', HttpStatus.BAD_REQUEST);
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (error: any) {
      throw new HttpException(`Invalid Stripe signature: ${error.message}`, HttpStatus.BAD_REQUEST);
    }

    // Refunds made in the Stripe dashboard: mirror them on the booking so the
    // admin panel and revenue figures agree with Stripe.
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) {
        await this.bookingModel.updateOne({ stripePaymentIntentId: paymentIntentId }, refundFields(charge));
      }
      return { received: true };
    }

    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'checkout.session.async_payment_succeeded'
    ) {
      return { received: true };
    }

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') {
      return { received: true };
    }

    try {
      await this.bookCheckoutSession(session);
    } catch (error: any) {
      // A paid stay that cannot be booked (dates taken meanwhile, room deleted)
      // will not fix itself on retry; the owner has to sort it out with the guest.
      // Anything else (database down) is thrown so Stripe retries.
      if (error instanceof HttpException) {
        this.logger.error(
          `PAID BUT NOT BOOKED: Stripe session ${session.id}, payment ${session.payment_intent}, ` +
            `${session.metadata?.guestEmail}: ${error.message}`,
          error instanceof Error ? error.stack : undefined,
        );
        return { received: true };
      }
      throw error;
    }

    return { received: true };
  }

  async confirmPayment(confirmPaymentDto: ConfirmPaymentDto) {
    this.requireStripe();

    const { paymentIntentId, guestInfo, specialRequests } = confirmPaymentDto;

    // Retrieve payment intent from Stripe
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new HttpException('Payment not completed', HttpStatus.BAD_REQUEST);
    }

    return this.bookPaidStay(paymentIntentId, paymentIntent.amount, paymentIntent.metadata, guestInfo, specialRequests);
  }

  private bookCheckoutSession(session: Stripe.Checkout.Session) {
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntentId) {
      throw new HttpException('Checkout session has no payment', HttpStatus.BAD_REQUEST);
    }

    const m = session.metadata || {};
    const note = Array.from({ length: NOTE_CHUNKS }, (_, i) => m[`note${i}`] || '').join('');
    const guestInfo = {
      firstName: m.guestFirstName,
      lastName: m.guestLastName,
      email: m.guestEmail,
      phone: m.guestPhone,
      language: m.guestLanguage,
    };

    return this.bookPaidStay(paymentIntentId, session.amount_total, m, guestInfo, note);
  }

  /** Creates the booking for a successful card payment, once per payment. */
  private bookPaidStay(
    paymentIntentId: string,
    amountCents: number,
    metadata: Record<string, string>,
    guestInfo: any,
    specialRequests?: string,
  ): Promise<{ message: string; booking: any }> {
    const running = this.bookingInFlight.get(paymentIntentId);
    if (running) return running;

    const job = this.createPaidBooking(paymentIntentId, amountCents, metadata, guestInfo, specialRequests).finally(
      () => this.bookingInFlight.delete(paymentIntentId),
    );
    this.bookingInFlight.set(paymentIntentId, job);
    return job;
  }

  private async createPaidBooking(
    paymentIntentId: string,
    amountCents: number,
    metadata: Record<string, string>,
    guestInfo: any,
    specialRequests?: string,
  ) {
    // Extract metadata
    const {
      roomId,
      checkIn,
      checkOut,
      adults,
      children,
      originalPrice,
      finalPrice,
      discountAmount,
      offerId,
      offerTitle,
      vatAmount,
      municipalFee,
      environmentalTax,
    } = metadata;

    // The breakdown recorded on the PaymentIntent when the guest was quoted.
    // Stored on the booking so the admin panel can show what the total is made
    // of without re-deriving it from rates that may since have changed.
    const num = (v?: string) => {
      const n = parseFloat(v ?? '');
      return Number.isFinite(n) ? n : null;
    };

    // Check if room still exists
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    // Idempotency, first attempt: a read. Cheap, and it handles the common case
    // where the webhook arrives well after the return page. It is NOT the
    // guarantee — it is a read-then-write race, and it runs outside the
    // transaction below. The guarantee is the unique index on
    // stripePaymentIntentId, caught as E11000 after the insert.
    const existing = await this.bookingModel.findOne({ stripePaymentIntentId: paymentIntentId });
    if (existing) {
      return { message: 'Payment confirmed and booking created successfully', booking: existing };
    }

    const session = await this.connection.startSession();
    let booking: any;
    try {
      await session.withTransaction(async () => {
        // withTransaction may retry after another instance committed the same
        // payment. Resolve that before testing availability of its occupied room.
        const winner = await this.bookingModel.findOne({ stripePaymentIntentId: paymentIntentId }).session(session);
        if (winner) {
          booking = winner;
          return;
        }
        await this.availability.assertSellable(
          roomId,
          new Date(checkIn),
          new Date(checkOut),
          session,
        );

        booking = await this.writer.create({
          roomId,
          guestInfo: { ...guestInfo, specialRequests: specialRequests || '' },
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          adults: Number(adults),
          children: Number(children) || 0,
          totalAmount: amountCents / 100,
          // finalPrice is the discounted subtotal, the one taxed and charged.
          roomSubtotal: num(finalPrice) ?? num(originalPrice),
          discountAmount: num(discountAmount) || null,
          offerId: offerId || null,
          offerTitle: offerId ? offerTitle || null : null,
          vatAmount: num(vatAmount),
          municipalFee: num(municipalFee),
          environmentalTax: num(environmentalTax),
          paymentMethod: PAYMENT_METHOD.CARD,
          paymentStatus: PAYMENT_STATUS.PAID,
          bookingStatus: BOOKING_STATUS.CONFIRMED,
          stripePaymentIntentId: paymentIntentId,
          bookingNumber: await this.bookingNumbers.next(session),
        }, { session, pricing: 'paid' });
      });
    } catch (error) {
      // Another process got there first. During a blue/green cutover two
      // containers are alive at once: both miss the findOne above, both pass
      // assertSellable in separate sessions, and both insert. The unique index
      // fails the second one, and the booking the winner created is the right
      // answer for this caller too.
      const duplicate = await this.handleDuplicateBooking(error, paymentIntentId);
      if (duplicate) {
        return { message: 'Payment confirmed and booking created successfully', booking: duplicate };
      }
      throw error;
    } finally {
      await session.endSession();
    }

    return {
      message: 'Payment confirmed and booking created successfully',
      booking,
    };
  }

  /**
   * Resolves a failed insert that was a duplicate payment into the booking that
   * already exists for it. Returns null when the error was something else, so
   * the caller rethrows.
   *
   * This is what makes the in-process `bookingInFlight` map an optimisation
   * rather than the guarantee it used to be.
   */
  private async handleDuplicateBooking(error: unknown, paymentIntentId: string) {
    const isDuplicateKey =
      (error as any)?.code === 11000 ||
      (error as any)?.cause?.code === 11000 ||
      /E11000/.test(String((error as any)?.message ?? ''));

    if (!isDuplicateKey) return null;

    const winner = await this.bookingModel.findOne({ stripePaymentIntentId: paymentIntentId });
    if (winner) {
      this.logger.warn(
        `Duplicate booking insert for payment ${paymentIntentId} rejected by the unique index; ` +
          `returning the existing booking`,
      );
      return winner;
    }

    // A duplicate key on some other unique field — bookingNumber, most likely.
    // That is a real failure and must not be reported as a successful booking.
    return null;
  }

  /**
   * Prices a stay for a card payment. Seasonal-aware, per-night pricing and
   * taxes both come from PricingService — the SAME code path that backs
   * GET /rooms/:id/quote, which is what the booking wizard displays. Never
   * duplicate this math here: divergence between the two is a guest overcharge.
   */
  private async priceStay(
    room: any,
    checkIn: string,
    checkOut: string,
    adults: any,
    children: any,
    offerId?: string,
  ) {
    const quote = await this.pricingService.quoteStay(room, new Date(checkIn), new Date(checkOut), adults, children);
    const nights = quote.nights;
    const basePrice = quote.subtotal;

    // An offer that does not fit the stay is dropped here exactly as the quote
    // drops it, so the guest is charged the price they were shown.
    const offer = await this.pricingService.applyOffer(basePrice, room._id, checkIn, checkOut, offerId);
    const finalPrice = offer.subtotal;

    const totalGuests = parseInt(adults) + parseInt(children || 0);
    // vatIncluded, not vatAmount: the rate already contains the VAT, so what
    // the booking records is the VAT inside the price, not a charge on top.
    const { vatIncluded: vatAmount, municipalFee, environmentalTax, total } =
      await this.pricingService.applyTaxes(finalPrice, nights, totalGuests);

    const amountCents = Math.round(total * 100);

    if (amountCents <= 0) {
      throw new HttpException('Invalid amount', HttpStatus.BAD_REQUEST);
    }

    // Check if amount exceeds Stripe's limit
    if (amountCents > 99999999) { // €999,999.99 in cents
      throw new HttpException('Amount exceeds maximum allowed limit', HttpStatus.BAD_REQUEST);
    }

    return {
      nights,
      basePrice,
      appliedOffer: offer.offer,
      discountAmount: offer.discountAmount,
      finalPrice,
      vatAmount,
      municipalFee,
      environmentalTax,
      amountCents,
      // Read back by createPaidBooking; keep the keys stable.
      metadata: {
        roomId: String(room._id),
        checkIn,
        checkOut,
        adults: String(adults),
        children: String(children || 0),
        nights: String(nights),
        offerId: offer.offer?.id ?? '',
        offerTitle: (offer.offer?.title ?? '').slice(0, 200),
        offerDiscount: offer.offer ? String(offer.offer.discount) : '',
        originalPrice: basePrice.toFixed(2),
        discountAmount: offer.discountAmount.toFixed(2),
        finalPrice: finalPrice.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        municipalFee: municipalFee.toFixed(2),
        environmentalTax: environmentalTax.toFixed(2),
        totalGuests: totalGuests.toString(),
        seasonalBreakdown: JSON.stringify(quote.perNight.map(n => ({ d: n.date, p: n.price, s: n.source }))).slice(0, 480),
      } as Record<string, string>,
    };
  }

  private requireStripe() {
    if (!this.stripe) {
      throw new HttpException('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Applies the property's advance-booking window to a guest-initiated stay.
   *
   * `minAdvanceBooking` and `maxAdvanceBooking` were settings the owner could
   * change in the admin panel that nothing read — SettingsService even had
   * validateBookingRules() written for exactly this, with zero callers.
   *
   * Only called on guest paths. An admin recording a walk-in is booking for
   * tonight by definition, so holding them to a minimum notice period would
   * stop the owner from entering a booking that has already happened.
   */
  private async assertWithinBookingWindow(checkIn: string, checkOut: string) {
    const { valid, errors } = await this.settingsService.validateBookingRules(checkIn, checkOut);
    if (!valid) {
      throw new HttpException(errors.join('. '), HttpStatus.BAD_REQUEST);
    }
  }

  async createCashBooking(
    createCashBookingDto: CreateCashBookingDto,
    options: { isAdmin: boolean } = { isAdmin: true },
  ) {
    const { isAdmin } = options;
    const { roomId, checkIn, checkOut, adults, children, totalAmount, guestInfo, specialRequests, depositAmount, depositPaid } = createCashBookingDto;

    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    // The advance-booking window applies to guests only: an admin recording a
    // walk-in is booking for tonight, which a minimum notice period forbids.
    if (!isAdmin) {
      await this.assertWithinBookingWindow(checkIn, checkOut);
    }

    // Price the stay server-side either way: an omitted amount must fall back to
    // the tax-inclusive total (the pre-tax subtotal is not what a guest pays),
    // and we need the breakdown to record on the booking.
    const quote = await this.pricingService.quoteStay(room, new Date(checkIn), new Date(checkOut), adults, children);
    const cashGuests = (parseInt(String(adults)) || 0) + (parseInt(String(children)) || 0);
    const taxes = await this.pricingService.applyTaxes(quote.subtotal, quote.nights, cashGuests);

    // A negotiated total is the owner's to set, so only an admin's amount is
    // honoured. A guest request is always priced here, whatever it asked for.
    let resolvedTotal = isAdmin ? Number(totalAmount) : NaN;
    if (!Number.isFinite(resolvedTotal) || resolvedTotal <= 0) {
      resolvedTotal = taxes.total;
    }

    // Only record a breakdown when its lines actually sum to the stored total.
    // A negotiated admin price is not explained by these figures, and showing
    // them anyway would put numbers that do not add up in front of the owner.
    const breakdown =
      Math.abs(resolvedTotal - taxes.total) < 0.01
        ? {
            roomSubtotal: quote.subtotal,
            vatAmount: taxes.vatIncluded,
            municipalFee: taxes.municipalFee,
            environmentalTax: taxes.environmentalTax,
          }
        : {};

    const bookingNumber = await this.bookingNumbers.next();
    const session = await this.connection.startSession();
    let booking: any;
    try {
      await session.withTransaction(async () => {
        await this.availability.assertSellable(
          roomId,
          new Date(checkIn),
          new Date(checkOut),
          session,
        );

        booking = await this.writer.create({
          roomId,
          guestInfo: { ...guestInfo, specialRequests: specialRequests || '' },
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          adults: Number(adults),
          children: Number(children) || 0,
          totalAmount: resolvedTotal,
          ...breakdown,
          paymentMethod: PAYMENT_METHOD.CASH,
          paymentStatus: PAYMENT_STATUS.PENDING,
          // A guest asking to pay cash has handed over no money, so the room is
          // not held until the property confirms. Otherwise anyone could block
          // the whole property for free.
          bookingStatus: isAdmin ? BOOKING_STATUS.CONFIRMED : BOOKING_STATUS.PENDING,
          awaitingPropertyConfirmation: !isAdmin,
          bookingNumber,
          depositAmount: isAdmin && depositAmount != null ? Number(depositAmount) : 0,
          depositPaid: isAdmin && depositPaid === true,
          depositPaidAt: isAdmin && depositPaid === true ? new Date() : null,
        }, { session, pricing: isAdmin ? 'negotiated' : 'quote' });
      });
    } finally {
      await session.endSession();
    }

    return {
      message: isAdmin
        ? 'Cash booking created successfully'
        : 'Cash booking requested; awaiting confirmation from the property',
      booking,
    };
  }

  // Explicit return type: inferring it would reference Stripe's internal
  // PaymentIntent Status union, which is not importable from here.
  async getPaymentStatus(
    paymentIntentId: string,
  ): Promise<{ status: string; amount: number; currency: string }> {
    if (!this.stripe) {
      throw new HttpException('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    
    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    };
  }

  // generateBookingNumber() is gone. It was duplicated byte for byte in
  // CalendarBookingsRepository, and both reached past Mongoose into a raw
  // `counters` collection with no model or schema. BookingNumberService owns it.
}