# Asterias Homes - Backend API

![Express.js](https://img.shields.io/badge/Express.js-5.2.1-000000?style=for-the-badge&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose-9.1.5-880000?style=for-the-badge&logo=mongoose)
![JWT](https://img.shields.io/badge/JWT-9.0.3-000000?style=for-the-badge&logo=jsonwebtokens)
![Stripe](https://img.shields.io/badge/Stripe-20.3.0-635BFF?style=for-the-badge&logo=stripe&logoColor=white)

## Overview

Welcome to the digital graveyard where hotel bookings go to die (and occasionally get resurrected). This is the backend service for Asterias Homes - a hotel management system built with Node.js, Express.js, and MongoDB. It handles room bookings, guest management, admin operations, payment processing, and apparently your sanity if you stare at it long enough.

Built with love, caffeine, and questionable architectural decisions that somehow work in production.

## Technologies Used

- **Runtime**: Node.js 18+ (because Node 16 is dead and buried)
- **Framework**: Express.js 5.2.1 (we like living on the edge)
- **Database**: MongoDB with Mongoose 9.1.5 ODM
- **Authentication**: JWT 9.0.3 (JSON Web Tokens - because passwords are for peasants)
- **Payment**: Stripe 20.3.0 API integration
- **Email**: Nodemailer 7.0.13 with Gmail SMTP (because every hotel needs spam)
- **Validation**: Express-validator 7.3.1 (trust no one, validate everything)
- **Security**: Helmet 8.1.0, CORS 2.8.6, Express-rate-limit 8.2.1
- **File Upload**: Multer 2.0.2 (for those room pictures that never load correctly)
- **Scheduling**: Node-cron 4.2.1 (automated tasks that run when you're not looking)
- **Image Storage**: Cloudinary 2.9.0 (because hosting images yourself is 2010)
- **XML**: xml2js 0.6.2, xmlbuilder 15.1.1 (for when JSON isn't painful enough)

## Requirements

- **Node.js**: Version 18.0.0 or higher (lower versions will mock you)
- **npm**: Version 8.0.0 or higher (or yarn if you're fancy)
- **MongoDB**: Version 5.0+ (local or MongoDB Atlas - your choice, your suffering)
- **Stripe Account**: For payment processing (because free money isn't a thing)
- **Gmail Account**: For email notifications (yes, we still use email in 2024)

## Installation

### 1. Clone and Navigate
```bash
git clone <repository-url>
cd Asterias-Backend
```

### 2. Install Dependencies
```bash
npm install
```
This will download approximately 500MB of `node_modules` because JavaScript. Go grab coffee.

### 3. Environment Configuration
Create a `.env` file in the backend directory (or watch everything break):

```env
# Server Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/asterias-homes
# OR for MongoDB Atlas (recommended if you like your data in the cloud):
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/asterias-homes

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d

# Stripe Payment
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email Configuration (Gmail)
EMAIL_USER=your_gmail@gmail.com
EMAIL_APP_PASSWORD=your_gmail_app_password
# Note: Regular password won't work, Gmail requires app passwords (because security)

# Booking.com Integration (if you're feeling adventurous)
BOOKINGCOM_WEBHOOK_SECRET=your_bookingcom_webhook_secret

# Admin Configuration
ADMIN_EMAIL=admin@asteriashomes.com
ADMIN_PASSWORD=secure_admin_password_change_this_immediately

# API Keys
API_KEY=your_api_key_for_admin_access

# Optional: Memory Monitoring
NODE_ENABLE_MEMORY_MONITOR=true
MEMORY_WARNING_THRESHOLD=500
MEMORY_CHECK_INTERVAL=60000
```

### 4. Database Setup
The application will automatically create collections and indexes on first run. If something goes wrong, MongoDB will tell you in its own special way.

## Running the Project

### Development Mode
```bash
npm run dev
```
This starts the server with nodemon for automatic restarts. It watches files, restarts the server when you save, and occasionally crashes for no apparent reason. Perfect for development.

### Production Mode
```bash
npm start
```
This runs the server without watching. Because production doesn't need your constant file changes.

### Seed Database (Optional)
```bash
npm run seed
```
Populates your database with sample data so you don't have to manually create everything. Use at your own risk.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user account
- `POST /api/auth/login` - Admin/user login (returns JWT token)
- `POST /api/auth/logout` - Logout (because apparently we need an endpoint for that)
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password (because forgetting passwords is human)
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/create-admin` - Create admin user (use with caution)
- `POST /api/auth/reset-admin-password` - Reset admin password (when everything goes wrong)

### Rooms
- `GET /api/rooms` - Get all rooms (public, supports optional auth)
- `GET /api/rooms/:id` - Get specific room details
- `GET /api/rooms/:id/availability` - Check room availability for dates
- `POST /api/rooms` - Create new room (admin only)
- `PUT /api/rooms/:id` - Update room (admin only)
- `DELETE /api/rooms/:id` - Delete room (admin only, use API key or admin token)
- `POST /api/rooms/:id/images` - Add images to room
- `GET /api/rooms/stats/overview` - Get room statistics

### Bookings
- `POST /api/bookings` - Create new booking
- `GET /api/bookings` - Get all bookings (with filters and pagination)
- `GET /api/bookings/:bookingId` - Get specific booking (API key required)
- `GET /api/bookings/my-bookings` - Get current user's bookings
- `PATCH /api/bookings/:id/status` - Update booking status
- `POST /api/bookings/:id/cancel` - Cancel booking
- `GET /api/bookings/availability` - Check booking availability
- `GET /api/bookings/calendar-availability` - Get calendar availability data
- `POST /api/bookings/:bookingId/send-email` - Send booking email manually
- `GET /api/bookings/stats/overview` - Get booking statistics

### Offers
- `GET /api/offers` - Get all active offers (public)
- `GET /api/offers/:id` - Get specific offer
- `POST /api/offers` - Create new offer (admin only)
- `PUT /api/offers/:id` - Update offer (admin only)
- `DELETE /api/offers/:id` - Delete offer (admin only)
- `GET /api/offers/admin/all` - Get all offers including inactive (admin only)
- `PATCH /api/offers/:id/toggle` - Toggle offer active status (admin only)
- `POST /api/offers/applicable` - Check applicable offers for booking
- `POST /api/offers/validate-code` - Validate offer/promotion code

### Contact
- `POST /api/contact` - Submit contact form (public)
- `GET /api/contact` - Get all contacts (admin only, with filters)
- `GET /api/contact/:id` - Get specific contact (admin only)
- `PATCH /api/contact/:id/status` - Update contact status (admin only)
- `POST /api/contact/:id/reply` - Reply to contact (admin only)
- `PATCH /api/contact/:id/read` - Mark contact as read (admin only)
- `PATCH /api/contact/:id/close` - Close contact (admin only)
- `GET /api/contact/stats/overview` - Get contact statistics
- `DELETE /api/contact/:id` - Delete contact (admin only)

### Admin Operations
- `GET /api/admin/analytics` - Get comprehensive analytics/reports
- `GET /api/admin/revenue-reports` - Get revenue reports
- `GET /api/admin/dashboard` - Get dashboard data
- `GET /api/admin/bookings` - Get all bookings with advanced filters
- `PUT /api/admin/bookings/:bookingId/status` - Update booking status
- `PUT /api/admin/bookings/:bookingId/cancel` - Cancel booking
- `DELETE /api/admin/bookings/bulk` - Bulk delete bookings
- `PUT /api/admin/bookings/bulk/status` - Bulk update booking status
- `GET /api/admin/room-availability` - Get room availability overview
- `GET /api/admin/rooms` - Get all rooms (admin view)
- `GET /api/admin/rooms/:id` - Get room details
- `POST /api/admin/rooms` - Create room
- `PUT /api/admin/rooms/:id` - Update room
- `DELETE /api/admin/rooms/:id` - Delete room
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users/admin` - Create admin user
- `GET /api/admin/stats` - Get admin statistics
- `GET /api/admin/settings` - Get all settings
- `PUT /api/admin/settings` - Update settings
- `GET /api/admin/settings/:key` - Get specific setting
- `PATCH /api/admin/settings/:key` - Update specific setting
- `GET /api/admin/guests/:email` - Get guest information by email
- `PUT /api/admin/guests/:email` - Update guest information
- `DELETE /api/admin/guests/:email` - Delete guest information

### Payments
- `POST /api/payments/create-payment-intent` - Create Stripe payment intent
- `POST /api/payments/confirm-payment` - Confirm payment and create booking
- `POST /api/payments/create-cash-booking` - Create cash on arrival booking
- `GET /api/payments/status/:paymentIntentId` - Get payment status
- `POST /api/payments/refund/:bookingId` - Refund booking payment
- `POST /api/payments/webhook` - Stripe webhook endpoint

### Availability
- `GET /api/availability/room/:roomId` - Get availability for specific room and date
- `GET /api/availability/date/:date` - Get availability for all rooms on specific date
- `GET /api/availability/monthly/:roomId` - Get monthly availability for room
- `GET /api/availability/calendar` - Get calendar availability data (aggregated)
- `GET /api/availability/overview` - Get availability overview for dashboard

### Images
- `POST /api/images/upload` - Upload images (admin only, supports multiple files)
- `GET /api/images/:filename` - Get image file
- `DELETE /api/images/:filename` - Delete image (admin only)
- `GET /api/images` - List all uploaded images (admin only)

### Booking.com Integration
- `POST /api/bookingcom-webhooks/notification` - Webhook endpoint for Booking.com notifications

### Utility
- `GET /health` - Health check endpoint (returns 200 OK if server is running)
- `GET /` - Root endpoint with API information

## Database Models

### Booking Schema
- Guest information (name, email, phone, address)
- Room details and dates (check-in, check-out)
- Payment status and amount
- Booking status (PENDING, CONFIRMED, CANCELLED, CHECKED_IN, CHECKED_OUT)
- Admin notes and cancellation reasons
- Booking.com integration fields
- Special requests and preferences

### Room Schema
- Room details (name, description, price, type)
- Capacity (adults, children)
- Amenities and features
- Availability status
- Images (Cloudinary URLs)
- Booking.com room ID mapping

### User Schema
- User account information
- Authentication details (hashed passwords)
- Role-based permissions (admin/user)
- Profile information

### Contact Schema
- Contact form submissions
- Status tracking (UNREAD, READ, REPLIED, CLOSED)
- Priority levels (LOW, MEDIUM, HIGH, URGENT)
- Assignment and response tracking

### Offer Schema
- Offer details (name, description, discount)
- Validity dates
- Applicable room types
- Promotion codes
- Active/inactive status

### Settings Schema
- Application-wide settings
- Maintenance mode toggle
- Feature flags
- Configuration values

## Security Features

### Authentication
- JWT-based authentication for protected routes
- Secure password hashing with bcryptjs 3.0.3
- Token refresh mechanism
- Session management

### API Security
- Helmet.js for HTTP header security
- CORS configuration (currently allows localhost:3000 and asteriashome.gr)
- Rate limiting (currently disabled in dev, but ready for production)
- Request size limits (10MB for JSON)
- Input validation and sanitization with express-validator
- API key authentication option for admin routes

### Data Protection
- MongoDB injection protection (thanks to Mongoose)
- XSS prevention
- CSRF protection ready (configure as needed)
- Secure cookie handling

## Email System

### Configuration
The system uses Gmail SMTP via Nodemailer. Because everyone has Gmail, right?

### Features
- Customer booking confirmations (multilingual support)
- Admin notifications
- Arrival reminders (automated via scheduled tasks)
- Cancellation confirmations
- Contact form responses

### Templates
Email templates support multiple languages (Greek, English, German) and are responsive for mobile devices. Because people still read emails on phones.

## Payment Integration

### Stripe Setup
1. Create a Stripe account (they'll take a cut, but that's capitalism)
2. Get your API keys from the dashboard
3. Configure webhook endpoints
4. Test with Stripe test cards (4242 4242 4242 4242)

### Supported Payment Methods
- Credit/Debit cards via Stripe
- Cash on arrival (for those who prefer cash)
- Refunds (because sometimes bookings go wrong)

## Scheduled Tasks

The system runs automated tasks via node-cron:
- Email reminders for upcoming check-ins
- Maintenance tasks
- Data cleanup (if configured)

These run in the background, doing their thing while you sleep. Or while you're debugging why they're not working.

## Memory Monitoring

Optional memory monitoring to catch memory leaks before they catch you:
- Configurable warning threshold
- Periodic memory checks
- Logs warnings when memory usage is high

Because nothing says "production ready" like monitoring your server's existential crisis.

## Project Structure

```
Asterias-Backend/
├── src/
│   ├── index.js              # Express app setup and server initialization
│   ├── models/               # Database schemas (Mongoose models)
│   │   ├── Booking.js
│   │   ├── Contact.js
│   │   ├── Offer.js
│   │   ├── Room.js
│   │   ├── Settings.js
│   │   └── User.js
│   ├── routes/               # API route definitions
│   │   ├── admin.js
│   │   ├── auth.js
│   │   ├── availability.js
│   │   ├── bookingcom.webhook.js
│   │   ├── bookings.js
│   │   ├── contact.js
│   │   ├── images.js
│   │   ├── offers.js
│   │   ├── payments.js
│   │   └── rooms.js
│   ├── middleware/           # Custom middleware
│   │   ├── apiKey.js         # API key authentication
│   │   ├── auth.js           # JWT authentication
│   │   └── settings.js       # Settings and maintenance mode
│   ├── services/             # Business logic and external integrations
│   │   ├── bookingcom.service.js
│   │   ├── emailService.js
│   │   ├── emailTemplates.js
│   │   ├── job-manager.js
│   │   └── scheduledTasks.js
│   ├── utils/                # Helper functions
│   │   ├── availabilityCalculator.js
│   │   ├── memory-monitor.js
│   │   └── roomDataNormalizer.js
│   ├── translations/         # Translation files
│   │   └── emailTranslations.js
│   └── seed.js               # Database seeding script
├── uploads/                  # Uploaded images directory
├── .env                      # Environment variables (not in git, obviously)
├── package.json              # Dependencies and scripts
└── README.md                 # This file (you're reading it, congrats)
```

## Adding New Features

Because you'll probably want to add features (or fix bugs):

1. Create the model in `src/models/` if you need a new data type
2. Add routes in `src/routes/` (follow existing patterns, please)
3. Implement controllers/logic in route files or create services
4. Add validation middleware if accepting user input
5. Test it (ha, good one)
6. Update this README (or don't, nobody reads these anyway)

## Troubleshooting

### Database Connection Failed
- Check MongoDB URI in `.env`
- Ensure MongoDB service is running (if local)
- Verify network connectivity for Atlas
- Check if you're actually using the right database name

### Email Not Sending
- Check Gmail credentials in `.env`
- Verify 2FA is properly configured
- Generate app password (regular password won't work)
- Check spam folder (it's always the spam folder)

### Payment Issues
- Verify Stripe API keys (test vs live, they're different)
- Check webhook configuration and endpoint
- Test with Stripe test cards first
- Check Stripe dashboard for error logs

### Authentication Errors
- Verify JWT_SECRET is set (and actually secret)
- Check token expiration time
- Ensure middleware order is correct
- Try logging out and back in (the IT support classic)

### Memory Issues
- Enable memory monitoring to see what's eating your RAM
- Check for memory leaks in long-running processes
- Restart server periodically (the nuclear option)

## Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

The server already logs important events to console. In production, you'll want proper logging (Winston, etc.), but for now console.log is your friend.

## Deployment

### Environment Variables
Set all required environment variables in your production environment. Missing variables = broken features.

### Database
- Use MongoDB Atlas for production (or manage your own, if you hate yourself)
- Set up proper network access rules
- Configure backup schedules
- Monitor performance

### Security
- Use strong JWT secrets (long, random, complex)
- Enable HTTPS (seriously, do this)
- Configure CORS properly (don't allow all origins)
- Set up rate limiting (enable that limiter we commented out)
- Rotate API keys regularly

### Performance
- Use PM2 or similar process manager
- Set up proper logging
- Monitor memory usage
- Configure reverse proxy (nginx, etc.)
- Enable compression

## Testing

Run tests with:
```bash
npm test
```

If tests exist. They might not. This is fine.

## Health Checks

- `/health` - Basic health check (returns 200 if server is running)
- Database connectivity is checked on startup
- External service status monitoring (if configured)

## Known Issues

- Rate limiting is currently disabled in development
- Booking.com webhook integration is basic (needs more event types)
- Some admin routes don't require authentication (by design or oversight, you decide)
- Memory monitoring is optional and might not catch everything

## Contributing

If you want to contribute:
1. Don't break production
2. Test your changes
3. Update documentation
4. Follow existing code style (or don't, consistency is overrated)

## License

MIT License - because who wants license drama?

## Contact

For questions, complaints, or existential crises about this codebase:
- **Company**: Adinfinity
- **Email**: adenfinity@gmail.com

---

**Final Note**: This backend works with the Asterias Homes frontend application. Make sure both services are running and properly configured, or you'll have a bad time. The codebase has evolved over time, so some parts are cleaner than others. Such is life.

**Good luck, and may your bookings never conflict.**
