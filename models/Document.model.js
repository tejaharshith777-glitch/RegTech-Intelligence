'use strict';

const mongoose = require('mongoose');

/**
 * @typedef {Object} IDocument
 * @property {string} filename        - Original name of the uploaded PDF
 * @property {mongoose.Types.ObjectId} uploadedBy - Reference to the User who uploaded
 * @property {Date} uploadDate        - Timestamp of the upload
 * @property {'pending'|'processed'|'failed'} status - Processing lifecycle status
 */
const documentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: [true, 'Filename is required.'],
      trim: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader reference is required.'],
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'processed', 'failed'],
        message: "Status must be 'pending', 'processed', or 'failed'.",
      },
      default: 'pending',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
documentSchema.index({ uploadedBy: 1, uploadDate: -1 });
documentSchema.index({ status: 1 });

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
