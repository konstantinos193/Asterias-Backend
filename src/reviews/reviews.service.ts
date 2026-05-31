import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Review, ReviewDocument } from '../models/review.model';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ImportReviewsDto } from './dto/import-reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(@InjectModel(Review.name) private reviewModel: Model<ReviewDocument>) {}

  async create(createReviewDto: CreateReviewDto): Promise<Review> {
    const review = new this.reviewModel(createReviewDto);
    return review.save();
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    source?: string;
    rating?: number;
    visible?: boolean;
    featured?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
  }): Promise<{ reviews: Review[]; total: number; pagination: any }> {
    const {
      page = 1,
      limit = 20,
      source,
      rating,
      visible,
      featured,
      sortBy = 'reviewDate',
      sortOrder = 'desc',
      search
    } = params;

    // Build filter
    const filter: any = {};
    if (source) filter.source = source;
    if (rating) filter.rating = rating;
    if (visible !== undefined) filter.visible = visible;
    if (featured !== undefined) filter.featured = featured;

    // Add search filter
    if (search) {
      filter.$or = [
        { reviewerName: { $regex: search, $options: 'i' } },
        { reviewText: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      this.reviewModel.countDocuments(filter)
    ]);

    return {
      reviews,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async findOne(id: string): Promise<Review | null> {
    return this.reviewModel.findById(id).exec();
  }

  async update(id: string, updateReviewDto: UpdateReviewDto): Promise<Review | null> {
    const review = await this.reviewModel.findByIdAndUpdate(
      id,
      updateReviewDto,
      { returnDocument: 'after' }
    ).exec();
    
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    
    return review;
  }

  async remove(id: string): Promise<Review | null> {
    const review = await this.reviewModel.findByIdAndDelete(id).exec();
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async importGoogleReviews(importData: ImportReviewsDto): Promise<{ 
    imported: number; 
    updated: number; 
    skipped: number; 
    errors: string[] 
  }> {
    const { reviews, overwriteExisting = false } = importData;
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const reviewData of reviews) {
      try {
        // Check if review already exists (by source and sourceId)
        if (reviewData.sourceId) {
          const existingReview = await this.reviewModel.findOne({
            source: 'google',
            sourceId: reviewData.sourceId
          });

          if (existingReview) {
            if (overwriteExisting) {
              await this.reviewModel.updateOne(
                { _id: existingReview._id },
                reviewData
              );
              updated++;
            } else {
              skipped++;
            }
            continue;
          }
        }

        // Create new review
        const review = new this.reviewModel({
          ...reviewData,
          source: 'google',
          visible: true,
          verified: false
        });
        
        await review.save();
        imported++;
      } catch (error: any) {
        errors.push(`Failed to import review from ${reviewData.reviewerName}: ${error.message}`);
      }
    }

    return { imported, updated, skipped, errors };
  }

  async getRatingStats(): Promise<any> {
    const stats = await this.reviewModel.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          },
          sourceBreakdown: {
            $push: {
              source: '$source',
              rating: '$rating'
            }
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: [0, 0, 0, 0, 0],
        sourceBreakdown: {}
      };
    }

    const distribution = [0, 0, 0, 0, 0];
    stats[0].ratingDistribution.forEach((rating: number) => {
      distribution[rating - 1]++;
    });

    // Calculate source breakdown
    const sourceBreakdown: any = {};
    stats[0].sourceBreakdown.forEach((item: any) => {
      if (!sourceBreakdown[item.source]) {
        sourceBreakdown[item.source] = {
          count: 0,
          totalRating: 0,
          averageRating: 0
        };
      }
      sourceBreakdown[item.source].count++;
      sourceBreakdown[item.source].totalRating += item.rating;
    });

    Object.keys(sourceBreakdown).forEach(source => {
      sourceBreakdown[source].averageRating = 
        Math.round((sourceBreakdown[source].totalRating / sourceBreakdown[source].count) * 10) / 10;
    });

    return {
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
      totalReviews: stats[0].totalReviews,
      ratingDistribution: distribution,
      sourceBreakdown
    };
  }

  async getRecentReviews(limit = 10): Promise<Review[]> {
    return this.reviewModel
      .find({ visible: true })
      .sort({ reviewDate: -1 })
      .limit(limit)
      .exec();
  }

  async getFeaturedReviews(limit = 5): Promise<Review[]> {
    return this.reviewModel
      .find({ visible: true, featured: true })
      .sort({ reviewDate: -1 })
      .limit(limit)
      .exec();
  }

  async toggleFeatured(id: string): Promise<Review> {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    
    review.featured = !review.featured;
    return review.save();
  }

  async toggleVisibility(id: string): Promise<Review> {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    
    review.visible = !review.visible;
    return review.save();
  }

  async addResponse(id: string, responseText: string): Promise<Review> {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    
    review.responseText = responseText;
    review.responseDate = new Date();
    return review.save();
  }

  async getSentimentAnalysis(): Promise<any> {
    const reviews = await this.reviewModel.find({ visible: true }).select('rating reviewText');
    
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    
    reviews.forEach(review => {
      if (review.rating >= 4) {
        positive++;
      } else if (review.rating === 3) {
        neutral++;
      } else {
        negative++;
      }
    });
    
    const total = reviews.length;
    
    return {
      positive: total > 0 ? Math.round((positive / total) * 100) : 0,
      neutral: total > 0 ? Math.round((neutral / total) * 100) : 0,
      negative: total > 0 ? Math.round((negative / total) * 100) : 0,
      distribution: {
        positive,
        neutral,
        negative,
        total
      }
    };
  }
}
