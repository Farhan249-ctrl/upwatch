const mongoose = require('mongoose');

const monitorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    intervalSeconds: {
      type: Number,
      required: true,
      enum: [15, 30, 60, 300],
    },
    timeoutMs: {
      type: Number,
      default: 10000,
      min: 100,
      max: 30000,
    },
    expectedStatus: {
      type: [Number],
      default: [],
    },
    allowSelfSigned: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    state: {
      type: String,
      enum: ['UNKNOWN', 'UP', 'DOWN'],
      default: 'UNKNOWN',
    },
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
    firstFailureAt: {
      type: Date,
      default: null,
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    nextCheckAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

// Compound index for active due monitors
monitorSchema.index({ active: 1, nextCheckAt: 1 });

const Monitor = mongoose.model('Monitor', monitorSchema);

module.exports = Monitor;
