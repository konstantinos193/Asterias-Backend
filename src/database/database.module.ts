import { Module, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Logger } from '@nestjs/common';

@Module({})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit() {
    this.logger.log('✅ Connected to MongoDB successfully');

    // Fix problematic database indexes
    try {
      // Import the Booking model and schema dynamically
      const { Booking, BookingSchema } = await import('../models/booking.model');
      
      // Get the model from the connection
      const BookingModel = this.connection.model('Booking', BookingSchema) as any;
      await BookingModel.dropProblematicIndexes();
      
      // If normal fix fails, try emergency fix
      const indexes = await BookingModel.collection.indexes();
      const stillProblematic = indexes.find((index: any) => 
        index.key && index.key.bookingcom_booking_id === 1 && index.unique === true
      );
      
      if (stillProblematic) {
        this.logger.warn('🚨 Normal fix failed, attempting emergency collection recreation...');
        await BookingModel.emergencyFixCollection();
      }
      
    } catch (error: any) {
      this.logger.warn('⚠️ Warning: Could not fix database indexes:', error.message);
    }
  }
}
