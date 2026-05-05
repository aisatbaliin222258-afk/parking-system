const mongoose = require("mongoose");

const cameraSchema = new mongoose.Schema(
  {
    // Camera identification
    camera_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    camera_name: {
      type: String,
      required: true,
      trim: true,
    },

    // Connection details
    connection: {
      protocol: {
        type: String,
        enum: ["rtsp", "rtmp", "http", "https", "mjpeg"],
        default: "rtsp",
      },
      host: {
        type: String,
        required: true,
      },
      port: Number,
      username: String,
      password: String, // TODO: Encrypt in production
      stream_path: String,
      stream_url: String,
    },

    // Camera location
    location: {
      zone: String,
      area: String,
      latitude: Number,
      longitude: Number,
      description: String,
    },

    // Hardware specifications
    specs: {
      make: String,
      model: String,
      resolution: {
        width: Number,
        height: Number,
      },
      fps: Number,
      lens_type: String,
      field_of_view: String,
    },

    // AI Detection settings
    detection_settings: {
      enabled: {
        type: Boolean,
        default: true,
      },
      yolo_confidence: {
        type: Number,
        default: 0.5,
        min: 0,
        max: 1,
      },
      detect_objects: {
        enabled: Boolean,
        types: [String], // ["person", "car", "truck", etc]
      },
      detect_motion: {
        enabled: Boolean,
        sensitivity: {
          type: Number,
          default: 0.1,
          min: 0,
          max: 1,
        },
      },
      extract_license_plates: {
        enabled: Boolean,
        min_vehicle_confidence: Number,
      },
      alert_on_detection: {
        enabled: Boolean,
        types: [String], // ["unknown_vehicle", "blocked_vehicle", etc]
      },
    },

    // Processing configuration
    processing: {
      frame_rate: {
        type: Number,
        default: 1,
        min: 0.1,
        max: 30,
      },
      frame_interval: {
        type: Number,
        default: 1,
        min: 1,
      },
      resize_frames: {
        enabled: Boolean,
        max_width: Number,
        max_height: Number,
      },
      batch_processing: {
        enabled: Boolean,
        batch_size: Number,
      },
    },

    // Storage and archival
    storage: {
      store_frames: Boolean,
      store_detections: Boolean,
      retention_days: Number,
      compression: {
        type: String,
        enum: ["none", "low", "medium", "high"],
        default: "medium",
      },
    },

    // Status and health monitoring
    status: {
      type: String,
      enum: ["online", "offline", "degraded", "error"],
      default: "offline",
      index: true,
    },

    health: {
      last_frame_time: Date,
      frame_count: {
        type: Number,
        default: 0,
      },
      error_count: {
        type: Number,
        default: 0,
      },
      last_error: String,
      last_error_time: Date,
      connection_attempts: Number,
      successful_connections: Number,
      uptime_percentage: Number,
    },

    // Alerting
    alerts: {
      enabled: Boolean,
      on_offline: Boolean,
      on_error: Boolean,
      on_degraded: Boolean,
      recipients: [String],
    },

    // Scheduling
    schedule: {
      always_on: {
        type: Boolean,
        default: true,
      },
      active_from: Date,
      active_until: Date,
      time_windows: [
        {
          name: String,
          start_time: String, // HH:MM
          end_time: String,
          days: [Number], // 0-6
        },
      ],
    },

    // Access control
    access: {
      owner: String,
      authorized_users: [String],
      is_public: {
        type: Boolean,
        default: false,
      },
    },

    // Metadata
    installed_date: Date,
    maintenance: {
      last_cleaned: Date,
      last_serviced: Date,
      next_maintenance: Date,
      notes: String,
    },

    // Performance metrics
    metrics: {
      avg_detection_time_ms: Number,
      detection_success_rate: Number,
      uptime_today: Number,
      frames_processed_today: Number,
      alerts_triggered_today: Number,
    },

    notes: String,
    tags: [String],

    // Status tracking
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "cameras",
  }
);

// Indexes
cameraSchema.index({ camera_id: 1 });
cameraSchema.index({ status: 1 });
cameraSchema.index({ "location.zone": 1 });
cameraSchema.index({ is_active: 1 });
cameraSchema.index({ "health.last_frame_time": -1 });

module.exports = mongoose.model("Camera", cameraSchema);
