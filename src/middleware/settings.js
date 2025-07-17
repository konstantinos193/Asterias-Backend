const Settings = require('../models/Settings');

// Cache settings to avoid database calls on every request
let settingsCache = null;
let lastCacheUpdate = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Load settings into cache
async function loadSettings() {
  try {
    const settings = await Settings.getInstance();
    settingsCache = settings.toObject();
    lastCacheUpdate = Date.now();
    return settingsCache;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

// Get settings from cache or database
async function getSettings() {
  if (!settingsCache || !lastCacheUpdate || Date.now() - lastCacheUpdate > CACHE_DURATION) {
    await loadSettings();
  }
  return settingsCache;
}

// Middleware to attach settings to request object
const attachSettings = async (req, res, next) => {
  try {
    req.settings = await getSettings();
    next();
  } catch (error) {
    console.error('Error attaching settings:', error);
    // Don't block request, just continue without settings
    req.settings = null;
    next();
  }
};

// Middleware to check if maintenance mode is enabled
const checkMaintenanceMode = async (req, res, next) => {
  try {
    const settings = await getSettings();
    
    // Allow admin routes during maintenance
    if (req.path.startsWith('/api/admin') || req.path.startsWith('/admin')) {
      return next();
    }
    
    // Allow auth routes during maintenance
    if (req.path.startsWith('/api/auth')) {
      return next();
    }
    
    if (settings && settings.maintenanceMode) {
      return res.status(503).json({
        success: false,
        error: 'System is currently under maintenance. Please try again later.',
        maintenanceMode: true
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    next(); // Don't block on error
  }
};

// Middleware to apply booking rules
const applyBookingRules = async (req, res, next) => {
  try {
    const settings = await getSettings();
    if (settings) {
      req.bookingRules = {
        checkInTime: settings.checkInTime,
        checkOutTime: settings.checkOutTime,
        minAdvanceBooking: settings.minAdvanceBooking,
        maxAdvanceBooking: settings.maxAdvanceBooking,
        cancellationPolicy: settings.cancellationPolicy,
        overbookingAllowed: settings.overbookingAllowed
      };
    }
    next();
  } catch (error) {
    console.error('Error applying booking rules:', error);
    next();
  }
};

// Middleware to apply pricing rules
const applyPricingRules = async (req, res, next) => {
  try {
    const settings = await getSettings();
    if (settings) {
      req.pricing = {
        currency: settings.currency,
        taxRate: settings.taxRate,
        automaticPricing: settings.automaticPricing,
        directBookingDiscount: settings.directBookingDiscount
      };
    }
    next();
  } catch (error) {
    console.error('Error applying pricing rules:', error);
    next();
  }
};

// Helper function to validate booking against rules
const validateBookingRules = async (checkIn, checkOut) => {
  const settings = await getSettings();
  if (!settings) return { valid: true };

  const errors = [];
  const now = new Date();
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  // Check minimum advance booking
  const daysUntilCheckIn = Math.ceil((checkInDate - now) / (1000 * 60 * 60 * 24));
  if (daysUntilCheckIn < settings.minAdvanceBooking) {
    errors.push(`Minimum advance booking is ${settings.minAdvanceBooking} days`);
  }

  // Check maximum advance booking
  if (daysUntilCheckIn > settings.maxAdvanceBooking) {
    errors.push(`Maximum advance booking is ${settings.maxAdvanceBooking} days`);
  }

  // Check if dates are in the past
  if (checkInDate < now) {
    errors.push('Check-in date cannot be in the past');
  }

  if (checkOutDate <= checkInDate) {
    errors.push('Check-out date must be after check-in date');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
};

// Helper function to calculate cancellation deadline
const getCancellationDeadline = async (checkInDate) => {
  const settings = await getSettings();
  if (!settings) return null;

  const checkIn = new Date(checkInDate);
  const deadline = new Date(checkIn.getTime() - (settings.cancellationPolicy * 60 * 60 * 1000));
  return deadline;
};

// Force cache refresh (useful after settings update)
const refreshSettingsCache = async () => {
  return await loadSettings();
};

module.exports = {
  attachSettings,
  checkMaintenanceMode,
  applyBookingRules,
  applyPricingRules,
  validateBookingRules,
  getCancellationDeadline,
  refreshSettingsCache,
  getSettings
}; 