# Asterias Homes - Backend API

Welcome to the backend API for **Asterias Homes**, a robust and secure server-side application built with Node.js, Express, and MongoDB. This API powers the Asterias Homes apartment rental platform, handling everything from user authentication to room management and payment processing.

## ✨ Key Features

- **Secure User Authentication**: JWT-based authentication with role-based access control.
- **Comprehensive Apartment Management**: Full CRUD operations for apartments, including availability tracking.
- **End-to-End Booking System**: A complete workflow for creating, managing, and canceling bookings.
- **Stripe Payment Integration**: Securely process payments using Stripe.
- **Admin Panel Functionality**: A suite of tools for staff to manage the platform.
- **Image Uploads**: Cloudinary integration for efficient image handling and storage.

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (v18 or later)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Authentication**: [JSON Web Tokens (JWT)](https://jwt.io/)
- **Payments**: [Stripe](https://stripe.com/)
- **Image Uploads**: [Multer](https://github.com/expressjs/multer) & [Cloudinary](https://cloudinary.com/)

## 🚀 Getting Started

Follow these steps to set up and run the backend API on your local machine.

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

Your `.env` file should look like this:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/asterias-homes

# JWT Secrets
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret

# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Cloudinary Configuration (Optional)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### 4. Seed the Database (Optional)

To populate the database with initial data (e.g., an admin user, sample rooms), run the following command:

```bash
npm run seed
```

### 5. Start the Development Server

```bash
npm run dev
```

The API will be running at [http://localhost:5000](http://localhost:5000).

## 📚 API Endpoints

Here is a summary of the available API endpoints:

| Method | Endpoint                    | Description                     | Access   |
|--------|-----------------------------|---------------------------------|----------|
| `POST` | `/api/auth/register`        | Register a new user             | Public   |
| `POST` | `/api/auth/login`           | Log in a user                   | Public   |
| `GET`  | `/api/rooms`                | Get all rooms                   | Public   |
| `GET`  | `/api/rooms/:id`            | Get a single room by ID         | Public   |
| `POST` | `/api/bookings`             | Create a new booking            | Private  |
| `GET`  | `/api/bookings`             | Get bookings for the logged-in user | Private |
| `POST` | `/api/create-payment-intent`| Create a Stripe payment intent  | Private  |
| `GET`  | `/api/admin/bookings`       | Get all bookings                | Admin    |
| `POST` | `/api/admin/rooms`          | Create a new room               | Admin    |
| `PUT`  | `/api/admin/rooms/:id`      | Update a room                   | Admin    |
| `DELETE`| `/api/admin/rooms/:id`      | Delete a room                   | Admin    |

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements or want to report a bug, please open an issue or submit a pull request.

---

*This README provides instructions for the backend API. For the frontend application, please refer to the main `README.md` file.* 