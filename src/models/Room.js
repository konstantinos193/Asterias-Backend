const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
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
  available: {
    type: Boolean,
    default: true
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
  }
}, {
  timestamps: true
});

// Index for better query performance
roomSchema.index({ available: 1, price: 1 });
roomSchema.index({ capacity: 1 });

// Virtual for average rating
roomSchema.virtual('averageRating').get(function() {
  return this.rating;
});

// Method to check availability for a date range
roomSchema.methods.isAvailableForDates = function(checkIn, checkOut) {
  // This would need to be implemented with booking logic
  return this.available;
};

// Method to update rating
roomSchema.methods.updateRating = function(newRating) {
  const totalRating = (this.rating * this.reviewCount) + newRating;
  this.reviewCount += 1;
  this.rating = totalRating / this.reviewCount;
  return this.save();
};

module.exports = mongoose.model('Room', roomSchema); 