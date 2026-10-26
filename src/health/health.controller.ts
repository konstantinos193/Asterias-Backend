import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import Stripe from 'stripe';
import { Response } from 'express';
import { join } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

const STRIPE_CACHE_TTL_MS = 60_000;

@Controller()
export class HealthController {
  private stripe: InstanceType<typeof Stripe>;
  private stripeCache: { result: object; at: number } | null = null;

  constructor(
    @InjectConnection() private readonly dbConnection: Connection,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
  }

  /**
   * Admin only. The public version returned the database host and database
   * name, which is reconnaissance for anyone deciding where to point an attack.
   */
  @Get('health/database')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getDatabaseHealth() {
    try {
      const dbState = this.dbConnection.readyState;
      const isHealthy = dbState === 1;

      return {
        status: isHealthy ? 'OK' : 'ERROR',
        database: 'MongoDB',
        connected: isHealthy,
        readyState: dbState,
        host: this.dbConnection.host,
        name: this.dbConnection.name,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'ERROR',
        database: 'MongoDB',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Admin only. This used to publish the Stripe account's available and
   * pending balances to anyone who asked — the property's cash position, on an
   * unauthenticated URL.
   */
  @Get('health/stripe')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getStripeHealth() {
    if (this.stripeCache && Date.now() - this.stripeCache.at < STRIPE_CACHE_TTL_MS) {
      return this.stripeCache.result;
    }

    try {
      const balance = await this.stripe.balance.retrieve();
      const result = {
        status: 'OK',
        service: 'Stripe',
        connected: true,
        available_balance: balance.available,
        pending_balance: balance.pending,
        livemode: balance.livemode,
        timestamp: new Date().toISOString()
      };
      this.stripeCache = { result, at: Date.now() };
      return result;
    } catch (error: any) {
      return {
        status: 'ERROR',
        service: 'Stripe',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Public liveness probe, and deliberately boring. It used to report the
   * environment, process uptime and a full memory breakdown, which tells an
   * attacker when the process last restarted and how it is responding to load.
   */
  @Get('health')
  getHealth() {
    return {
      status: 'OK',
      message: 'Asterias Homes API is running',
      timestamp: new Date().toISOString(),
    };
  }

  /** Admin-only detail for the uptime dashboard. */
  @Get('health/details')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getHealthDetails() {
    return {
      status: 'OK',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.1',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  getRoot(@Res() res: Response) {
    res.sendFile(join(process.cwd(), 'public', 'index.html'));
  }
}
