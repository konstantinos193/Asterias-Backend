const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  nameKey: { type: String, required: true },
  description: {
    type: String,
    required: true
  },
  descriptionKey: { type: String, required: true },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  size: {
    type: String,
    default: null
  },
  bedType: {
    type: String,
    required: true
  },
  view: {
    type: String,
    default: null
  },
  bathroom: {
    type: String,
    default: null
  },
  features: [{
    type: String
  }],
  featureKeys: [{ type: String }],
  amenities: {
    wifi: { type: Boolean, default: true },
    ac: { type: Boolean, default: true },
    tv: { type: Boolean, default: true },
    minibar: { type: Boolean, default: false },
    balcony: { type: Boolean, default: false },
    seaView: { type: Boolean, default: false },
    roomService: { type: Boolean, default: false },
    safe: { type: Boolean, default: true }
  },
  totalRooms: {
    type: Number,
    default: 1,
    min: 1
  },
  image: {
    type: String,
    default: null
  },
  images: [{
    type: String
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  bookingcom_room_id: {
    type: String,
    default: null,
    unique: true,
    sparse: true
  },
  source: {
    type: String,
    enum: ['asterias', 'bookingcom'],
    default: 'asterias'
  }
}, {
  timestamps: true
});

// Index for better query performance
roomSchema.index({ capacity: 1 });

// Virtual for average rating
roomSchema.virtual('averageRating').get(function() {
  return this.rating;
});

// Method to update rating
roomSchema.methods.updateRating = function(newRating) {
  const totalRating = (this.rating * this.reviewCount) + newRating;
  this.reviewCount += 1;
  this.rating = totalRating / this.reviewCount;
  return this.save();
};

module.exports = mongoose.model('Room', roomSchema); 