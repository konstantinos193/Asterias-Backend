import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BypassAuthGuard } from '../auth/guards/bypass-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RequireAdmin } from '../auth/decorators/require-admin.decorator';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    try {
      return await this.adminService.getDashboard();
    } catch (error) {
      throw new HttpException(
        'Failed to get dashboard data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics')
  async getAnalytics(
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      return await this.adminService.getAnalytics({ period, startDate, endDate });
    } catch (error) {
      throw new HttpException(
        'Failed to get analytics data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('revenue-reports')
  async getRevenueReports(@Query('period') period?: string) {
    try {
      return await this.adminService.getRevenueReports(period);
    } catch (error) {
      throw new HttpException(
        'Failed to get revenue reports',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('bookings')
  async getBookings(
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('checkIn') checkIn?: string,
    @Query('checkOut') checkOut?: string,
    @Query('guestEmail') guestEmail?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    try {
      return await this.adminService.getBookings({
        status,
        paymentStatus,
        checkIn,
        checkOut,
        guestEmail,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc',
      });
    } catch (error) {
      throw new HttpException(
        'Failed to get bookings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('bookings/:bookingId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async getBookingById(@Param('bookingId', MongoObjectIdPipe) bookingId: string) {
    try {
      return await this.adminService.getBookingById(bookingId);
    } catch (error) {
      if (error.message === 'Booking not found') {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to get booking',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('bookings/:bookingId/cancel')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async cancelBooking(
    @Param('bookingId', MongoObjectIdPipe) bookingId: string,
    @Body() body: { cancellationReason?: string; refundAmount?: number; adminNotes?: string },
  ) {
    try {
      return await this.adminService.cancelBooking(bookingId, body);
    } catch (error) {
      if (error.message === 'Booking not found') {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error.message.includes('already cancelled') || error.message.includes('Cannot cancel')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Failed to cancel booking',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('bookings/bulk/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async bulkUpdateBookingStatus(
    @Body() body: { bookingIds: string[]; status: 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT'; adminNotes?: string },
  ) {
    try {
      return await this.adminService.bulkUpdateBookingStatus(body);
    } catch (error) {
      if (error.message === 'No booking IDs provided' || error.message === 'No bookings found with the provided IDs') {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Failed to update bookings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('bookings/bulk')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async bulkDeleteBookings(@Body() body: { bookingIds: string[] }) {
    try {
      return await this.adminService.bulkDeleteBookings(body.bookingIds);
    } catch (error) {
      if (error.message === 'No booking IDs provided' || error.message === 'No bookings found with the provided IDs') {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Failed to delete bookings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('bookings/:bookingId/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async updateBookingStatus(
    @Param('bookingId', MongoObjectIdPipe) bookingId: string,
    @Body() body: { status: 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT'; adminNotes?: string },
  ) {
    try {
      return await this.adminService.updateBookingStatus(bookingId, body);
    } catch (error) {
      if (error.message === 'Booking not found') {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error.message === 'Invalid status') {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Failed to update booking status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('room-availability')
  async getRoomAvailability() {
    try {
      return await this.adminService.getRoomAvailability();
    } catch (error) {
      throw new HttpException(
        'Failed to get room availability',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rooms')
  async getRooms(
    @Query('available') available?: string,
    @Query('roomType') roomType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    try {
      return await this.adminService.getRooms({
        available: available === 'true',
        roomType,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc',
      });
    } catch (error) {
      throw new HttpException(
        'Failed to get rooms',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rooms/:id')
  async getRoomById(@Param('id', MongoObjectIdPipe) id: string) {
    try {
      return await this.adminService.getRoomById(id);
    } catch (error) {
      if (error.message === 'Room not found') {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to get room',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rooms')
  async createRoom(@Body() body: any) {
    try {
      return await this.adminService.createRoom(body);
    } catch (error) {
      throw new HttpException(
        'Failed to create room',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('rooms/:id')
  async updateRoom(@Param('id', MongoObjectIdPipe) id: string, @Body() body: any) {
    console.log('🔧 AdminController.updateRoom called:', { id, bodyKeys: Object.keys(body), hasImages: !!body.images, imagesCount: body.images?.length });
    try {
      const result = await this.adminService.updateRoom(id, body);
      console.log('🔧 AdminController.updateRoom result:', { success: true, hasImages: !!result.images, imagesCount: result.images?.length });
      return result;
    } catch (error) {
      console.log('🔧 AdminController.updateRoom error:', error.message);
      if (error.message === 'Room not found') {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to update room',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('offers')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async getOffers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('active') active?: string,
  ) {
    try {
      return await this.adminService.getOffers({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        active: active !== undefined ? active === 'true' : undefined,
      });
    } catch (error) {
      throw new HttpException(
        'Failed to get offers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('offers/:offerId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async getOfferById(@Param('offerId', MongoObjectIdPipe) offerId: string) {
    try {
      return await this.adminService.getOfferById(offerId);
    } catch (error) {
      if (error.message === 'Offer not found') {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to get offer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('offers')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async createOffer(@Body() body: any) {
    try {
      return await this.adminService.createOffer(body);
    } catch (error) {
      console.error('AdminController.createOffer error:', error);
      
      // Handle specific validation errors
      if (error.message === 'End date must be after start date' || 
          error.message === 'Offer code already exists') {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      
      // Handle mongoose validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        throw new HttpException(messages.join(', '), HttpStatus.BAD_REQUEST);
      }
      
      // Handle other known errors
      if (error.message) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      
      // Fallback for unknown errors
      throw new HttpException(
        'Failed to create offer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('offers/:offerId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async updateOffer(
    @Param('offerId', MongoObjectIdPipe) offerId: string,
    @Body() body: any,
  ) {
    try {
      return await this.adminService.updateOffer(offerId, body);
    } catch (error) {
      if (error.message === 'Offer not found') {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error.message === 'End date must be after start date') {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Failed to update offer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('offers/:offerId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async deleteOffer(@Param('offerId', MongoObjectIdPipe) offerId: string) {
    try {
      return await this.adminService.deleteOffer(offerId);
    } catch (error) {
      if (error.message === 'Offer not found') {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to delete offer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('offers/:offerId/toggle')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async toggleOfferStatus(@Param('offerId', MongoObjectIdPipe) offerId: string) {
    try {
      return await this.adminService.toggleOfferStatus(offerId);
    } catch (error) {
      if (error.message === 'Offer not found') {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to toggle offer status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: 'ADMIN' | 'USER',
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    try {
      return await this.adminService.getUsers({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        role,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        search,
      });
    } catch (error) {
      throw new HttpException(
        'Failed to get users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
