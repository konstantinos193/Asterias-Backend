# Asterias Homes - Backend API

![NestJS](https://img.shields.io/badge/NestJS-11.1.14-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose-9.2.1-880000?style=for-the-badge&logo=mongoose)
![JWT](https://img.shields.io/badge/JWT-9.0.3-000000?style=for-the-badge&logo=jsonwebtokens)
![Stripe](https://img.shields.io/badge/Stripe-20.3.1-635BFF?style=for-the-badge&logo=stripe&logoColor=white)

Backend API for Asterias Homes hotel booking system.

## Technologies

- **Runtime**: Node.js 18+
- **Framework**: NestJS
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **Payment**: Stripe API
- **Email**: Nodemailer with Gmail SMTP
- **Validation**: class-validator
- **Security**: Helmet, CORS, Throttling
- **File Upload**: Multer
- **Scheduling**: @nestjs/schedule
- **Image Storage**: Cloudinary
- **XML**: xml2js, xmlbuilder

## Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **MongoDB**: Version 5.0+
- **Stripe Account**: For payment processing
- **Gmail Account**: For email notifications

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

### 3. Environment Configuration
Create a `.env` file in the backend directory:

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
# Note: Regular password won't work, Gmail requires app passwords

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
The application will automatically create collections and indexes on first run.

## Running the Project

### Development Mode
```bash
npm run start:dev
```
This starts the server with automatic restarts for development.

### Production Mode
```bash
npm start
```
This runs the server in production mode.

### Seed Database (Optional)
```bash
npm run seed
```
Populates your database with sample data.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user account
- `POST /api/auth/login` - Admin/user login (returns JWT token)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
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

# Booking.com Integration
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
The system uses Gmail SMTP via Nodemailer.

### Features
- Customer booking confirmations (multilingual support)
- Admin notifications
- Arrival reminders (automated via scheduled tasks)
- Cancellation confirmations
- Contact form responses

### Templates
Email templates support multiple languages (Greek, English, German) and are responsive for mobile devices.

## Payment Integration

### Stripe Setup
1. Create a Stripe account
2. Get your API keys from the dashboard
3. Configure webhook endpoints
4. Test with Stripe test cards (4242 4242 4242 4242)

### Supported Payment Methods
- Credit/Debit cards via Stripe
- Cash on arrival
- Refunds

## Scheduled Tasks

The system runs automated tasks via node-cron:
- Email reminders for upcoming check-ins
- Maintenance tasks
- Data cleanup (if configured)

## Memory Monitoring

Optional memory monitoring to catch memory leaks:
- Configurable warning threshold
- Periodic memory checks
- Logs warnings when memory usage is high

## Project Structure

```
Asterias-Backend/
├── src/
│   ├── main.ts               # NestJS app setup and server initialization
│   ├── models/               # Database schemas (Mongoose models)
│   │   ├── booking.model.ts
│   │   ├── contact.model.ts
│   │   ├── offer.model.ts
│   │   ├── room.model.ts
│   │   ├── settings.model.ts
│   │   └── user.model.ts
│   ├── modules/              # NestJS modules
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── availability/
│   │   ├── bookings/
│   │   ├── contact/
│   │   ├── images/
│   │   ├── offers/
│   │   ├── payments/
│   │   └── rooms/
│   ├── services/             # Business logic and external integrations
│   │   ├── email.service.ts
│   │   └── scheduled-tasks.service.ts
│   ├── utils/                # Helper functions
│   │   └── memory-monitor.ts
│   └── translations/         # Translation files
│       └── email-translations.ts
├── uploads/                  # Uploaded images directory
├── .env                      # Environment variables
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## Adding New Features

1. Create the model in `src/models/` if you need a new data type
2. Add routes in appropriate module in `src/modules/`
3. Implement controllers/logic in module files
4. Add validation DTOs if accepting user input
5. Test your changes
6. Update documentation as needed

## Troubleshooting

### Database Connection Failed
- Check MongoDB URI in `.env`
- Ensure MongoDB service is running (if local)
- Verify network connectivity for Atlas
- Check database name

### Email Not Sending
- Check Gmail credentials in `.env`
- Verify 2FA is properly configured
- Generate app password (regular password won't work)
- Check spam folder

### Payment Issues
- Verify Stripe API keys (test vs live, they're different)
- Check webhook configuration and endpoint
- Test with Stripe test cards first
- Check Stripe dashboard for error logs

### Authentication Errors
- Verify JWT_SECRET is set
- Check token expiration time
- Ensure middleware order is correct
- Try logging out and back in

### Memory Issues
- Enable memory monitoring to see what's eating your RAM
- Check for memory leaks in long-running processes
- Restart server periodically if needed

## Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

The server logs important events to console. In production, use proper logging (Winston, etc.).

## Deployment

### Environment Variables
Set all required environment variables in your production environment. Missing variables = broken features.

### Database
- Use MongoDB Atlas for production
- Set up proper network access rules
- Configure backup schedules
- Monitor performance

### Security
- Use strong JWT secrets
- Enable HTTPS
- Configure CORS properly
- Set up rate limiting
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

## Health Checks

- `/health` - Basic health check (returns 200 if server is running)
- Database connectivity is checked on startup
- External service status monitoring (if configured)

## Known Issues

- Rate limiting configuration may need adjustment for production
- Booking.com webhook integration supports basic event types
- Some admin routes may require additional authentication
- Memory monitoring is optional and may not catch all issues

## Contributing

1. Don't break production
2. Test your changes
3. Update documentation
4. Follow existing code style

## License

MIT License

## Contact

For questions about this codebase:
- **Company**: Adinfinity
- **Email**: adenfinity@gmail.com

---

This backend works with the Asterias Homes frontend application. Make sure both services are running and properly configured.
