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
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { OffersService, CreateOfferDto, UpdateOfferDto, ApplicableOffersDto, ValidateCodeDto } from './offers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get all active offers (public)' })
  @ApiResponse({ status: 200, description: 'Active offers retrieved successfully' })
  async getActiveOffers() {
    const offers = await this.offersService.getActiveOffers();
    return { offers };
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get single offer by ID (public)' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: 200, description: 'Offer retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async getOfferById(@Param('id') id: string) {
    const offer = await this.offersService.getOfferById(id);
    return { offer };
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new offer (admin only)' })
  @ApiResponse({ status: 201, description: 'Offer created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async createOffer(@Body() createOfferDto: CreateOfferDto) {
    const offer = await this.offersService.createOffer(createOfferDto);
    return {
      message: 'Offer created successfully',
      offer
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update offer (admin only)' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: 200, description: 'Offer updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async updateOffer(@Param('id') id: string, @Body() updateOfferDto: UpdateOfferDto) {
    const offer = await this.offersService.updateOffer(id, updateOfferDto);
    return {
      message: 'Offer updated successfully',
      offer
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete offer (admin only)' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: 200, description: 'Offer deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async deleteOffer(@Param('id') id: string) {
    await this.offersService.deleteOffer(id);
    return { message: 'Offer deleted successfully' };
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get all offers (admin only)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'active', required: false, description: 'Filter by active status' })
  @ApiResponse({ status: 200, description: 'All offers retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getAllOffers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('active') active?: string
  ) {
    const result = await this.offersService.getAllOffers(
      parseInt(page.toString()),
      parseInt(limit.toString()),
      active !== undefined ? active === 'true' : undefined
    );
    return result;
  }

  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Toggle offer active status (admin only)' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: 200, description: 'Offer status toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async toggleOfferStatus(@Param('id') id: string) {
    const offer = await this.offersService.toggleOfferStatus(id);
    return {
      message: `Offer ${offer.active ? 'activated' : 'deactivated'} successfully`,
      offer
    };
  }

  @Post('applicable')
  @ApiOperation({ summary: 'Get applicable offers for dates and room' })
  @ApiResponse({ status: 200, description: 'Applicable offers retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async getApplicableOffers(@Body() applicableOffersDto: ApplicableOffersDto) {
    const offers = await this.offersService.getApplicableOffers(applicableOffersDto);
    return {
      message: 'Applicable offers retrieved successfully',
      offers: offers.map(offer => ({
        id: offer._id,
        title: offer.title,
        titleKey: offer.titleKey,
        description: offer.description,
        descriptionKey: offer.descriptionKey,
        discount: offer.discount,
        image: offer.image,
        conditions: offer.conditions,
        code: offer.code,
        badgeKey: offer.badgeKey,
        roomTypeKey: offer.roomTypeKey,
        includesKeys: offer.includesKeys,
        featured: offer.featured
      }))
    };
  }

  @Post('validate-code')
  @ApiOperation({ summary: 'Validate offer code' })
  @ApiResponse({ status: 200, description: 'Offer code is valid' })
  @ApiResponse({ status: 400, description: 'Invalid offer code or requirements not met' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async validateOfferCode(@Body() validateCodeDto: ValidateCodeDto) {
    const offer = await this.offersService.validateOfferCode(validateCodeDto);
    return {
      message: 'Offer code is valid',
      offer: {
        id: offer._id,
        title: offer.title,
        description: offer.description,
        discount: offer.discount,
        conditions: offer.conditions
      }
    };
  }
}
