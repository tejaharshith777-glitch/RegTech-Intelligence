'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * @typedef {Object} IUser
 * @property {string} username
 * @property {string} email
 * @property {string} password  - bcrypt-hashed
 * @property {'researcher'|'admin'} role
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required.'],
      trim: true,
      minlength: [3, 'Username must be at least 3 characters.'],
      maxlength: [50, 'Username cannot exceed 50 characters.'],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address.'],
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [8, 'Password must be at least 8 characters.'],
      // Never return password in queries by default
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['researcher', 'admin'],
        message: "Role must be either 'researcher' or 'admin'.",
      },
      default: 'researcher',
    },
    // Declared regulatory scope. Used to triage every extracted obligation as
    // APPLIES / OUT_OF_SCOPE / UNCLEAR. Saved once at onboarding.
    applicability: {
      jurisdiction: { type: String, default: '' },
      entityTypes: { type: [String], default: [] },
      businessLines: { type: [String], default: [] },
      completedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
// email has unique: true which creates the index automatically

// ─── Pre-save Hook: Hash Password ────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  // Only hash if the password field has been modified
  if (!this.isModified('password')) return next();

  try {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    return next();
  } catch (error) {
    return next(error);
  }
});

// ─── Instance Method: Compare Password ───────────────────────────────────────
/**
 * Compares a plain-text password against the stored bcrypt hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Transform: Strip sensitive fields from JSON output ──────────────────────
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
module.exports = User;
