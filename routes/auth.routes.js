'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { register, login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');
const { registerSchema, loginSchema, updateRoleSchema, validate } = require('../validators/auth.validator');

// ─── Auth-specific Rate Limiter ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // Relaxed for local development and testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Auth]
 */
router.post('/register', authLimiter, validate(registerSchema), register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate and receive a JWT token
 *     tags: [Auth]
 */
router.post('/login', authLimiter, validate(loginSchema), login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get the current user's profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 */
router.get('/me', protect, getMe);

// Update a user's role — admin only
const User = require('../models/User.model');
router.patch('/users/:id/role', protect, requireAdmin, validate(updateRoleSchema), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.status(200).json({ success: true, data: { user } });
  } catch (err) { return next(err); }
});

module.exports = router;
