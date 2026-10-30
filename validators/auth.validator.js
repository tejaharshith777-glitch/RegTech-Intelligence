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
}).strict();

/**
 * Zod schema for PATCH /api/auth/users/:id/role
 */
const updateRoleSchema = z.object({
  role: z.enum(['researcher', 'admin'], {
    error: "Role must be 'researcher' or 'admin'.",
  }),
}).strict();

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
  // `reason` is the field the existing UI sends; `note` is the newer name.
  reason: z.string().max(1000).optional(),
  note: z.string().max(1000).optional(),
});

/**
 * Zod schema for PATCH /api/auth/users/:id/role
 */
const applicabilitySchema = z.object({
  jurisdiction: z.string().max(80).optional().default(''),
  entityTypes: z.array(z.string().max(60)).max(20).optional().default([]),
  businessLines: z.array(z.string().max(60)).max(20).optional().default([]),
});

/**
 * Zod schema for POST /api/research/insights/:id/clarify
 */
const clarifyInsightSchema = z.object({
  question: z
    .string({ error: 'A question is required.' })
    .min(5, 'A clarification question must be at least 5 characters.')
    .max(1000, 'A clarification question cannot exceed 1000 characters.'),
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
  updateRoleSchema,
  applicabilitySchema,
  clarifyInsightSchema,
  validate,
};
