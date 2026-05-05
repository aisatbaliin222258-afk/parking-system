const mongoose = require("mongoose");

const blacklistSchema = new mongoose.Schema(
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

    // Reason for blacklisting
    reason: {
      type: String,
      enum: [
        "stolen_vehicle",
        "expired_registration",
        "unpaid_parking",
        "traffic_violation",
        "security_threat",
        "suspicious_activity",
        "custom_rule",
        "other",
      ],
      required: true,
    },

    // Custom reason text
    reason_details: String,

    // Alert configuration
    alert_level: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      default: "high",
      index: true,
    },

    // Actions to take when detected
    actions: {
      send_notification: {
        type: Boolean,
        default: true,
      },
      trigger_alarm: {
        type: Boolean,
        default: true,
      },
      call_security: {
        type: Boolean,
        default: false,
      },
      log_detection: {
        type: Boolean,
        default: true,
      },
      block_entry: {
        type: Boolean,
        default: false,
      },
      additional_actions: [String],
    },

    // Vehicle information (for context)
    vehicle_info: {
      make: String,
      model: String,
      color: String,
      last_known_owner: String,
    },

    // Blacklist administration
    blacklist_admin: {
      added_by: {
        type: String,
        required: true,
      },
      added_date: {
        type: Date,
        default: Date.now,
      },
      reason_for_addition: String,
      approved_by: String,
      approval_date: Date,
    },

    // Removal information
    removal: {
      can_be_removed: {
        type: Boolean,
        default: false,
      },
      removal_date: Date,
      removed_by: String,
      removal_reason: String,
    },

    // Detection history
    detection_count: {
      type: Number,
      default: 0,
      index: true,
    },
    last_detected: Date,
    detections: [
      {
        detection_id: mongoose.Schema.Types.ObjectId,
        camera_id: String,
        timestamp: Date,
        alert_sent: Boolean,
      },
    ],

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "removed"],
      default: "active",
      index: true,
    },

    // Expiry
    expiry_date: Date,
    is_permanent: {
      type: Boolean,
      default: true,
    },

    // Additional fields
    severity_notes: String,
    tags: [String],
    references: [String], // Links to incident reports, tickets, etc
  },
  {
    timestamps: true,
    collection: "blacklist",
  }
);

// Indexes
blacklistSchema.index({ license_plate: 1 });
blacklistSchema.index({ status: 1 });
blacklistSchema.index({ alert_level: 1 });
blacklistSchema.index({ last_detected: -1 });
blacklistSchema.index({ expiry_date: 1 });
blacklistSchema.index({ detection_count: -1 });

module.exports = mongoose.model("Blacklist", blacklistSchema);
