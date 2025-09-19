const express = require('express');
const User = require('../models/User');
const { 
  authenticate, 
  requireAdmin, 
  requireOwnershipOrAdmin,
  createRateLimiter 
} = require('../middleware/auth');

const router = express.Router();

// Rate limiters
const adminLimiter = createRateLimiter(15 * 60 * 1000, 50); // 50 admin actions per 15 minutes
const generalLimiter = createRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filtering
// @access  Admin only
router.get('/users', authenticate, requireAdmin, adminLimiter, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const role = req.query.role;
    const isActive = req.query.isActive;
    const search = req.query.search;

    // Build filter object
    const filter = {};
    
    if (role) {
      filter.role = role;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Create sort object
    const sort = { [sortBy]: sortOrder };

    // Execute query
    const users = await User.find(filter)
      .select('-password -apiKeys')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      message: 'Users retrieved successfully.',
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users.',
      error: 'ADMIN_USERS_FETCH_ERROR'
    });
  }
});

// @route   GET /api/admin/users/:id
// @desc    Get specific user details
// @access  Admin only
router.get('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        error: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'User details retrieved successfully.',
      data: { user }
    });
  } catch (error) {
    console.error('Admin user fetch error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
        error: 'INVALID_USER_ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching user details.',
      error: 'ADMIN_USER_FETCH_ERROR'
    });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Admin only
router.put('/users/:id/role', authenticate, requireAdmin, adminLimiter, async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required (user, admin, moderator).',
        error: 'INVALID_ROLE'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        error: 'USER_NOT_FOUND'
      });
    }

    // Prevent self-demotion for admins
    if (req.user._id.toString() === user._id.toString() && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own admin role.',
        error: 'CANNOT_SELF_DEMOTE'
      });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `User role updated from ${oldRole} to ${role}.`,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Admin role update error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
        error: 'INVALID_USER_ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating user role.',
      error: 'ADMIN_ROLE_UPDATE_ERROR'
    });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Activate/Deactivate user account
// @access  Admin only
router.put('/users/:id/status', authenticate, requireAdmin, adminLimiter, async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value.',
        error: 'INVALID_STATUS'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        error: 'USER_NOT_FOUND'
      });
    }

    // Prevent self-deactivation for admins
    if (req.user._id.toString() === user._id.toString() && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account.',
        error: 'CANNOT_SELF_DEACTIVATE'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `User account ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isActive: user.isActive
        }
      }
    });
  } catch (error) {
    console.error('Admin status update error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
        error: 'INVALID_USER_ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating user status.',
      error: 'ADMIN_STATUS_UPDATE_ERROR'
    });
  }
});

// @route   POST /api/admin/users/:id/unlock
// @desc    Unlock user account (reset login attempts)
// @access  Admin only
router.post('/users/:id/unlock', authenticate, requireAdmin, adminLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        error: 'USER_NOT_FOUND'
      });
    }

    await user.resetLoginAttempts();

    res.json({
      success: true,
      message: 'User account unlocked successfully.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isLocked: user.isLocked
        }
      }
    });
  } catch (error) {
    console.error('Admin unlock error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
        error: 'INVALID_USER_ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error unlocking user account.',
      error: 'ADMIN_UNLOCK_ERROR'
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user account
// @access  Admin only
router.delete('/users/:id', authenticate, requireAdmin, adminLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        error: 'USER_NOT_FOUND'
      });
    }

    // Prevent self-deletion
    if (req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.',
        error: 'CANNOT_SELF_DELETE'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User account deleted successfully.',
      data: {
        deletedUser: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error('Admin delete error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
        error: 'INVALID_USER_ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error deleting user account.',
      error: 'ADMIN_DELETE_ERROR'
    });
  }
});

// @route   GET /api/admin/stats
// @desc    Get system statistics
// @access  Admin only
router.get('/stats', authenticate, requireAdmin, generalLimiter, async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    const lockedUsers = await User.countDocuments({ isLocked: true });

    // Get role statistics
    const adminCount = await User.countDocuments({ role: 'admin' });
    const moderatorCount = await User.countDocuments({ role: 'moderator' });
    const userCount = await User.countDocuments({ role: 'user' });

    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get recent logins (last 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const recentLogins = await User.countDocuments({
      lastLogin: { $gte: twentyFourHoursAgo }
    });

    res.json({
      success: true,
      message: 'System statistics retrieved successfully.',
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          locked: lockedUsers
        },
        roles: {
          admin: adminCount,
          moderator: moderatorCount,
          user: userCount
        },
        activity: {
          recentRegistrations,
          recentLogins
        },
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system statistics.',
      error: 'ADMIN_STATS_ERROR'
    });
  }
});

// @route   POST /api/admin/create-admin
// @desc    Create a new admin user
// @access  Admin only
router.post('/create-admin', authenticate, requireAdmin, adminLimiter, async (req, res) => {
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

    // Create new admin user
    const adminUser = await User.createAdmin({
      username,
      email: email.toLowerCase(),
      password,
      profile: {
        firstName: firstName || '',
        lastName: lastName || ''
      }
    });

    // Remove password from response
    adminUser.password = undefined;

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully.',
      data: {
        user: {
          id: adminUser._id,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role,
          profile: adminUser.profile,
          createdAt: adminUser.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    
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
      message: 'Error creating admin user.',
      error: 'ADMIN_CREATION_ERROR'
    });
  }
});

// @route   POST /api/admin/bulk-actions
// @desc    Perform bulk actions on users
// @access  Admin only
router.post('/bulk-actions', authenticate, requireAdmin, adminLimiter, async (req, res) => {
  try {
    const { action, userIds } = req.body;

    if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Action and user IDs array are required.',
        error: 'INVALID_BULK_ACTION'
      });
    }

    if (!['activate', 'deactivate', 'unlock', 'delete'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be: activate, deactivate, unlock, or delete.',
        error: 'INVALID_ACTION'
      });
    }

    // Prevent actions on self
    if (userIds.includes(req.user._id.toString())) {
      return res.status(400).json({
        success: false,
        message: 'Cannot perform bulk actions on your own account.',
        error: 'CANNOT_BULK_ACTION_SELF'
      });
    }

    let result;

    switch (action) {
      case 'activate':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { isActive: true }
        );
        break;
      case 'deactivate':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { isActive: false }
        );
        break;
      case 'unlock':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { 
            loginAttempts: 0,
            lockUntil: undefined
          }
        );
        break;
      case 'delete':
        result = await User.deleteMany({ _id: { $in: userIds } });
        break;
    }

    res.json({
      success: true,
      message: `Bulk ${action} completed successfully.`,
      data: {
        action,
        affectedCount: result.modifiedCount || result.deletedCount,
        userIds
      }
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing bulk action.',
      error: 'BULK_ACTION_ERROR'
    });
  }
});

module.exports = router;