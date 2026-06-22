import express from 'express';
import User from '../models/User.js';
import { authenticate, generateToken, createRateLimiter } from '../middleware/auth.js';

const router = express.Router();

// Rate limiters to prevent brute-force attacks
const loginLimiter    = createRateLimiter(15 * 60 * 1000, 10); // 10 attempts / 15 min
const registerLimiter = createRateLimiter(60 * 60 * 1000, 5);  // 5 registrations / hour

// ─── POST /api/auth/register ───────────────────────────────────────────────
// Create a new user account
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'username, email, and password are required.' });
    }

    // Check for duplicate email or username
    const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email or username already in use.' });
    }

    const user = new User({
      username,
      email: email.toLowerCase(),
      password,
      profile: { firstName: firstName || '', lastName: lastName || '' },
    });

    await user.save();
    const token = generateToken({ id: user._id, role: user.role });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { token, user: formatUser(user) },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const details = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: 'Validation failed.', details });
    }
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────
// Login with email/username + password → returns JWT token
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'identifier (email/username) and password are required.' });
    }

    const user = await User.findByEmailOrUsername(identifier);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.isLocked) {
      return res.status(401).json({ success: false, message: 'Account is temporarily locked. Try again later.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated.' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      await user.incLoginAttempts();
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Successful login: reset attempts + update lastLogin
    if (user.loginAttempts > 0) await user.resetLoginAttempts();
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({ id: user._id, role: user.role });

    res.json({
      success: true,
      message: 'Login successful.',
      data: { token, user: formatUser(user) },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ─── GET /api/auth/profile ─────────────────────────────────────────────────
// Get the logged-in user's profile (requires JWT in Authorization header)
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: { user: formatUser(user) } });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile.' });
  }
});

// ─── PUT /api/auth/profile ─────────────────────────────────────────────────
// Update first name, last name, or bio
router.put('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { firstName, lastName, bio } = req.body;

    if (firstName !== undefined) user.profile.firstName = firstName;
    if (lastName !== undefined) user.profile.lastName = lastName;
    if (bio !== undefined) user.profile.bio = bio;

    await user.save();
    res.json({ success: true, message: 'Profile updated.', data: { user: formatUser(user) } });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile.' });
  }
});

// ─── POST /api/auth/change-password ───────────────────────────────────────
// Change password (must provide current password to confirm)
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Error changing password.' });
  }
});

// ─── POST /api/auth/logout ─────────────────────────────────────────────────
// Stateless JWT — client just deletes the token. This endpoint confirms it.
router.post('/logout', authenticate, (req, res) => {
  res.json({ success: true, message: 'Logged out successfully. Please delete your token on the client side.' });
});


// ─── Helper ───────────────────────────────────────────────────────────────
// Return a clean user object without sensitive fields
function formatUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    profile: user.profile,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}

export default router;