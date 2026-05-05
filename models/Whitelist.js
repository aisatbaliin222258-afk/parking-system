const mongoose = require("mongoose");

const whitelistSchema = new mongoose.Schema(
  {
    // License plate
    license_plate: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // Vehicle information
    vehicle: {
      owner_name: {
        type: String,
        required: true,
        trim: true,
      },
      vehicle_type: {
        type: String,
        enum: ["car", "truck", "bus", "motorcycle", "bicycle", "other"],
        default: "car",
      },
      color: String,
      make: String,
      model: String,
      year: Number,
    },

    // Contact information
    contact: {
      phone: String,
      email: String,
      address: String,
    },

    // Authorization details
    authorization: {
      authorized_by: {
        type: String,
        required: true,
      },
      authorized_date: {
        type: Date,
        default: Date.now,
      },
      expiry_date: Date,
      is_active: {
        type: Boolean,
        default: true,
        index: true,
      },
      reason: String,
    },

    // Access control
    access_level: {
      type: String,
      enum: ["employee", "visitor", "contractor", "vip", "general"],
      default: "general",
    },
    allowed_zones: [
      {
        type: String,
      },
    ],
    allowed_hours: {
      enabled: {
        type: Boolean,
        default: false,
      },
      start_time: String, // HH:MM format
      end_time: String,
      days_of_week: [Number], // 0-6 (Sun-Sat)
    },

    // Additional notes
    notes: String,
    tags: [String],

    // Detection history (read-only, populated from detections)
    last_detected: Date,
    detection_count: {
      type: Number,
      default: 0,
    },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "expired"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "whitelist",
  }
);

// Indexes for fast queries
whitelistSchema.index({ license_plate: 1 });
whitelistSchema.index({ "authorization.is_active": 1 });
whitelistSchema.index({ status: 1 });
whitelistSchema.index({ "authorization.expiry_date": 1 });
whitelistSchema.index({ last_detected: -1 });

module.exports = mongoose.model("Whitelist", whitelistSchema);
