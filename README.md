# Asterias Homes Backend API

A comprehensive Express.js backend for the Asterias Homes hotel booking system, built with MongoDB and featuring Stripe payment integration.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Room Management**: CRUD operations for rooms with availability checking
- **Booking System**: Complete booking workflow with payment integration
- **Payment Processing**: Stripe integration for secure payments
- **Admin Dashboard**: Comprehensive admin panel with statistics and management tools
- **Contact Management**: Contact form handling and admin response system
- **Offer Management**: Special offers and discounts system
- **User Management**: User registration, profiles, and admin user management

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Payment**: Stripe
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting
- **File Upload**: Multer (for future image uploads)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

### Rooms
- `GET /api/rooms` - Get all rooms (public)
- `GET /api/rooms/:id` - Get single room (public)
- `GET /api/rooms/:id/availability` - Check room availability
- `POST /api/rooms` - Create room (admin)
- `PUT /api/rooms/:id` - Update room (admin)
- `DELETE /api/rooms/:id` - Delete room (admin)
- `POST /api/rooms/:id/images` - Upload room images (admin)
- `GET /api/rooms/stats/overview` - Room statistics (admin)

### Bookings
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/my-bookings` - Get user's bookings
- `GET /api/bookings/:id` - Get single booking
- `PATCH /api/bookings/:id/status` - Update booking status (admin)
- `GET /api/bookings` - Get all bookings (admin)
- `POST /api/bookings/:id/cancel` - Cancel booking
- `GET /api/bookings/stats/overview` - Booking statistics (admin)

### Offers
- `GET /api/offers` - Get active offers (public)
- `GET /api/offers/:id` - Get single offer (public)
- `POST /api/offers` - Create offer (admin)
- `PUT /api/offers/:id` - Update offer (admin)
- `DELETE /api/offers/:id` - Delete offer (admin)
- `GET /api/offers/admin/all` - Get all offers (admin)
- `PATCH /api/offers/:id/toggle` - Toggle offer status (admin)
- `POST /api/offers/validate-code` - Validate offer code

### Contact
- `POST /api/contact` - Submit contact form (public)
- `GET /api/contact` - Get all contacts (admin)
- `GET /api/contact/:id` - Get single contact (admin)
- `PATCH /api/contact/:id/status` - Update contact status (admin)
- `POST /api/contact/:id/reply` - Reply to contact (admin)
- `PATCH /api/contact/:id/read` - Mark as read (admin)
- `PATCH /api/contact/:id/close` - Close contact (admin)
- `GET /api/contact/stats/overview` - Contact statistics (admin)
- `DELETE /api/contact/:id` - Delete contact (admin)

### Admin
- `GET /api/admin/dashboard` - Dashboard overview
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get single user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users/admin` - Create admin user
- `GET /api/admin/stats` - System statistics

### Payments
- `POST /api/payments/create-payment-intent` - Create payment intent
- `POST /api/payments/confirm-payment` - Confirm payment and create booking
- `GET /api/payments/status/:paymentIntentId` - Get payment status
- `POST /api/payments/refund/:bookingId` - Refund payment (admin)
- `POST /api/payments/webhook` - Stripe webhook handler

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   Edit `.env` file with your configuration

4. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Update `MONGODB_URI` in your `.env` file

5. **Set up Stripe** (optional for development)
   - Create a Stripe account
   - Get your API keys from the Stripe dashboard
   - Update Stripe configuration in `.env`

6. **Seed the database**
   ```bash
   npm run seed
   ```

7. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Variables

### Required
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `FRONTEND_URL` - Frontend URL for CORS

### Optional
- `JWT_REFRESH_SECRET` - Secret key for refresh tokens
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `ADMIN_EMAIL` - Default admin email
- `ADMIN_PASSWORD` - Default admin password
- `ADMIN_NAME` - Default admin name

## Database Models

### User
- Authentication and profile management
- Role-based access control (ADMIN/USER)
- Password hashing with bcrypt

### Room
- Room information and availability
- Amenities and features
- Pricing and capacity

### Booking
- Booking details and status management
- Payment information
- Guest information

### Offer
- Special offers and discounts
- Date-based validity
- Room-specific offers

### Contact
- Contact form submissions
- Admin response system
- Status tracking

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Input Validation**: Express-validator for request validation
- **Rate Limiting**: Protection against abuse
- **CORS**: Cross-origin resource sharing configuration
- **Helmet**: Security headers
- **Environment Variables**: Secure configuration management

## Deployment

### Render Deployment

1. **Create a new Web Service on Render**
2. **Connect your GitHub repository**
3. **Configure environment variables**
4. **Set build command**: `npm install`
5. **Set start command**: `npm start`
6. **Deploy**

### Environment Variables for Production

```bash
NODE_ENV=production
MONGODB_URI=your-mongodb-atlas-uri
JWT_SECRET=your-production-jwt-secret
FRONTEND_URL=https://your-frontend-domain.com
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

## API Documentation

### Authentication Headers

For protected routes, include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Response Format

Success responses:
```json
{
  "message": "Success message",
  "data": { ... }
}
```

Error responses:
```json
{
  "error": "Error message",
  "details": { ... }
}
```

### Pagination

List endpoints support pagination:
```
GET /api/rooms?page=1&limit=10&sortBy=price&sortOrder=asc
```

Response includes pagination info:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

## Development

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run seed` - Seed database with initial data
- `npm test` - Run tests (when implemented)

### Database Seeding

The seed script creates:
- Admin user with default credentials
- Sample rooms with different types and amenities

Default admin credentials:
- Email: admin@asteriashomes.com
- Password: admin123

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details 