import { Controller, Get, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import Stripe from 'stripe';

@Controller()
export class HealthController {
  private stripe: Stripe;

  constructor(
    @InjectConnection() private readonly dbConnection: Connection,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
  }
  @Get('health/database')
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
    } catch (error) {
      return {
        status: 'ERROR',
        database: 'MongoDB',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('health/stripe')
  async getStripeHealth() {
    try {
      const balance = await this.stripe.balance.retrieve();
      
      return {
        status: 'OK',
        service: 'Stripe',
        connected: true,
        available_balance: balance.available,
        pending_balance: balance.pending,
        livemode: balance.livemode,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        service: 'Stripe',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('health')
  getHealth() {
    return {
      status: 'OK',
      message: 'Asterias Homes API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.1'
    };
  }

  @Get()
  getRoot() {
    return {
      message: 'Welcome to Asterias Homes API',
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth',
        rooms: '/api/rooms',
        bookings: '/api/bookings',
        offers: '/api/offers',
        contact: '/api/contact',
        admin: '/api/admin',
        payments: '/api/payments',
        availability: '/api/availability',
        docs: '/api/docs',
        health: '/health'
      }
    };
  }
}
