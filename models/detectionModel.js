const mongoose = require("mongoose");

const detectionSchema = new mongoose.Schema(
  {
    // Camera and source info
    camera_id: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["rtsp", "rtmp", "http", "file", "base64"],
      default: "rtsp",
    },
    frame_id: {
      type: Number,
      default: 0,
    },

    // Python backend detection results
    timestamp_utc: {
      type: Date,
      required: true,
      index: true,
    },

    // Objects detected
    detections: {
      total_objects: {
        type: Number,
        default: 0,
      },
      high_confidence_objects: {
        type: Number,
        default: 0,
      },
      humans: {
        type: Number,
        default: 0,
      },
      vehicles: {
        type: Number,
        default: 0,
      },
      objects: [
        {
          class: String,
          class_id: Number,
          confidence: Number,
          bbox: {
            x1: Number,
            y1: Number,
            x2: Number,
            y2: Number,
            width: Number,
            height: Number,
          },
          center: {
            x: Number,
            y: Number,
          },
          license_plate: String,
        },
      ],
    },

    // Motion analysis
    motion: {
      detected: {
        type: Boolean,
        default: false,
      },
      score: {
        type: Number,
        min: 0,
        max: 1,
        default: 0,
      },
      percentage: Number,
      changed_pixels: Number,
    },

    // Vehicle details with alert status
    vehicles: [
      {
        class: String,
        confidence: Number,
        bbox: {
          x1: Number,
          y1: Number,
          x2: Number,
          y2: Number,
        },
        license_plate: String,
        alert_status: {
          type: String,
          enum: ["unknown", "blocked", "authorized", "plate_not_found"],
          index: true,
        },
        alert_message: String,
      },
    ],

    // Alerts generated
    alerts: [
      {
        type: {
          type: String,
          enum: [
            "blocked_vehicle",
            "unknown_vehicle",
            "unidentified_vehicle",
            "motion_detected",
          ],
          index: true,
        },
        severity: {
          type: String,
          enum: ["high", "medium", "low"],
          index: true,
        },
        message: String,
        license_plate: String,
        confidence: Number,
        action_taken: {
          type: String,
          enum: ["none", "notification", "alarm", "call"],
          default: "none",
        },
      },
    ],

    // Alert summary
    alert_triggered: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Image metadata
    image_size: {
      width: Number,
      height: Number,
    },
    image_base64: {
      type: String,
      default: null,
    },

    // Processing metadata
    processing_time_ms: Number,
    python_backend_success: {
      type: Boolean,
      default: true,
    },

    // Audit trail
    processed_by: {
      type: String,
      default: "python_backend",
    },
    status: {
      type: String,
      enum: ["pending", "processed", "archived"],
      default: "processed",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "detections",
  }
);

// Indexes for fast queries
detectionSchema.index({ camera_id: 1, createdAt: -1 });
detectionSchema.index({ "alerts.severity": 1 });
detectionSchema.index({ "vehicles.license_plate": 1 });
detectionSchema.index({ alert_triggered: 1, createdAt: -1 });
detectionSchema.index({ timestamp_utc: -1 });

module.exports = mongoose.model("Detection", detectionSchema);
