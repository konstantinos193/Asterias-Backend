const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  titleKey: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true
  },
  descriptionKey: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: null
  },
  discount: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  applicableRooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  }],
  minStay: {
    type: Number,
    default: 1,
    min: 1
  },
  maxStay: {
    type: Number,
    default: null
  },
  conditions: {
    type: String,
    default: ''
  },
  code: {
    type: String,
    unique: true,
    sparse: true
  },
  badgeKey: { type: String },
  roomTypeKey: { type: String },
  includesKeys: [{ type: String }],
  featured: { type: Boolean, default: false },
}, {
  timestamps: true
});

// Index for better query performance
offerSchema.index({ active: 1, startDate: 1, endDate: 1 });

// Virtual for checking if offer is currently valid
offerSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.active && 
         this.startDate <= now && 
         this.endDate >= now;
});

// Method to check if offer is valid for given dates
offerSchema.methods.isValidForDates = function(checkIn, checkOut) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  return this.active && 
         this.startDate <= checkInDate && 
         this.endDate >= checkOutDate;
};

// Method to calculate discounted price
offerSchema.methods.calculateDiscountedPrice = function(originalPrice) {
  return originalPrice * (1 - this.discount / 100);
};

// Static method to get active offers
offerSchema.statics.getActiveOffers = function() {
  const now = new Date();
  return this.find({
    active: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).populate('applicableRooms');
};

// Static method to find offer by code
offerSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase() });
};

module.exports = mongoose.model('Offer', offerSchema); 