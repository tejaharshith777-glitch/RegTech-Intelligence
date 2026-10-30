'use strict';

const multer = require('multer');

const MAX_FILE_SIZE_MB = 15;
const ALLOWED_MIME_TYPES = ['application/pdf'];

/**
 * Multer instance configured for in-memory PDF uploads.
 * Files are stored as Buffer in req.file.buffer — never written to disk.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, // 15 MB in bytes
    files: 1, // Only allow a single file per request
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error(
        `Invalid file type: "${file.mimetype}". Only PDF files are accepted.`
      );
      error.statusCode = 415;
      cb(error, false);
    }
  },
});

module.exports = upload;
