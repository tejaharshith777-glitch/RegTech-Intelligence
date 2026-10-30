'use strict';

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User.model');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a signed JWT for the given user ID.
 * @param {string} userId
 * @returns {string}
 */
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables.');
  }

  return jwt.sign({ id: userId }, secret, { expiresIn });
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body; // ignore any client-supplied role

    // Check for existing user (belt-and-suspenders alongside unique index)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // The role is NEVER taken from the request body. The only way to become an
    // administrator is to be listed in the server-side ADMIN_EMAILS env var
    // (a deployment bootstrap), or to be promoted later by an existing admin.
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const assignedRole = adminEmails.includes(String(email).toLowerCase())
      ? 'admin'
      : 'researcher';

    // Create user — password hashed by the pre-save hook in User.model.js
    const user = await User.create({
      username,
      email,
      password,
      role: assignedRole,
    });

    const token = generateToken(user._id.toString());

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Authenticate an existing user and return a JWT
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Explicitly select password (field has `select: false` by default)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      // Generic message to prevent user enumeration
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Return the profile of the currently authenticated user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    // req.user is set by the protect middleware
    return res.status(200).json({
      success: true,
      data: { user: req.user },
    });
  } catch (error) {
    return next(error);
  }
};


/**
 * @desc    Promote or demote a user. Administrator only.
 * @route   PATCH /api/auth/users/:id/role
 * @access  Private (admin)
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `"${id}" is not a valid user ID.` });
    }

    if (String(req.user._id) === String(id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role. Ask another administrator.',
      });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Never allow the last administrator to be demoted out of existence.
    if (target.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(409).json({
          success: false,
          message: 'At least one administrator must remain.',
        });
      }
    }

    target.role = role;
    await target.save();

    return res.status(200).json({
      success: true,
      message: 'Role updated.',
      data: {
        user: {
          id: target._id,
          username: target.username,
          email: target.email,
          role: target.role,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Save the current user's declared regulatory scope (triage inputs)
 * @route   PATCH /api/auth/me/applicability
 * @access  Private
 */
const updateApplicability = async (req, res, next) => {
  try {
    const { jurisdiction, entityTypes, businessLines } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.applicability = {
      jurisdiction: jurisdiction || '',
      entityTypes: Array.isArray(entityTypes) ? entityTypes : [],
      businessLines: Array.isArray(businessLines) ? businessLines : [],
      completedAt: new Date(),
    };
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Applicability profile saved.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          applicability: user.applicability,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Lightweight authenticated liveness check used by the UI on boot
 * @route   GET /api/auth/me
 * @access  Private
 */
module.exports = { register, login, getMe, updateUserRole, updateApplicability };

