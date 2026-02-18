import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  getHealth() {
    return {
      status: 'OK',
      message: 'Asterias Homes API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
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
