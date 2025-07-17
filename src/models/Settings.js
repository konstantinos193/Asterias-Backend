const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Booking Rules
  checkInTime: {
    type: String,
    default: "15:00",
    required: true
  },
  checkOutTime: {
    type: String,
    default: "11:00", 
    required: true
  },
  minAdvanceBooking: {
    type: Number,
    default: 1,
    min: 0,
    max: 365
  },
  maxAdvanceBooking: {
    type: Number,
    default: 365,
    min: 1,
    max: 999
  },
  cancellationPolicy: {
    type: Number,
    default: 48,
    min: 0,
    max: 168 // 1 week in hours
  },
  overbookingAllowed: {
    type: Boolean,
    default: false
  },
  
  // Pricing & Payments
  currency: {
    type: String,
    default: "EUR",
    enum: ["EUR", "USD", "GBP"]
  },
  taxRate: {
    type: Number,
    default: 13,
    min: 0,
    max: 30
  },
  automaticPricing: {
    type: Boolean,
    default: false
  },
  directBookingDiscount: {
    type: Number,
    default: 5,
    min: 0,
    max: 25
  },
  
  // System Preferences
  itemsPerPage: {
    type: Number,
    default: 20,
    enum: [10, 20, 50, 100]
  },
  
  // Notifications
  emailNotifications: {
    type: Boolean,
    default: true
  },
  smsNotifications: {
    type: Boolean,
    default: false
  },
  bookingConfirmations: {
    type: Boolean,
    default: true
  },
  reminderNotifications: {
    type: Boolean,
    default: true
  },
  reminderHours: {
    type: Number,
    default: 24,
    min: 1,
    max: 168
  },
  lowInventoryAlerts: {
    type: Boolean,
    default: true
  },
  newBookingAlerts: {
    type: Boolean,
    default: true
  },
  
  // Security & Backup
  sessionTimeout: {
    type: Number,
    default: 120, // minutes
    min: 30,
    max: 480
  },
  requireTwoFA: {
    type: Boolean,
    default: false
  },
  autoBackup: {
    type: Boolean,
    default: true
  },
  backupFrequency: {
    type: String,
    default: "daily",
    enum: ["daily", "weekly", "monthly"]
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  
  // Channel Management
  bookingComIntegration: {
    type: Boolean,
    default: false
  },
  airbnbIntegration: {
    type: Boolean,
    default: false
  },
  expediaIntegration: {
    type: Boolean,
    default: false
  },
  
  // Staff Management
  maxConcurrentSessions: {
    type: Number,
    default: 3,
    min: 1,
    max: 10
  },
  passwordComplexity: {
    type: Boolean,
    default: true
  },
  auditLogging: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'settings'
});

// Singleton pattern - only one settings document should exist
settingsSchema.statics.getInstance = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Method to update specific setting
settingsSchema.statics.updateSetting = async function(key, value) {
  const settings = await this.getInstance();
  settings[key] = value;
  await settings.save();
  return settings;
};

// Method to get specific setting
settingsSchema.statics.getSetting = async function(key) {
  const settings = await this.getInstance();
  return settings[key];
};

module.exports = mongoose.model('Settings', settingsSchema); 