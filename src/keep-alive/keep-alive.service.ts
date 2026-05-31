import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);
  private intervals: NodeJS.Timeout[] = [];

  constructor() {
    this.logger.log('KeepAliveService initialized');
  }

  startKeepAlive() {
    // Ping your own service every 10 minutes to keep it awake
    const interval = setInterval(async () => {
      try {
        const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://asterias-backend.onrender.com';
        const response = await fetch(`${baseUrl}/health`, {
          method: 'GET',
          headers: {
            'User-Agent': 'Keep-Alive-Service'
          }
        });
        
        if (response.ok) {
          this.logger.debug('Keep-alive ping successful');
        } else {
          this.logger.warn(`Keep-alive ping failed with status: ${response.status}`);
        }
      } catch (error) {
        this.logger.error('Keep-alive ping failed:', error);
      }
    }, 10 * 60 * 1000); // 10 minutes

    this.intervals.push(interval);
    this.logger.log('Keep-alive service started (pings every 10 minutes)');
  }

  stopKeepAlive() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    this.logger.log('Keep-alive service stopped');
  }

  onModuleDestroy() {
    this.stopKeepAlive();
  }
}
