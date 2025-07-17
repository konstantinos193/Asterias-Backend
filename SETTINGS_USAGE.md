# Settings System Usage Guide

The settings system allows you to configure your hotel booking system behavior from the admin panel and apply those settings across your application.

## API Endpoints

### Get All Settings
```
GET /api/admin/settings
Authorization: Admin required
```

### Update Settings
```
PUT /api/admin/settings
Authorization: Admin required
Content-Type: application/json

{
  "taxRate": 15,
  "checkInTime": "16:00",
  "maintenanceMode": false
}
```

### Get Specific Setting
```
GET /api/admin/settings/taxRate
Authorization: Admin required
```

### Update Specific Setting
```
PATCH /api/admin/settings/taxRate
Authorization: Admin required
Content-Type: application/json

{
  "value": 15
}
```

## Using Settings in Routes

### 1. Booking Validation Example

```javascript
// In your booking routes (src/routes/bookings.js)
const { validateBookingRules, applyBookingRules } = require('../middleware/settings');

// Apply booking rules middleware
router.post('/create', applyBookingRules, async (req, res) => {
  try {
    const { checkIn, checkOut, roomId } = req.body;
    
    // Validate against booking rules from settings
    const validation = await validateBookingRules(checkIn, checkOut);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Booking validation failed',
        details: validation.errors
      });
    }
    
    // Use check-in/out times from settings
    const checkInTime = req.bookingRules.checkInTime; // e.g., "15:00"
    const checkOutTime = req.bookingRules.checkOutTime; // e.g., "11:00"
    
    // Create booking with validated data...
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to create booking' });
  }
});
```

### 2. Pricing Calculation Example

```javascript
// In your booking/payment routes
const { applyPricingRules } = require('../middleware/settings');

router.post('/calculate-price', applyPricingRules, async (req, res) => {
  try {
    const { roomPrice, nights } = req.body;
    
    // Get pricing settings
    const { taxRate, directBookingDiscount } = req.pricing;
    
    let totalPrice = roomPrice * nights;
    
    // Apply direct booking discount if applicable
    if (directBookingDiscount > 0) {
      totalPrice = totalPrice * (1 - directBookingDiscount / 100);
    }
    
    // Add tax
    const tax = totalPrice * (taxRate / 100);
    const finalPrice = totalPrice + tax;
    
    res.json({
      success: true,
      breakdown: {
        basePrice: roomPrice * nights,
        discount: directBookingDiscount,
        discountedPrice: totalPrice,
        tax: tax,
        taxRate: taxRate,
        finalPrice: finalPrice,
        currency: req.pricing.currency
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate price' });
  }
});
```

### 3. Cancellation Policy Example

```javascript
// Check if cancellation is allowed
const { getCancellationDeadline } = require('../middleware/settings');

router.post('/cancel/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    
    // Get cancellation deadline based on settings
    const deadline = await getCancellationDeadline(booking.checkIn);
    const now = new Date();
    
    if (now > deadline) {
      return res.status(400).json({
        success: false,
        error: 'Cancellation deadline has passed',
        deadline: deadline
      });
    }
    
    // Process cancellation...
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});
```

### 4. Notification Settings Example

```javascript
// Send booking confirmation based on settings
const { getSettings } = require('../middleware/settings');

async function sendBookingConfirmation(booking) {
  const settings = await getSettings();
  
  if (settings.bookingConfirmations && settings.emailNotifications) {
    // Send email confirmation
    await sendEmail({
      to: booking.guestEmail,
      subject: 'Booking Confirmation',
      template: 'booking-confirmation',
      data: booking
    });
  }
  
  if (settings.newBookingAlerts && settings.emailNotifications) {
    // Notify admin of new booking
    await sendEmail({
      to: 'admin@asteriashome.gr',
      subject: 'New Booking Alert',
      template: 'admin-booking-alert', 
      data: booking
    });
  }
}
```

### 5. Maintenance Mode Check

The maintenance mode is automatically applied via middleware, but you can also check it manually:

```javascript
const { getSettings } = require('../middleware/settings');

router.get('/public-endpoint', async (req, res) => {
  const settings = await getSettings();
  
  if (settings.maintenanceMode) {
    return res.status(503).json({
      success: false,
      error: 'System is under maintenance',
      maintenanceMode: true
    });
  }
  
  // Normal operation...
});
```

## Available Settings

### Booking Rules
- `checkInTime` - Default check-in time (e.g., "15:00")
- `checkOutTime` - Default check-out time (e.g., "11:00") 
- `minAdvanceBooking` - Minimum days in advance (0-365)
- `maxAdvanceBooking` - Maximum days in advance (1-999)
- `cancellationPolicy` - Free cancellation hours before check-in (0-168)
- `overbookingAllowed` - Allow overbooking (boolean)

### Pricing & Payments
- `currency` - Currency code ("EUR", "USD", "GBP")
- `taxRate` - VAT/tax percentage (0-30)
- `automaticPricing` - Enable demand-based pricing (boolean)
- `directBookingDiscount` - Discount for direct bookings (0-25%)

### Notifications
- `emailNotifications` - Enable email notifications (boolean)
- `bookingConfirmations` - Send booking confirmations (boolean)
- `reminderNotifications` - Send arrival reminders (boolean)
- `reminderHours` - Hours before arrival to send reminder (1-168)
- `lowInventoryAlerts` - Alert when inventory is low (boolean)
- `newBookingAlerts` - Alert admin of new bookings (boolean)

### System
- `itemsPerPage` - Items per page in admin lists (10, 20, 50, 100)
- `maintenanceMode` - Enable maintenance mode (boolean)
- `sessionTimeout` - Admin session timeout in minutes (30-480)
- `autoBackup` - Enable automatic backups (boolean)
- `backupFrequency` - Backup frequency ("daily", "weekly", "monthly")

### Security
- `requireTwoFA` - Require 2FA for admins (boolean)
- `maxConcurrentSessions` - Max concurrent admin sessions (1-10)
- `passwordComplexity` - Enforce complex passwords (boolean)
- `auditLogging` - Log admin actions (boolean)

## Testing

Run the test script to verify everything works:

```bash
cd backend
node test-settings.js
```

## Performance Notes

- Settings are cached for 5 minutes to avoid database hits on every request
- Use `refreshSettingsCache()` after updating settings
- The cache is automatically refreshed when settings are updated via API
- Maintenance mode middleware runs on every request but uses cached settings

## Frontend Integration

The frontend automatically loads and saves settings through the admin panel at `/admin/settings`. The React component handles:

- Loading settings on mount
- Real-time validation
- Optimistic updates
- Error handling
- Loading states 