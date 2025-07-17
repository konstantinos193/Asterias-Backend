# Asterias Homes Backend API

A comprehensive hotel booking system backend built with Node.js, Express, and MongoDB.

## 🚀 Features

- **Authentication & Authorization**: JWT-based user authentication with role-based access
- **Room Management**: CRUD operations for hotel rooms with availability checking
- **Booking System**: Complete booking workflow with payment integration
- **Payment Processing**: Stripe integration for secure payments
- **Admin Panel**: Administrative functions for hotel management
- **Contact Management**: Customer inquiry handling
- **Offers & Packages**: Special deals and promotional offers
- **Image Upload**: Cloudinary integration for image storage
- **Email Notifications**: Automated email sending with Nodemailer

## 🛠️ Tech Stack

- **Runtime**: Node.js (>=18.0.0)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Payment**: Stripe
- **File Upload**: Multer + Cloudinary
- **Email**: Nodemailer
- **Security**: Helmet, CORS, Rate Limiting

## 📋 Prerequisites

- Node.js >= 18.0.0
- MongoDB database (local or cloud)
- Stripe account for payments
- Cloudinary account for image uploads (optional)

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd backend
npm install
```

### 2. Environment Setup

Copy the example environment file and configure your variables:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/asterias-homes

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Cloudinary Configuration (optional, for image uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Admin Default Credentials (for initial setup)
ADMIN_EMAIL=admin@asteriashomes.com
ADMIN_PASSWORD=admin123
ADMIN_NAME=Admin User
```

### 3. Database Setup

Make sure MongoDB is running and accessible with the URI specified in your `.env` file.

### 4. Seed Database (Optional)

```bash
npm run seed
```

This will create initial data including admin user, sample rooms, and offers.

### 5. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000`

## 🚀 Deployment on Render

### 1. Connect Your Repository

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Select the `backend` directory

### 2. Configure Environment Variables

In Render dashboard, add these environment variables:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_production_jwt_secret
JWT_REFRESH_SECRET=your_production_refresh_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
FRONTEND_URL=https://your-frontend-domain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
ADMIN_EMAIL=admin@asteriashomes.com
ADMIN_PASSWORD=secure_admin_password
ADMIN_NAME=Admin User
```

### 3. Build & Deploy Settings

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment**: Node

### 4. Deploy

Click "Create Web Service" and Render will automatically deploy your backend.

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - User logout

### Rooms
- `GET /api/rooms` - Get all rooms
- `GET /api/rooms/:id` - Get room by ID
- `POST /api/rooms` - Create room (admin only)
- `PUT /api/rooms/:id` - Update room (admin only)
- `DELETE /api/rooms/:id` - Delete room (admin only)

### Bookings
- `GET /api/bookings` - Get user bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Get booking by ID
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking

### Payments
- `POST /api/payments/create-payment-intent` - Create Stripe payment intent
- `POST /api/payments/webhook` - Stripe webhook handler

### Admin
- `GET /api/admin/stats` - Get admin statistics
- `GET /api/admin/bookings` - Get all bookings (admin only)
- `PUT /api/admin/bookings/:id` - Update booking status (admin only)

### Offers
- `GET /api/offers` - Get all offers
- `POST /api/offers` - Create offer (admin only)
- `PUT /api/offers/:id` - Update offer (admin only)
- `DELETE /api/offers/:id` - Delete offer (admin only)

### Contact
- `POST /api/contact` - Submit contact form

## 🔧 Development

### Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run build      # Build step (no-op for Node.js)
npm run test       # Run tests
npm run seed       # Seed database with initial data
```

### Project Structure

```
backend/
├── src/
│   ├── models/          # MongoDB models
│   ├── routes/          # API route handlers
│   ├── middleware/      # Custom middleware
│   ├── index.js         # Main server file
│   └── seed.js          # Database seeding script
├── package.json
├── env.example
└── README.md
```

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API rate limiting
- **Input Validation**: Express-validator
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcryptjs

## 📊 Health Check

Visit `/health` to check API status:

```json
{
  "status": "OK",
  "message": "Asterias Homes API is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check your `MONGODB_URI` environment variable
   - Ensure MongoDB is running and accessible

2. **JWT Errors**
   - Verify `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
   - Use strong, unique secrets in production

3. **CORS Errors**
   - Check `FRONTEND_URL` environment variable
   - Ensure frontend URL is correctly configured

4. **Stripe Payment Issues**
   - Verify Stripe keys are correct
   - Check webhook endpoint configuration

### Logs

Check Render logs for detailed error information and debugging.

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support, email support@asteriashomes.com or create an issue in the repository. 