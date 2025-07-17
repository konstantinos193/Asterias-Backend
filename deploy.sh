#!/bin/bash

# Asterias Homes Backend Deployment Script
# This script helps prepare the backend for deployment on Render

echo "🚀 Asterias Homes Backend Deployment Script"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the backend directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "✅ Created .env file from template"
        echo "⚠️  Please update the .env file with your actual values before deployment"
    else
        echo "❌ env.example not found"
        exit 1
    fi
else
    echo "✅ .env file found"
fi

# Check required environment variables
echo "🔍 Checking environment variables..."

REQUIRED_VARS=("MONGODB_URI" "JWT_SECRET" "JWT_REFRESH_SECRET")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "⚠️  Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo "Please update your .env file with these variables"
else
    echo "✅ All required environment variables are set"
fi

# Test the application
echo "🧪 Testing application startup..."
timeout 10s npm start > /dev/null 2>&1 &
PID=$!
sleep 3

if kill -0 $PID 2>/dev/null; then
    echo "✅ Application starts successfully"
    kill $PID
else
    echo "❌ Application failed to start. Check your configuration."
    exit 1
fi

# Check for common issues
echo "🔍 Running deployment checks..."

# Check if all routes exist
ROUTES_DIR="src/routes"
REQUIRED_ROUTES=("auth.js" "rooms.js" "bookings.js" "offers.js" "contact.js" "admin.js" "payments.js")

for route in "${REQUIRED_ROUTES[@]}"; do
    if [ -f "$ROUTES_DIR/$route" ]; then
        echo "✅ Route: $route"
    else
        echo "❌ Missing route: $route"
    fi
done

# Check if models exist
MODELS_DIR="src/models"
REQUIRED_MODELS=("User.js" "Room.js" "Booking.js" "Offer.js" "Contact.js")

for model in "${REQUIRED_MODELS[@]}"; do
    if [ -f "$MODELS_DIR/$model" ]; then
        echo "✅ Model: $model"
    else
        echo "❌ Missing model: $model"
    fi
done

echo ""
echo "🎉 Deployment preparation completed!"
echo ""
echo "📋 Next steps for Render deployment:"
echo "1. Push your code to GitHub"
echo "2. Connect your repository to Render"
echo "3. Set the following environment variables in Render:"
echo "   - NODE_ENV=production"
echo "   - PORT=10000"
echo "   - MONGODB_URI (your MongoDB connection string)"
echo "   - JWT_SECRET (your JWT secret)"
echo "   - JWT_REFRESH_SECRET (your refresh token secret)"
echo "   - STRIPE_SECRET_KEY (your Stripe secret key)"
echo "   - STRIPE_PUBLISHABLE_KEY (your Stripe publishable key)"
echo "   - FRONTEND_URL (your frontend URL)"
echo "4. Set build command: npm install"
echo "5. Set start command: npm start"
echo "6. Deploy!"
echo ""
echo "🔗 Health check endpoint will be available at: https://your-app.onrender.com/health" 