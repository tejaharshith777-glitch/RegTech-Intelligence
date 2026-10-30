'use strict';

/** Only an administrator may continue. Assumes protect() already ran. */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Administrator role required for this action.',
    });
  }
  return next();
};

module.exports = { requireAdmin };
