import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Connection observability for the Mongo connection.
 *
 * This module used to contain nothing but a single success log, which made it
 * look as though it configured the connection — it does not, `MongooseModule`
 * does, and this is imported after it to make that ordering obvious.
 *
 * What it does own is the connection lifecycle: a dropped or re-established
 * connection previously showed up only indirectly, as a wave of failing
 * requests with no line saying why.
 */
@Module({})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  onModuleInit() {
    const states: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    this.logger.log(
      `MongoDB ${states[this.connection.readyState] ?? this.connection.readyState} ` +
        `(db: ${this.connection.name || 'unknown'})`,
    );

    this.connection.on('disconnected', () => this.logger.error('MongoDB connection lost'));
    this.connection.on('reconnected', () => this.logger.warn('MongoDB connection re-established'));
    this.connection.on('error', (error: Error) =>
      this.logger.error(`MongoDB connection error: ${error.message}`),
    );
  }
}
