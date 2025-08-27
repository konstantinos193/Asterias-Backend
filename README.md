# Asterias Homes - Backend API

## Overview
This is the backend service for the Asterias Homes hotel management system. Built with Node.js, Express.js, and MongoDB, it provides a robust API for room bookings, guest management, admin operations, and payment processing.

## Technologies Used
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Payment**: Stripe API integration
- **Email**: Nodemailer with Gmail SMTP
- **Validation**: Express-validator
- **CORS**: Cross-origin resource sharing enabled

## Requirements
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **MongoDB**: Version 5.0+ (local or MongoDB Atlas)
- **Stripe Account**: For payment processing
- **Gmail Account**: For email notifications

## Installation

### 1. Clone and Navigate
```bash
git clone <repository-url>
cd Asterias-Homes/backend
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
PORT=3001
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/asterias-homes
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/asterias-homes

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Stripe Payment
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email Configuration (Gmail)
EMAIL_USER=your_gmail@gmail.com
EMAIL_APP_PASSWORD=your_gmail_app_password
# OR for regular password (less secure):
# EMAIL_PASSWORD=your_gmail_password

# Admin Configuration
ADMIN_EMAIL=admin@asteriashomes.com
ADMIN_PASSWORD=secure_admin_password

# API Keys
API_KEY=your_api_key_for_admin_access
```

### 4. Database Setup
The application will automatically create the necessary collections and indexes on first run.

## Running the Project

### Development Mode
```bash
npm run dev
```
This starts the server with nodemon for automatic restarts on file changes.

### Production Mode
```bash
npm start
```

### Build for Production
```bash
npm run build
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/profile` - Get admin profile

### Bookings
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/:id` - Get specific booking
- `POST /api/bookings` - Create new booking
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Delete booking

### Admin Operations
- `GET /api/admin/bookings` - Get all admin bookings
- `PUT /api/admin/bookings/:id/status` - Update booking status
- `PUT /api/admin/bookings/:id/cancel` - Cancel booking
- `DELETE /api/admin/bookings/bulk` - Bulk delete bookings
- `PUT /api/admin/bookings/bulk/status` - Bulk update status

### Rooms
- `GET /api/admin/rooms` - Get all rooms
- `POST /api/admin/rooms` - Create new room
- `PUT /api/admin/rooms/:id` - Update room
- `DELETE /api/admin/rooms/:id` - Delete room

### Analytics & Reports
- `GET /api/admin/analytics` - Get comprehensive analytics
- `GET /api/admin/revenue-reports` - Get revenue reports

### Payments
- `POST /api/payments/create-payment-intent` - Create Stripe payment intent
- `POST /api/payments/confirm-payment` - Confirm payment
- `POST /api/payments/create-cash-booking` - Create cash booking

## Database Models

### Booking Schema
- Guest information (name, email, phone)
- Room details and dates
- Payment status and amount
- Booking status (PENDING, CONFIRMED, CANCELLED, etc.)
- Admin notes and cancellation reasons

### Room Schema
- Room details (name, description, price)
- Capacity and amenities
- Availability status
- Images and features

### User Schema
- Admin user accounts
- Authentication details
- Role-based permissions

## Security Features

### Authentication
- JWT-based authentication for admin routes
- Secure password hashing with bcrypt
- Session management and timeout

### API Security
- Input validation and sanitization
- CORS configuration
- Rate limiting (can be configured)
- Request size limits

### Data Protection
- MongoDB injection protection
- XSS prevention
- CSRF protection

## Email System

### Configuration
The system uses Gmail SMTP for sending emails. You can configure:
- Customer booking confirmations
- Admin notifications
- Arrival reminders
- Cancellation confirmations

### Templates
Email templates support multiple languages (Greek, English, German) and are responsive for mobile devices.

## Payment Integration

### Stripe Setup
1. Create a Stripe account
2. Get your API keys from the dashboard
3. Configure webhook endpoints
4. Test with Stripe test cards

### Supported Payment Methods
- Credit/Debit cards
- Cash on arrival
- Bank transfers (can be configured)

## Development

### Project Structure
```
backend/
├── src/
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Authentication & validation
│   ├── models/         # Database schemas
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic
│   ├── utils/          # Helper functions
│   └── app.js          # Express app setup
├── .env                 # Environment variables
├── package.json         # Dependencies
└── README.md           # This file
```

### Adding New Features
1. Create the model in `src/models/`
2. Add routes in `src/routes/`
3. Implement controllers in `src/controllers/`
4. Add validation middleware if needed
5. Update this README

## Troubleshooting

### Common Issues

#### Database Connection Failed
- Check MongoDB URI in `.env`
- Ensure MongoDB service is running
- Verify network connectivity for Atlas

#### Email Not Sending
- Check Gmail credentials
- Verify 2FA is properly configured
- Check app password generation

#### Payment Issues
- Verify Stripe API keys
- Check webhook configuration
- Test with Stripe test cards

#### Authentication Errors
- Verify JWT_SECRET is set
- Check token expiration
- Ensure proper middleware order

### Debug Mode
Enable debug logging by setting:
```env
DEBUG=app:*
NODE_ENV=development
```

## Deployment

### Environment Variables
Ensure all required environment variables are set in your production environment.

### Database
- Use MongoDB Atlas for production
- Set up proper network access rules
- Configure backup schedules

### Security
- Use strong JWT secrets
- Enable HTTPS
- Configure CORS properly
- Set up rate limiting

## Monitoring

### Logs
The application logs important events to console. In production, consider:
- Winston for structured logging
- Log aggregation services
- Error tracking (Sentry, etc.)

### Health Checks
- `/api/health` - Basic health check endpoint
- Database connectivity monitoring
- External service status

## Contact

For technical support or questions about this backend:
- **Company**: Adinfinity
- **Email**: adenfinity@gmail.com

## Development Team

This backend is maintained by the Adinfinity development team.

---

**Note**: This backend is designed to work with the Asterias Homes frontend application. Ensure both services are properly configured and running for full functionality. 