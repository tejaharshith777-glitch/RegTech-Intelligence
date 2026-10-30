'use strict';

const { z } = require('zod');

/**
 * Zod v4 schema for POST /api/auth/register
 */
const registerSchema = z.object({
  username: z
    .string({ error: 'Username must be a string.' })
    .min(3, 'Username must be at least 3 characters.')
    .max(50, 'Username cannot exceed 50 characters.')
    .trim(),

  email: z
    .string({ error: 'Email must be a string.' })
    .email('Please provide a valid email address.')
    .trim()
    .toLowerCase(),

  password: z
    .string({ error: 'Password must be a string.' })
    .min(8, 'Password must be at least 8 characters.')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit.'
    ),

  role: z
    .enum(['researcher', 'admin'], {
      error: "Role must be 'researcher' or 'admin'.",
    })
    .optional()
    .default('researcher'),
});

/**
 * Zod v4 schema for POST /api/auth/login
 */
const loginSchema = z.object({
  email: z
    .string({ error: 'Email must be a string.' })
    .email('Please provide a valid email address.')
    .trim()
    .toLowerCase(),

  password: z
    .string({ error: 'Password must be a string.' })
    .min(1, 'Password cannot be empty.'),
});

/**
 * Zod v4 schema for PUT /api/research/insights/:id/approve
 */
const approveInsightSchema = z.object({
  humanApprovalStatus: z.enum(['Approved', 'Rejected'], {
    error: "humanApprovalStatus must be 'Approved' or 'Rejected'.",
  }),
  reason: z.string().optional(),
});

/**
 * Middleware factory: validates req.body against a Zod schema.
 * Returns 422 with structured errors on failure.
 *
 * @param {import('zod').ZodSchema} schema
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    // Zod v4: errors are in result.error.issues
    const issues = result.error.issues || [];
    const errors = issues.map((e) => ({
      field: e.path.join('.') || 'body',
      message: e.message,
    }));

    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors,
    });
  }

  // Replace req.body with the parsed (coerced + stripped) data
  req.body = result.data;
  return next();
};

module.exports = {
  registerSchema,
  loginSchema,
  approveInsightSchema,
  validate,
};
