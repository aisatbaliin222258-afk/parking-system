const mongoose = require("mongoose");

const alertRuleSchema = new mongoose.Schema(
  {
    // Rule identification
    rule_name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: String,
    rule_category: {
      type: String,
      enum: [
        "detection_based",
        "vehicle_based",
        "time_based",
        "location_based",
        "custom",
      ],
      default: "detection_based",
    },

    // Trigger conditions
    triggers: {
      // Detection-based triggers
      detection_type: {
        enabled: Boolean,
        values: [String], // e.g., ["blocked_vehicle", "unknown_vehicle"]
      },

      // Confidence threshold
      confidence_threshold: {
        enabled: Boolean,
        min_value: {
          type: Number,
          min: 0,
          max: 1,
        },
      },

      // Motion-based trigger
      motion_detected: {
        enabled: Boolean,
        min_score: {
          type: Number,
          min: 0,
          max: 1,
        },
      },

      // Vehicle classification
      vehicle_type: {
        enabled: Boolean,
        values: [String], // e.g., ["car", "truck", "motorcycle"]
      },

      // Time-based triggers
      time_window: {
        enabled: Boolean,
        start_time: String, // HH:MM
        end_time: String,
        days_of_week: [Number], // 0-6
      },

      // Location/Camera-based
      camera_zones: {
        enabled: Boolean,
        camera_ids: [String],
        zones: [String],
      },

      // Alert frequency (prevent spam)
      frequency: {
        enabled: Boolean,
        max_alerts_per_hour: Number,
        cooldown_minutes: Number,
      },

      // Custom JavaScript condition
      custom_condition: String,
    },

    // Actions to take when triggered
    actions: {
      notifications: {
        enabled: Boolean,
        email: Boolean,
        sms: Boolean,
        push: Boolean,
        recipients: [
          {
            type: String,
            method: String, // email, sms, push
          },
        ],
      },

      alarm: {
        enabled: Boolean,
        type: {
          type: String,
          enum: ["beep", "siren", "voice", "none"],
        },
        duration_seconds: Number,
      },

      logging: {
        enabled: Boolean,
        log_level: {
          type: String,
          enum: ["debug", "info", "warning", "error", "critical"],
        },
      },

      webhook: {
        enabled: Boolean,
        url: String,
        method: {
          type: String,
          enum: ["GET", "POST", "PUT"],
          default: "POST",
        },
        headers: mongoose.Schema.Types.Mixed,
      },

      database: {
        enabled: Boolean,
        store_image: Boolean,
        store_full_detection: Boolean,
      },

      external_actions: [
        {
          service: String, // "slack", "teams", "webhook", "api"
          config: mongoose.Schema.Types.Mixed,
        },
      ],
    },

    // Rule metadata
    priority: {
      type: Number,
      default: 5,
      min: 1,
      max: 10,
    },

    // Enable/disable rule
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Execution control
    execution: {
      enabled_date: Date,
      disabled_date: Date,
      last_triggered: Date,
      trigger_count: {
        type: Number,
        default: 0,
      },
    },

    // Creation and management
    created_by: String,
    last_modified_by: String,
    last_modified_date: Date,
    rule_version: {
      type: Number,
      default: 1,
    },

    // Testing and validation
    is_test_rule: {
      type: Boolean,
      default: false,
    },
    test_mode: {
      enabled: Boolean,
      test_from_date: Date,
      test_to_date: Date,
    },

    // Performance and limits
    performance: {
      avg_trigger_time_ms: Number,
      success_rate: Number,
      failure_count: Number,
      last_error: String,
    },

    // Status and validation
    validation_status: {
      type: String,
      enum: ["valid", "invalid", "needs_review"],
      default: "valid",
    },
    validation_errors: [String],

    notes: String,
    tags: [String],
  },
  {
    timestamps: true,
    collection: "alert_rules",
  }
);

// Indexes
alertRuleSchema.index({ rule_name: 1 });
alertRuleSchema.index({ is_active: 1 });
alertRuleSchema.index({ priority: -1 });
alertRuleSchema.index({ rule_category: 1 });
alertRuleSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AlertRule", alertRuleSchema);
