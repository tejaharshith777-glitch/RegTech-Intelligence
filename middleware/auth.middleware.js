'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

/**
 * JWT Authentication Middleware
 *
 * Expects a Bearer token in the Authorization header:
 *   Authorization: Bearer <token>
 *
 * On success: attaches the full `user` document to `req.user`.
 * On failure: responds with 401 Unauthorized.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Extract token from Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  try {
    // 2. Verify and decode the token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured on the server.');
    }

    const decoded = jwt.verify(token, secret);

    // 3. Fetch the corresponding user from DB (excluding password)
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is valid but user no longer exists.',
      });
    }

    // 4. Attach user to request for downstream use
    req.user = user;
    return next();
  } catch (error) {
    // Differentiate between token expiry and other JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
      });
    }

    // Propagate unexpected errors to the global error handler
    return next(error);
  }
};

/**
 * Role-Based Authorization Middleware (factory)
 *
 * Usage: authorize('admin') or authorize('admin', 'researcher')
 * Must be used AFTER `protect`.
 *
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access forbidden. Requires one of the following roles: ${roles.join(', ')}.`,
      });
    }

    return next();
  };
};

module.exports = { protect, authorize };
