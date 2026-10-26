import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { SettingsService } from '../../settings/settings.service';

/**
 * Turns the `maintenanceMode` setting into something that actually happens.
 *
 * The flag was in the settings schema and on the admin screen, and nothing read
 * it: the owner could switch maintenance mode on and the site carried on
 * selling rooms.
 *
 * What it refuses, and what it must not:
 *   - guest-facing writes are refused with 503 — taking bookings and payments
 *     is exactly what maintenance mode is for;
 *   - reads are allowed through, so the site still renders and a guest looking
 *     up an existing booking is not locked out;
 *   - the admin API and auth are always allowed, or the owner could not log in
 *     to switch it back off;
 *   - Stripe webhooks are always allowed. A payment that has already been taken
 *     must still become a booking, otherwise maintenance mode creates exactly
 *     the PAID BUT NOT BOOKED case the webhook exists to prevent;
 *   - /health is always allowed, so the uptime monitor and the container's own
 *     health check do not read maintenance as an outage.
 *
 * Bound globally in app.module.ts.
 */
@Injectable()
export class MaintenanceModeGuard implements CanActivate {
  private readonly logger = new Logger(MaintenanceModeGuard.name);

  /** Path prefixes that work in maintenance mode regardless of method. */
  private static readonly ALWAYS_ALLOWED = [
    '/health',
    '/api/admin',
    '/api/auth',
    '/api/payments/webhook',
    '/api/payments/stripe-webhook',
    '/api/payments/confirm-payment',
    '/api/payments/confirm-checkout-session',
    '/api/bookingcom-webhooks',
  ];

  private static readonly READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

  constructor(private readonly settingsService: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request>();
    const path = (request.originalUrl || request.url || '').split('?')[0];

    if (MaintenanceModeGuard.READ_METHODS.includes(request.method)) return true;
    if (MaintenanceModeGuard.ALWAYS_ALLOWED.some((prefix) => path.startsWith(prefix))) return true;

    // Settings are cached for 5 minutes, so this is not a database read per
    // request. A failure to read them must not take the site down, so
    // getEffectiveSettings() falling back to the declared default (off) is the
    // right behaviour here.
    const enabled = await this.settingsService.get('maintenanceMode');
    if (!enabled) return true;

    this.logger.warn(`Maintenance mode refused ${request.method} ${path}`);
    throw new ServiceUnavailableException(
      'The site is temporarily unavailable for maintenance. Please try again shortly.',
    );
  }
}
