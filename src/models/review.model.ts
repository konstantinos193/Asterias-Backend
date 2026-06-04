import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review {
  @ApiProperty()
  @Prop({ required: true, trim: true })
  reviewerName: string;

  @ApiProperty()
  @Prop({ required: true, trim: true })
  reviewText: string;

  @ApiProperty()
  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @ApiProperty()
  @Prop({ required: true, trim: true })
  source: 'google' | 'bookingcom' | 'tripadvisor' | 'internal';

  @ApiProperty()
  @Prop({ required: false })
  sourceId?: string;

  @ApiProperty()
  @Prop({ required: false })
  reviewerProfileUrl?: string;

  @ApiProperty()
  @Prop({ required: false, enum: ['LOCAL_GUIDE', 'USER', 'OWNER', 'VERIFIED'] })
  reviewerType?: 'LOCAL_GUIDE' | 'USER' | 'OWNER' | 'VERIFIED';

  @ApiProperty()
  @Prop({ required: false })
  reviewDate?: Date;

  @ApiProperty()
  @Prop({ required: false })
  responseText?: string;

  @ApiProperty()
  @Prop({ required: false })
  responseDate?: Date;

  @ApiProperty()
  @Prop({ required: false })
  helpfulCount?: number;

  @ApiProperty()
  @Prop({ required: false })
  photoUrls?: string[];

  @ApiProperty()
  @Prop({ default: true })
  visible: boolean;

  @ApiProperty()
  @Prop({ default: false })
  featured: boolean;

  @ApiProperty()
  @Prop({ default: false })
  verified: boolean;

  @ApiProperty()
  @Prop({ required: false })
  language?: string;

  @ApiProperty()
  @Prop({ required: false, type: { el: String, en: String, de: String } })
  translations?: {
    el?: string;
    en?: string;
    de?: string;
  };

  @ApiProperty()
  @Prop({ required: false, type: [String] })
  tags?: string[];

  @ApiProperty()
  @Prop({ required: false })
  sentiment?: 'positive' | 'neutral' | 'negative';

  @ApiProperty()
  @Prop({ default: 0 })
  reportCount: number;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Indexes for better query performance
ReviewSchema.index({ rating: -1 });
ReviewSchema.index({ reviewDate: -1 });
ReviewSchema.index({ source: 1 });
ReviewSchema.index({ visible: 1 });
ReviewSchema.index({ featured: 1 });
ReviewSchema.index({ source: 1, visible: 1 });
ReviewSchema.index({ visible: 1, featured: 1 });
ReviewSchema.index({ sentiment: 1 });
ReviewSchema.index({ reviewerName: 'text', reviewText: 'text' });
ReviewSchema.index({ source: 1, reviewDate: -1 });
ReviewSchema.index({ visible: 1, reviewDate: -1 });

// Virtual for average rating calculation
ReviewSchema.virtual('summary').get(function(this: ReviewDocument) {
  return {
    id: this._id,
    reviewerName: this.reviewerName,
    rating: this.rating,
    reviewText: this.reviewText.length > 150 ? this.reviewText.substring(0, 150) + '...' : this.reviewText,
    reviewDate: this.reviewDate,
    source: this.source,
    featured: this.featured,
    verified: this.verified
  };
});

// Static methods for aggregation
ReviewSchema.statics.getRatingStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: [0, 0, 0, 0, 0]
    };
  }

  const distribution = [0, 0, 0, 0, 0];
  stats[0].ratingDistribution.forEach((rating: number) => {
    distribution[rating - 1]++;
  });

  return {
    averageRating: Math.round(stats[0].averageRating * 10) / 10,
    totalReviews: stats[0].totalReviews,
    ratingDistribution: distribution
  };
};

ReviewSchema.statics.getRecentReviews = async function(limit = 10) {
  return this.find({ visible: true })
    .sort({ reviewDate: -1 })
    .limit(limit)
    .exec();
};

ReviewSchema.statics.getFeaturedReviews = async function(limit = 5) {
  return this.find({ visible: true, featured: true })
    .sort({ reviewDate: -1 })
    .limit(limit)
    .exec();
};
