const mongoose = require('mongoose');
const config = require('../config');

const checkSchema = new mongoose.Schema(
  {
    monitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Monitor',
      required: true,
      index: true,
    },
    ts: {
      type: Date,
      default: Date.now,
      required: true,
    },
    ok: {
      type: Boolean,
      required: true,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    responseMs: {
      type: Number,
      required: true,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    versionKey: false,
  }
);

// Indexes required by spec
checkSchema.index({ monitorId: 1, ts: -1 });
checkSchema.index({ ts: 1 }, { expireAfterSeconds: config.CHECK_RETENTION_DAYS * 86400 });

const Check = mongoose.model('Check', checkSchema);

module.exports = Check;
