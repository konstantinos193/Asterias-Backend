# Asterias Homes Backend API

A robust Node.js/Express backend server for the Asterias Homes apartment rental system. Features multilingual email automation, Stripe payment processing, MongoDB integration, and comprehensive admin functionality.

## 🏗️ Architecture Overview

### Core Technologies
- **Node.js**: Runtime environment
- **Express.js**: Web application framework
- **MongoDB**: Document database with Mongoose ODM
- **JWT**: Authentication and authorization
- **Stripe**: Payment processing
- **Nodemailer**: Email delivery system
- **node-cron**: Scheduled task automation

### Key Features
- **RESTful API**: Clean, documented endpoints
- **Multilingual Email System**: Automated emails in Greek, English, German
- **Payment Processing**: Secure Stripe integration
- **Admin Dashboard**: Comprehensive management interface
- **Real-time Analytics**: Booking and revenue reporting
- **Automated Tasks**: Email reminders and inventory alerts

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.js                    # Main server entry point
│   ├── models/                     # Mongoose database models
│   │   ├── Booking.js             # Booking schema with language support
│   │   ├── Room.js                # Room/apartment definitions
│   │   ├── User.js                # Admin user management
│   │   ├── Offer.js               # Special offers and discounts
│   │   ├── Contact.js             # Contact form submissions
│   │   └── Settings.js            # System configuration
│   ├── routes/                     # API route handlers
│   │   ├── admin.js               # Admin dashboard endpoints
│   │   ├── auth.js                # Authentication routes
│   │   ├── bookings.js            # Booking management
│   │   ├── rooms.js               # Room/apartment API
│   │   ├── offers.js              # Special offers
│   │   ├── payments.js            # Stripe payment processing
│   │   ├── contact.js             # Contact form handling
│   │   ├── images.js              # Image serving
│   │   └── bookingcom.webhook.js  # Third-party integrations
│   ├── services/                   # Business logic services
│   │   ├── emailService.js        # Multilingual email system
│   │   ├── scheduledTasks.js      # Automated background tasks
│   │   └── bookingcom.service.js  # Booking.com integration
│   ├── middleware/                 # Express middleware
│   │   ├── auth.js                # JWT authentication
│   │   ├── apiKey.js              # API key validation
│   │   └── settings.js            # Settings management
│   └── translations/               # Email translations
│       └── emailTranslations.js   # Multi-language templates
├── test-backend.js                 # Backend connectivity tests
├── test-mongodb.js                 # Database connection tests
├── create-admin.js                 # Admin user creation script
├── check-bookings.js               # Booking validation script
├── package.json                    # Dependencies and scripts
├── env.example                     # Environment template
└── README.md                       # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- MongoDB Atlas account
- Stripe account
- Gmail account for email sending

### Installation

1. **Install dependencies**
   ```bash
   cd backend
   pnpm install
   ```

2. **Environment setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Create admin user**
   ```bash
   node create-admin.js
   ```

4. **Start the server**
   ```bash
   # Development
   pnpm dev
   
   # Production
   pnpm start
   ```

## ⚙️ Environment Variables

### Required Configuration (.env)

```env
# Server Configuration
NODE_ENV=development
PORT=3001

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/asterias-homes

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key

# Payment Processing
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)

# Email System - Choose ONE option:

# OPTION 1: App Password (RECOMMENDED - more secure)
EMAIL_USER=asterias.apartmentskoronisia@gmail.com
EMAIL_APP_PASSWORD=your-16-digit-app-password

# OPTION 2: Regular Password (requires "Less secure app access")
EMAIL_USER=asterias.apartmentskoronisia@gmail.com
EMAIL_PASSWORD=your-gmail-password

# Admin email (OPTIONAL - fallback only)
# System sends to ALL admin users in database first
# This is only used if database fails or no admin users exist
ADMIN_EMAIL=asterias.apartmentskoronisia@gmail.com

# Application URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

# Optional: Third-party Integrations
BOOKINGCOM_API_URL=https://api.booking.com/v1
BOOKINGCOM_API_USER=your-booking-api-user
BOOKINGCOM_API_PASSWORD=your-booking-api-password
```

### Email Setup (Gmail)

1. **Create dedicated business Gmail account**
2. **Enable 2-Factor Authentication**
3. **Generate App Password**:
   - Google Account → Security → 2-Step Verification → App passwords
   - Select "Mail" and generate password
4. **Update environment variables**

## 📧 Multilingual Email System

### Features
- **3 Languages**: Greek (el), English (en), German (de)
- **Smart Detection**: Language from booking data, URL path, Accept-Language header
- **Professional Templates**: Responsive HTML emails with branding
- **Automated Sending**: Booking confirmations, arrival reminders, admin alerts

### Email Types

#### Customer Emails (in customer's language)
- **Booking Confirmation**: Sent immediately after successful booking
- **Arrival Reminder**: Sent 24 hours before check-in (configurable)

#### Admin Emails (always in Greek)
- **New Booking Alert**: Sent to ALL registered admin users with customer language noted
- **Low Inventory Alert**: Sent to ALL registered admin users when availability drops below threshold
- **Multi-Admin Support**: Automatically sends to all users with role 'ADMIN' and email notifications enabled

### Testing Email System

```bash
# Test email sending
node -e "
const { sendTestEmail } = require('./src/services/emailService');
sendTestEmail('bookingConfirmation', 'en').then(console.log);
"

# Test specific templates
node -e "
const { sendTestEmail } = require('./src/services/emailService');
sendTestEmail('arrivalReminder', 'de').then(console.log);
sendTestEmail('newBookingAlert', 'el').then(console.log);
"

# Test multi-admin email system
node test-admin-emails.js
```

## 🔄 Scheduled Tasks

Automated background processes:

### Arrival Reminders
- **Frequency**: Every hour
- **Function**: Check for bookings with check-in tomorrow
- **Action**: Send reminder emails in customer's language

### Inventory Monitoring  
- **Frequency**: Twice daily (9 AM, 6 PM)
- **Function**: Check low room availability
- **Action**: Alert admin when availability drops

### Cleanup Tasks
- **Frequency**: Daily at 2 AM
- **Function**: Clean old notification flags
- **Action**: Maintain database hygiene

## 📊 API Endpoints

### Authentication
```
POST   /api/auth/login         # Admin login
POST   /api/auth/logout        # Logout
GET    /api/auth/profile       # Get user profile
GET    /api/auth/session       # Check session status
```

### Bookings
```
GET    /api/bookings           # List all bookings
POST   /api/bookings           # Create new booking
GET    /api/bookings/:id       # Get booking details
PUT    /api/bookings/:id       # Update booking
DELETE /api/bookings/:id       # Cancel booking
```

### Rooms/Apartments
```
GET    /api/rooms              # List all rooms
POST   /api/rooms              # Create room (admin)
GET    /api/rooms/:id          # Get room details
PUT    /api/rooms/:id          # Update room (admin)
DELETE /api/rooms/:id          # Delete room (admin)
```

### Payments
```
POST   /api/payments/create-payment-intent    # Create Stripe payment
POST   /api/payments/confirm-payment          # Confirm payment and create booking
```

### Admin Dashboard
```
GET    /api/admin/dashboard    # Dashboard statistics
GET    /api/admin/analytics    # Detailed analytics
GET    /api/admin/revenue-reports  # Revenue reporting
GET    /api/admin/settings     # Get system settings
PUT    /api/admin/settings     # Update system settings
```

### Special Offers
```
GET    /api/offers             # List active offers
POST   /api/offers             # Create offer (admin)
GET    /api/offers/:id         # Get offer details
PUT    /api/offers/:id         # Update offer (admin)
DELETE /api/offers/:id         # Delete offer (admin)
```

### Contact
```
GET    /api/contact            # List contact messages (admin)
POST   /api/contact            # Submit contact form
```

## 👥 Admin User Management

### Adding Admin Users

To add additional admin users who will receive booking notifications:

```bash
# Using MongoDB shell or your admin interface
db.users.insertOne({
  name: "Admin Name",
  email: "admin@example.com", 
  password: "hashed_password", // Use bcrypt to hash
  role: "ADMIN",
  preferences: {
    notifications: {
      email: true,
      sms: false
    }
  }
});
```

### Admin Email Notifications

All users with:
- `role: "ADMIN"` 
- `preferences.notifications.email: true`

Will automatically receive:
- New booking alerts
- Low inventory warnings
- System notifications

## 🗄️ Database Models

### Booking Model
```javascript
{
  bookingNumber: String,          // Auto-generated (AST-2024-001)
  roomId: ObjectId,               // Reference to Room
  userId: ObjectId,               // Optional user reference
  guestInfo: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    specialRequests: String,
    language: String              // Customer's language (el/en/de)
  },
  checkIn: Date,
  checkOut: Date,
  adults: Number,
  children: Number,
  totalAmount: Number,
  paymentMethod: String,          // CARD or CASH
  paymentStatus: String,          // PENDING, PAID, FAILED, REFUNDED
  bookingStatus: String,          // CONFIRMED, PENDING, CANCELLED, etc.
  stripePaymentIntentId: String,  // Stripe reference
  notes: String,
  reminderSent: Boolean,          // Arrival reminder flag
  createdAt: Date,
  updatedAt: Date
}
```

### Settings Model
```javascript
{
  // Booking Rules
  checkInTime: String,            // Default: "15:00"
  checkOutTime: String,           // Default: "11:00"
  minAdvanceBooking: Number,      // Days: 1-365
  maxAdvanceBooking: Number,      // Days: 1-365
  cancellationPolicy: Number,     // Hours before free cancellation
  overbookingAllowed: Boolean,    // Allow overBooking

  // Pricing & Payments
  currency: String,               // EUR (fixed for Greece)
  taxRate: Number,                // Default: 13% (Greek VAT)
  automaticPricing: Boolean,      // Dynamic pricing toggle
  directBookingDiscount: Number,  // Percentage discount

  // Notifications
  emailNotifications: Boolean,
  bookingConfirmations: Boolean,
  reminderNotifications: Boolean,
  reminderHours: Number,          // Hours before check-in
  lowInventoryAlerts: Boolean,
  newBookingAlerts: Boolean,

  // System Preferences
  itemsPerPage: Number,           // Admin pagination
  maintenanceMode: Boolean,       // Disable new bookings

  // Security
  sessionTimeout: Number,         // Minutes
  requireTwoFA: Boolean,
  auditLogging: Boolean,
  maxConcurrentSessions: Number
}
```

## 🔒 Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure session management
- **Role-based Access**: Admin/user permissions
- **Session Management**: Configurable timeouts
- **API Key Protection**: Optional API key middleware

### Input Validation
- **express-validator**: All input sanitization
- **Mongoose Validation**: Database-level constraints
- **Type Checking**: Parameter validation
- **SQL Injection Prevention**: NoSQL injection protection

### Payment Security
- **Stripe Integration**: PCI-compliant processing
- **Payment Intent Flow**: Secure 3D authentication
- **Server-side Validation**: Amount verification
- **Idempotency**: Duplicate payment prevention

## 📈 Analytics & Reporting

### Dashboard Metrics
- **Live Statistics**: Real-time booking counts, revenue
- **Occupancy Rates**: Current and historical
- **Revenue Tracking**: Daily, weekly, monthly totals
- **Guest Analytics**: Demographics and patterns

### Revenue Reports
- **Period Analysis**: Custom date range reporting
- **Room Performance**: Individual room statistics
- **Payment Analysis**: Payment method breakdown
- **Trend Analysis**: Growth and seasonal patterns

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**
   ```bash
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://... (Atlas production cluster)
   JWT_SECRET=... (strong production secret)
   STRIPE_SECRET_KEY=sk_live_... (live keys)
   EMAIL_USER=... (business email)
   ```

2. **Database Setup**
   - MongoDB Atlas production cluster
   - Database user with appropriate permissions
   - Network access configuration
   - Backup strategy

3. **Email Configuration**
   - Business Gmail account
   - App password generated
   - Email templates tested

4. **Security**
   - CORS configuration for production domains
   - Rate limiting enabled
   - Input validation active
   - SSL/TLS encryption

### Deployment Platforms

#### Render (Recommended)
```bash
# Build command
npm install

# Start command  
npm start

# Environment variables set in dashboard
```

#### Railway
```bash
# Automatic deployment from GitHub
# Environment variables in project settings
```

#### Heroku
```bash
# Procfile
web: node src/index.js

# Config vars set in dashboard
```

## 🧪 Testing

### Connectivity Tests
```bash
# Test backend server
node test-backend.js

# Test MongoDB connection
node test-mongodb.js

# Test email system
node -e "require('./src/services/emailService').sendTestEmail('bookingConfirmation', 'en')"
```

### API Testing
```bash
# Install HTTPie or use curl
http GET localhost:3001/api/rooms
http POST localhost:3001/api/auth/login email=admin@asterias.gr password=admin123
```

### Load Testing
```bash
# Use artillery or similar
npm install -g artillery
artillery quick --count 10 --num 5 http://localhost:3001/api/rooms
```

## 📝 Scripts

```bash
# Development
pnpm dev              # Start with nodemon

# Production
pnpm start            # Start server

# Database
node create-admin.js  # Create admin user
node check-bookings.js # Validate bookings

# Testing
node test-backend.js  # Test server
node test-mongodb.js  # Test database
node test-admin-emails.js # Test multi-admin email system
```

## 🔧 Troubleshooting

### Common Issues

#### Database Connection
```bash
# Check MongoDB URI format
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Test connection
node test-mongodb.js
```

#### Email Not Sending
```bash
# Verify Gmail settings
# Check app password (not regular password)
# Ensure 2FA is enabled
# Test with simple script
```

#### Payment Issues
```bash
# Verify Stripe keys
# Check webhook endpoints
# Test with Stripe CLI
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

## 📞 Support

### Contact Information
- **Email**: asterias.apartmentskoronisia@gmail.com
- **Location**: Koronisia, Arta 48100, Greece
- **Technical Support**: GitHub Issues

### Documentation
- [Stripe API Documentation](https://stripe.com/docs/api)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Express.js Documentation](https://expressjs.com/)
- [Nodemailer Documentation](https://nodemailer.com/)

---

**Asterias Homes Backend** - Powering traditional Greek hospitality with modern technology. 