'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const {
  register,
  login,
  getMe,
  updateUserRole,
  updateApplicability,
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');
const {
  registerSchema,
  loginSchema,
  updateRoleSchema,
  applicabilitySchema,
  validate,
} = require('../validators/auth.validator');

// ─── Auth-specific Rate Limiter ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                   // Brute-force guard: 30 attempts / 15 min / IP
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

// Save the signed-in user's declared regulatory scope (triage inputs)
router.patch('/me/applicability', protect, validate(applicabilitySchema), updateApplicability);

// Promote or demote a user — administrators only. Self-demotion and
// removal of the last administrator are refused in the controller.
router.patch('/users/:id/role', protect, requireAdmin, validate(updateRoleSchema), updateUserRole);

module.exports = router;
