import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import { 
  authenticate, 
  requireAdmin, 
  requireOwnershipOrAdmin,
  generateToken,
  createRateLimiter 
} from '../middleware/auth.js';

const router = express.Router();

// Rate limiters
const loginLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 attempts per 15 minutes
const registerLimiter = createRateLimiter(60 * 60 * 1000, 3); // 3 registrations per hour
const generalLimiter = createRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required.',
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists.',
        error: 'USER_ALREADY_EXISTS'
      });
    }

    // Create new user
    const user = new User({
      username,
      email: email.toLowerCase(),
      password,
      profile: {
        firstName: firstName || '',
        lastName: lastName || ''
      }
    });

    await user.save();

    // Generate token
    const token = generateToken({ id: user._id, role: user.role });

    // Remove password from response
    user.password = undefined;

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          profile: user.profile,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        error: 'VALIDATION_ERROR',
        details: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
      error: 'REGISTRATION_ERROR'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or username

    // Validation
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/username and password are required.',
        error: 'MISSING_CREDENTIALS'
      });
    }

    // Find user by email or username
    const user = await User.findByEmailOrUsername(identifier);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed login attempts.',
        error: 'ACCOUNT_LOCKED'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated.',
        error: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken({ id: user._id, role: user.role });

    // Remove password from response
    user.password = undefined;

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          profile: user.profile,
          preferences: user.preferences,
          lastLogin: user.lastLogin
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login.',
      error: 'LOGIN_ERROR'
    });
  }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      message: 'Profile retrieved successfully.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          profile: user.profile,
          preferences: user.preferences,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile.',
      error: 'PROFILE_FETCH_ERROR'
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update current user profile
// @access  Private
router.put('/profile', authenticate, generalLimiter, async (req, res) => {
  try {
    const { profile, preferences } = req.body;
    const user = await User.findById(req.user._id);

    // Update profile fields
    if (profile) {
      if (profile.firstName !== undefined) user.profile.firstName = profile.firstName;
      if (profile.lastName !== undefined) user.profile.lastName = profile.lastName;
      if (profile.bio !== undefined) user.profile.bio = profile.bio;
      if (profile.avatar !== undefined) user.profile.avatar = profile.avatar;
    }

    // Update preferences
    if (preferences) {
      if (preferences.theme) user.preferences.theme = preferences.theme;
      if (preferences.language) user.preferences.language = preferences.language;
      if (preferences.notifications) {
        if (preferences.notifications.email !== undefined) {
          user.preferences.notifications.email = preferences.notifications.email;
        }
        if (preferences.notifications.browser !== undefined) {
          user.preferences.notifications.browser = preferences.notifications.browser;
        }
      }
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          profile: user.profile,
          preferences: user.preferences
        }
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        error: 'VALIDATION_ERROR',
        details: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating profile.',
      error: 'PROFILE_UPDATE_ERROR'
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', authenticate, generalLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.',
        error: 'MISSING_PASSWORDS'
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
        error: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    console.error('Password change error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'New password validation failed.',
        error: 'PASSWORD_VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error changing password.',
      error: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

// @route   POST /api/auth/api-keys
// @desc    Generate new API key
// @access  Private
router.post('/api-keys', authenticate, generalLimiter, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'API key name is required.',
        error: 'MISSING_API_KEY_NAME'
      });
    }

    const user = await User.findById(req.user._id);
    const apiKey = user.generateAPIKey();

    user.apiKeys.push({
      name,
      key: apiKey,
      createdAt: new Date(),
      isActive: true
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'API key generated successfully.',
      data: {
        apiKey: {
          name,
          key: apiKey,
          createdAt: new Date()
        }
      }
    });
  } catch (error) {
    console.error('API key generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating API key.',
      error: 'API_KEY_GENERATION_ERROR'
    });
  }
});

// @route   GET /api/auth/api-keys
// @desc    Get user's API keys
// @access  Private
router.get('/api-keys', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    const apiKeys = user.apiKeys.map(key => ({
      id: key._id,
      name: key.name,
      key: key.key.substring(0, 8) + '...' + key.key.substring(key.key.length - 4), // Masked key
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      isActive: key.isActive
    }));

    res.json({
      success: true,
      message: 'API keys retrieved successfully.',
      data: { apiKeys }
    });
  } catch (error) {
    console.error('API keys fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching API keys.',
      error: 'API_KEYS_FETCH_ERROR'
    });
  }
});

// @route   DELETE /api/auth/api-keys/:keyId
// @desc    Delete API key
// @access  Private
router.delete('/api-keys/:keyId', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    user.apiKeys = user.apiKeys.filter(
      key => key._id.toString() !== req.params.keyId
    );

    await user.save();

    res.json({
      success: true,
      message: 'API key deleted successfully.'
    });
  } catch (error) {
    console.error('API key deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting API key.',
      error: 'API_KEY_DELETION_ERROR'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (mainly for token blacklisting if implemented)
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  // In a stateless JWT system, logout is handled client-side by removing the token
  // Here you could implement token blacklisting if needed
  res.json({
    success: true,
    message: 'Logout successful.'
  });
});

export default router;