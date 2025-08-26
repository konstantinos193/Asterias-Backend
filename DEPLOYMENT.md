# 🚀 Asterias Homes Backend Deployment Guide

## Quick Start for Render Deployment

### 1. **Prepare Your Environment Variables**

Create a `.env` file in the backend directory with these variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration (Use MongoDB Atlas for production)
MONGODB_URI=mongodb://localhost:27017/asterias-homes

# JWT Configuration (Generate strong secrets for production)
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Admin Default Credentials
ADMIN_EMAIL=admin@asteriashomes.com
ADMIN_PASSWORD=admin123
ADMIN_NAME=Admin User

# Optional: Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Optional: Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional: Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 2. **Test Locally First**

```bash
cd backend
npm install
npm run dev
```

Visit `http://localhost:5000/health` to verify the server is running.

### 3. **Deploy to Render**

#### Step 1: Connect Repository
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the `backend` directory

#### Step 2: Configure Settings
- **Name**: `asterias-homes-backend`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

#### Step 3: Set Environment Variables
In Render dashboard, add these environment variables:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_production_jwt_secret
JWT_REFRESH_SECRET=your_production_refresh_secret
FRONTEND_URL=https://your-frontend-domain.com
ADMIN_EMAIL=admin@asteriashomes.com
ADMIN_PASSWORD=secure_admin_password
ADMIN_NAME=Admin User
```

#### Step 4: Deploy
Click "Create Web Service" and wait for deployment.

### 4. **Post-Deployment Setup**

#### Seed the Database
After deployment, seed your database with initial data:

```bash
# Set your production environment variables first
npm run seed
```

#### Verify Deployment
Visit your deployed URL:
- Health check: `https://your-app.onrender.com/health`
- API info: `https://your-app.onrender.com/`

### 5. **Admin Panel Access**

After seeding, login to admin panel:
- **Email**: `admin@asteriashomes.com`
- **Password**: `admin123` (or your custom password)

### 6. **API Endpoints**

Your backend provides these endpoints:

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile

#### Rooms
- `GET /api/rooms` - Get all rooms
- `GET /api/rooms/:id` - Get room by ID

#### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/my-bookings` - Get user bookings
- `GET /api/bookings/:id` - Get booking by ID

#### Admin Panel
- `GET /api/admin/dashboard` - Dashboard overview
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id` - Update user

#### Payments
- `POST /api/payments/create-payment-intent` - Create Stripe payment
- `POST /api/payments/webhook` - Stripe webhook

### 7. **Troubleshooting**

#### Common Issues:

1. **MongoDB Connection Error**
   - Check your `MONGODB_URI` in Render environment variables
   - Ensure MongoDB Atlas is accessible

2. **JWT Errors**
   - Verify `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
   - Use strong, unique secrets

3. **CORS Errors**
   - Check `FRONTEND_URL` environment variable
   - Update to your actual frontend URL

4. **Port Issues**
   - Render uses port 10000, but your app should use `process.env.PORT`

#### Check Logs:
- Go to your Render service
- Click "Logs" tab
- Look for error messages

### 8. **Security Checklist**

- [ ] Use strong JWT secrets
- [ ] Set up MongoDB Atlas with proper security
- [ ] Configure CORS properly
- [ ] Use HTTPS in production
- [ ] Set up proper environment variables
- [ ] Change default admin password

### 9. **Performance Tips**

- Enable MongoDB Atlas caching
- Use proper indexes (already configured in models)
- Monitor Render logs for performance issues
- Consider upgrading to paid plan for better performance

### 10. **Monitoring**

Your backend includes:
- Health check endpoint: `/health`
- Error logging
- Request validation
- Rate limiting

### 11. **Next Steps**

1. **Update Frontend**: Point your frontend to the deployed backend URL
2. **Set up Stripe**: Configure payment processing
3. **Set up Email**: Configure SMTP for notifications
4. **Set up Cloudinary**: Configure image uploads
5. **Monitor**: Set up monitoring and alerts

### 12. **Support**

If you encounter issues:
1. Check Render logs
2. Verify environment variables
3. Test endpoints with Postman
4. Check MongoDB connection
5. Review error messages in logs

---

**🎉 Your backend is now ready for production!** 