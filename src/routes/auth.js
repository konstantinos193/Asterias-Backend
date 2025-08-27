const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, generateToken, generateRefreshToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Register new user
router.post('/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      phone
    });

    await user.save();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      user: user.getPublicProfile(),
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    
    console.log('Login attempt for username:', username);

    // Hardcoded admin credentials check
    if (username === 'admin' && password === 'admin1') {
      // Create admin user object for response
      const adminUser = {
        _id: 'admin-user-id',
        name: 'Admin User',
        username: 'admin',
        email: 'admin@asterias.com',
        role: 'ADMIN',
        isActive: true,
        getPublicProfile: function() {
          return {
            _id: this._id,
            name: this.name,
            username: this.username,
            email: this.email,
            role: this.role,
            isActive: this.isActive
          };
        }
      };

      // Generate tokens
      const token = generateToken(adminUser._id);
      const refreshToken = generateRefreshToken(adminUser._id);

      // Set the cookie with proper settings
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only true in production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
      });

      console.log('Login successful for admin user');

      res.json({
        message: 'Login successful',
        user: adminUser.getPublicProfile(),
        token,
        refreshToken
      });
      return;
    }

    // Find user by username for regular users
    const user = await User.findByUsername(username);
    if (!user) {
      console.log('User not found for username:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('User found:', {
      id: user._id,
      username: user.username,
      role: user.role,
      isActive: user.isActive
    });

    // Check if user is active
    if (!user.isActive) {
      console.log('User is not active:', username);
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    console.log('Password validation result:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // After successful login, set the cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: true, // required for SameSite=None
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
    });

    console.log('Login successful for user:', username);

    res.json({
      message: 'Login successful',
      user: user.getPublicProfile(),
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('phone').optional().trim(),
  body('preferences').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, preferences } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (preferences) updates.preferences = { ...req.user.preferences, ...preferences };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isCurrentPasswordValid = await req.user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password
    req.user.password = newPassword;
    await req.user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Create initial admin (one-time use)
router.post('/create-admin', async (req, res) => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'ADMIN' });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin user already exists' });
    }

    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Create admin user
    const adminData = {
      name,
      email,
      password,
      role: 'ADMIN',
      isActive: true
    };

    const admin = await User.createAdmin(adminData);

    res.status(201).json({
      message: 'Admin user created successfully',
      user: admin.getPublicProfile()
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// Reset admin password (for debugging)
router.post('/reset-admin-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admin users can reset passwords' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ 
      message: 'Password updated successfully',
      email: user.email,
      role: user.role
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Debug endpoint to list all users (remove in production)
router.get('/debug/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json({
      count: users.length,
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Delete user by email (for debugging)
router.delete('/debug/delete-user', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOneAndDelete({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'User deleted successfully',
      deletedUser: {
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Test password hashing (for debugging)
router.post('/debug/test-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordValid = await user.comparePassword(password);
    
    res.json({  
      userFound: true,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      passwordValid: isPasswordValid,
      hashedPassword: user.password.substring(0, 20) // Show first 20 chars for debugging
    });
  } catch (error) {
    console.error('Password test error:', error);
    res.status(500).json({ error: 'Failed to test password' });
  }
});

module.exports = router; 