const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    let token = null;
    
    // First check for token in cookies (more secure)
    if (req.cookies && req.cookies.authToken) {
      token = req.cookies.authToken;
    }
    
    // Fallback to Authorization header
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    }

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Handle hardcoded admin user
    if (decoded.userId === 'admin-user-id') {
      const adminUser = {
        _id: 'admin-user-id',
        name: 'Admin User',
        username: 'admin',
        email: 'admin@asterias.com',
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      req.user = adminUser;
      return next();
    }
    
    // Regular user lookup from database
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// Middleware to accept either API key OR admin authentication
const requireApiKeyOrAdmin = (req, res, next) => {
  // Debug logging
  console.log('requireApiKeyOrAdmin middleware called');
  console.log('Headers received:', req.headers);
  console.log('x-api-key header:', req.headers['x-api-key']);
  console.log('X-API-Key header:', req.headers['x-api-key']);
  console.log('Expected API key:', process.env.API_KEY);
  
  // Check if API key is provided
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === process.env.API_KEY) {
    console.log('API key validation successful');
    return next(); // API key is valid, proceed
  }
  
  console.log('API key validation failed, checking admin authentication');
  
  // If no API key, check admin authentication
  if (!req.user) {
    console.log('No user found, returning 401');
    return res.status(401).json({ error: 'API key or authentication required' });
  }

  if (req.user.role !== 'ADMIN') {
    console.log('User is not admin, returning 403');
    return res.status(403).json({ error: 'Admin access required' });
  }

  console.log('Admin authentication successful');
  next();
};

// Middleware to check if user is admin or the resource owner
const requireAdminOrOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role === 'ADMIN') {
    return next();
  }

  // Check if user is the owner of the resource
  if (req.params.userId && req.params.userId === req.user._id.toString()) {
    return next();
  }

  return res.status(403).json({ error: 'Access denied' });
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireApiKeyOrAdmin,
  requireAdminOrOwner,
  optionalAuth,
  generateToken,
  generateRefreshToken
}; 