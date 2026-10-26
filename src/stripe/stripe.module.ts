import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export const STRIPE_CLIENT = 'STRIPE_CLIENT';

/**
 * The Stripe client, or null when no key is configured.
 *
 * Null is a legal value in development, where the app must boot without
 * payment credentials. Every consumer therefore has to check — PaymentsService
 * and AdminService do so through `requireStripe()`, which turns it into a clear
 * "Stripe is not configured" rather than a crash.
 */
export type StripeClient = Stripe | null;

/**
 * One Stripe client for the whole application.
 *
 * There were three, constructed independently:
 *   - PaymentsService:  STRIPE_SECRET_KEY ? new Stripe(...) : null
 *   - AdminService:     STRIPE_SECRET_KEY ? new Stripe(...) : null
 *   - HealthController: new Stripe(STRIPE_SECRET_KEY || 'sk_test_dummy')
 *
 * No shared configuration and no pinned API version between them, and the
 * health controller's dummy-key fallback meant a missing key surfaced as a
 * confusing Stripe authentication error from /health/stripe instead of a clear
 * "not configured".
 *
 * Global so a consumer does not have to import the module to inject the client.
 */
@Global()
@Module({
  providers: [
    {
      provide: STRIPE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StripeClient => {
        const secretKey = config.get<string>('STRIPE_SECRET_KEY');
        if (!secretKey) return null;

        return new Stripe(secretKey, {
          // Pinned deliberately, to the version this SDK was generated against
          // (stripe@23 — see node_modules/stripe/cjs/apiVersion.js). Left
          // unset, the SDK follows the account's default version, so a
          // dashboard change to that default alters the shape of webhook
          // payloads and API responses under a running deployment with no code
          // change to point at. Bump this together with the SDK, not alone.
          apiVersion: '2026-09-30.endive',
          appInfo: { name: 'Asterias Homes', version: '1.2.0' },
          maxNetworkRetries: 2,
        });
      },
    },
  ],
  exports: [STRIPE_CLIENT],
})
export class StripeModule {}
