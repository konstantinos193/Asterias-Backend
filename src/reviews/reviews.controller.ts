import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BypassAuthGuard } from '../auth/guards/bypass-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ImportReviewsDto } from './dto/import-reviews.dto';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';

@ApiTags('reviews')
@Controller('reviews')
@UseGuards(BypassAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new review' })
  @ApiResponse({ status: 201, description: 'Review successfully created' })
  create(@Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.create(createReviewDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reviews with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  findAll(@Query() query: any) {
    return this.reviewsService.findAll({
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      source: query.source,
      rating: query.rating ? parseInt(query.rating) : undefined,
      visible: query.visible !== undefined ? query.visible === 'true' : undefined,
      featured: query.featured !== undefined ? query.featured === 'true' : undefined,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      search: query.search
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get review statistics and rating breakdown' })
  @ApiResponse({ status: 200, description: 'Review statistics retrieved successfully' })
  getStats() {
    return this.reviewsService.getRatingStats();
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent reviews' })
  @ApiResponse({ status: 200, description: 'Recent reviews retrieved successfully' })
  getRecent(@Query('limit') limit?: string) {
    return this.reviewsService.getRecentReviews(limit ? parseInt(limit) : 10);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured reviews' })
  @ApiResponse({ status: 200, description: 'Featured reviews retrieved successfully' })
  getFeatured(@Query('limit') limit?: string) {
    return this.reviewsService.getFeaturedReviews(limit ? parseInt(limit) : 5);
  }

  @Get('sentiment')
  @ApiOperation({ summary: 'Get sentiment analysis of reviews' })
  @ApiResponse({ status: 200, description: 'Sentiment analysis retrieved successfully' })
  getSentimentAnalysis() {
    return this.reviewsService.getSentimentAnalysis();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiResponse({ status: 200, description: 'Review retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findOne(@Param('id', MongoObjectIdPipe) id: string) {
    const review = await this.reviewsService.findOne(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update review' })
  @ApiResponse({ status: 200, description: 'Review successfully updated' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async update(@Param('id', MongoObjectIdPipe) id: string, @Body() updateReviewDto: UpdateReviewDto) {
    const review = await this.reviewsService.update(id, updateReviewDto);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete review' })
  @ApiResponse({ status: 200, description: 'Review successfully deleted' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async remove(@Param('id', MongoObjectIdPipe) id: string) {
    const review = await this.reviewsService.remove(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  // Admin endpoints
  @Post('import/google')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Import Google reviews' })
  @ApiResponse({ status: 200, description: 'Google reviews imported successfully' })
  importGoogleReviews(@Body() importData: ImportReviewsDto) {
    return this.reviewsService.importGoogleReviews(importData);
  }

  @Patch(':id/toggle-featured')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toggle review featured status' })
  @ApiResponse({ status: 200, description: 'Review featured status toggled successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async toggleFeatured(@Param('id', MongoObjectIdPipe) id: string) {
    return this.reviewsService.toggleFeatured(id);
  }

  @Patch(':id/toggle-visibility')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toggle review visibility' })
  @ApiResponse({ status: 200, description: 'Review visibility toggled successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async toggleVisibility(@Param('id', MongoObjectIdPipe) id: string) {
    return this.reviewsService.toggleVisibility(id);
  }

  @Patch(':id/response')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add response to review' })
  @ApiResponse({ status: 200, description: 'Response added successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async addResponse(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body('responseText') responseText: string
  ) {
    return this.reviewsService.addResponse(id, responseText);
  }
}
