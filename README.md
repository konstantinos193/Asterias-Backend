# Asterias Homes - Backend API

Welcome to the backend API for **Asterias Homes**, a comprehensive hotel management system built with Node.js, Express, and MongoDB. This robust API powers the complete hotel operations platform, handling everything from guest management to advanced analytics and reporting.

## ✨ Key Features

### Core Functionality
- **Secure Authentication**: JWT-based authentication with role-based access control (Admin/User)
- **Comprehensive Room Management**: Full CRUD operations for rooms with features, amenities, and availability tracking
- **Advanced Booking System**: Complete booking workflow with status management and guest information
- **Stripe Payment Integration**: Secure payment processing with payment intent creation
- **Guest Management**: Detailed guest profiles with booking history and contact information

### Admin Dashboard Features
- **Real-time Dashboard**: Live statistics with occupancy rates, revenue tracking, and daily metrics
- **Booking Management**: Complete booking oversight with status updates and filtering
- **Room Administration**: Room creation, editing, and availability management
- **Special Offers**: Dynamic offer creation with discount management and room selection
- **Guest Database**: Comprehensive guest management with search and filtering capabilities

### Analytics & Reporting
- **Comprehensive Analytics**: Detailed booking statistics, revenue analysis, and occupancy tracking
- **Performance Metrics**: Room performance analysis, lead time insights, and cancellation rates
- **Revenue Reports**: Monthly revenue breakdowns, payment method analysis, and ADR calculations
- **Guest Demographics**: Family/couple/solo booking analysis and group size metrics
- **Data Export**: Excel export functionality for all reports with Greek localization

### Integration Features
- **Booking.com Integration**: Webhook support for external booking platform synchronization
- **Image Management**: Cloudinary integration for efficient image handling and storage
- **Contact Management**: Contact form handling with admin notifications
- **Multi-language Support**: Greek and English content management

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (v18 or later)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Authentication**: [JSON Web Tokens (JWT)](https://jwt.io/)
- **Payments**: [Stripe](https://stripe.com/)
- **Image Storage**: [Cloudinary](https://cloudinary.com/)
- **Password Hashing**: [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **Validation**: [express-validator](https://express-validator.github.io/)

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [MongoDB](https://www.mongodb.com/try/download/community) installed and running
- A [Stripe](https://stripe.com/) account for payment processing
- A [Cloudinary](https://cloudinary.com/) account for image uploads (optional)

### 1. Navigate to the Backend Directory

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the `env.example` file to a new `.env` file and fill in the required values.

```bash
cp env.example .env
```

Your `.env` file should include:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/asterias-homes

# JWT Secrets
JWT_SECRET=your_strong_jwt_secret_key
JWT_REFRESH_SECRET=your_strong_refresh_secret_key

# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# Cloudinary Configuration (Optional)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Booking.com Integration (Optional)
BOOKINGCOM_WEBHOOK_SECRET=your_bookingcom_webhook_secret
```

### 4. Initialize Admin User

Create the initial admin user:

```bash
node create-admin.js
```

This will create an admin user with:
- Email: admin@asterias.gr
- Password: admin123
- Role: ADMIN

### 5. Seed the Database (Optional)

To populate the database with sample rooms and data:

```bash
node src/seed.js
```

### 6. Start the Development Server

```bash
npm run dev
```

The API will be running at [http://localhost:3001](http://localhost:3001).

## 📚 API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/auth/register` | Register new user | Public |
| `POST` | `/api/auth/login` | User login | Public |
| `POST` | `/api/auth/logout` | User logout | Private |
| `GET` | `/api/auth/profile` | Get user profile | Private |
| `PUT` | `/api/auth/profile` | Update user profile | Private |
| `POST` | `/api/auth/refresh` | Refresh JWT token | Private |

### Rooms
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/rooms` | Get all rooms | Public |
| `GET` | `/api/rooms/:id` | Get room by ID | Public |
| `GET` | `/api/rooms/:id/availability` | Check room availability | Public |

### Bookings
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/bookings` | Create new booking | Private |
| `GET` | `/api/bookings` | Get user bookings | Private |
| `GET` | `/api/bookings/:id` | Get booking details | Private |
| `PUT` | `/api/bookings/:id` | Update booking | Private |
| `DELETE` | `/api/bookings/:id` | Cancel booking | Private |

### Payments
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/payments/create-payment-intent` | Create Stripe payment intent | Private |
| `POST` | `/api/payments/confirm-payment` | Confirm payment | Private |

### Offers
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/offers` | Get all active offers | Public |
| `GET` | `/api/offers/:id` | Get offer details | Public |

### Contact
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/contact` | Submit contact form | Public |

### Admin - Dashboard
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/admin/dashboard` | Get dashboard statistics | Admin |
| `GET` | `/api/admin/stats` | Get system statistics | Admin |

### Admin - Bookings Management
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/admin/bookings` | Get all bookings with filters | Admin |
| `PUT` | `/api/admin/bookings/:id` | Update booking status | Admin |
| `DELETE` | `/api/admin/bookings/:id` | Cancel/delete booking | Admin |

### Admin - Room Management
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/admin/rooms` | Get all rooms | Admin |
| `POST` | `/api/admin/rooms` | Create new room | Admin |
| `PUT` | `/api/admin/rooms/:id` | Update room | Admin |
| `DELETE` | `/api/admin/rooms/:id` | Delete room | Admin |

### Admin - User Management
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/admin/users` | Get all users with filters | Admin |
| `GET` | `/api/admin/users/:id` | Get user details | Admin |
| `PUT` | `/api/admin/users/:id` | Update user | Admin |
| `DELETE` | `/api/admin/users/:id` | Delete user | Admin |
| `POST` | `/api/admin/users/admin` | Create admin user | Admin |

### Admin - Offers Management
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/admin/offers` | Get all offers | Admin |
| `POST` | `/api/admin/offers` | Create new offer | Admin |
| `PUT` | `/api/admin/offers/:id` | Update offer | Admin |
| `DELETE` | `/api/admin/offers/:id` | Delete offer | Admin |

### Admin - Analytics & Reports
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/admin/analytics` | Get comprehensive analytics | Admin |
| `GET` | `/api/admin/revenue-reports` | Get revenue reports | Admin |

### Webhooks
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/bookingcom-webhooks` | Booking.com webhook handler | External |

## 🔧 Database Models

### User Model
- Authentication and profile information
- Role-based access control (ADMIN/USER)
- Password hashing with bcrypt
- JWT token management

### Room Model
- Complete room information with multilingual support
- Features, amenities, and capacity management
- Image gallery and pricing
- Availability tracking

### Booking Model
- Comprehensive booking workflow
- Guest information and special requests
- Payment status and booking status tracking
- Integration with external platforms

### Offer Model
- Dynamic special offers with discount management
- Date ranges and room applicability
- Status management (active/inactive)

### Contact Model
- Contact form submissions
- Status tracking and admin notifications

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── index.js              # Main application entry point
│   ├── models/               # Mongoose data models
│   │   ├── User.js
│   │   ├── Room.js
│   │   ├── Booking.js
│   │   ├── Offer.js
│   │   └── Contact.js
│   ├── routes/               # API route handlers
│   │   ├── auth.js           # Authentication routes
│   │   ├── rooms.js          # Room management
│   │   ├── bookings.js       # Booking operations
│   │   ├── admin.js          # Admin panel API
│   │   ├── offers.js         # Special offers
│   │   ├── contact.js        # Contact form
│   │   └── payments.js       # Payment processing
│   ├── middleware/           # Express middleware
│   │   ├── auth.js           # JWT authentication
│   │   └── apiKey.js         # API key validation
│   └── services/             # Business logic services
│       └── bookingcom.service.js
├── create-admin.js           # Admin user creation script
├── test-backend.js           # API testing utilities
└── package.json
```

## 🚀 Deployment

### Production Environment Variables

Ensure all environment variables are set for production:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://your-production-mongodb-url
JWT_SECRET=your-very-secure-production-jwt-secret
STRIPE_SECRET_KEY=sk_live_your-production-stripe-key
FRONTEND_URL=https://your-domain.com
```

### Render.com Deployment

This project is configured for deployment on Render.com with the included `render.yaml` configuration.

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Test MongoDB connection:

```bash
node test-mongodb.js
```

Test backend endpoints:

```bash
node test-backend.js
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*For frontend setup instructions, please refer to the main README.md file in the root directory.* 