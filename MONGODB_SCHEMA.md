# MongoDB Schema Documentation

## Overview

Complete MongoDB schema for the CCTV AI Detection System. All collections are optimized for fast queries with appropriate indexes.

---

## Collections

### 1. Detections Collection

**Purpose**: Store AI detection results from Python backend

**Schema**:
```javascript
{
  _id: ObjectId,
  
  // Source info
  camera_id: String,                    // Indexed
  source: enum["rtsp", "rtmp", "http", "file", "base64"],
  frame_id: Number,
  timestamp_utc: Date,                  // Indexed
  
  // Python detection results
  detections: {
    total_objects: Number,
    high_confidence_objects: Number,
    humans: Number,
    vehicles: Number,
    objects: [{
      class: String,
      class_id: Number,
      confidence: Number (0-1),
      bbox: { x1, y1, x2, y2, width, height },
      center: { x, y },
      license_plate: String
    }]
  },
  
  // Motion data
  motion: {
    detected: Boolean,
    score: Number (0-1),
    percentage: Number,
    changed_pixels: Number
  },
  
  // Vehicles with alert status
  vehicles: [{
    class: String,
    confidence: Number,
    bbox: { x1, y1, x2, y2 },
    license_plate: String,
    alert_status: enum["unknown", "blocked", "authorized", "plate_not_found"],
    alert_message: String
  }],
  
  // Alerts generated
  alerts: [{
    type: enum["blocked_vehicle", "unknown_vehicle", "unidentified_vehicle", "motion_detected"],
    severity: enum["high", "medium", "low"],
    message: String,
    license_plate: String,
    confidence: Number,
    action_taken: enum["none", "notification", "alarm", "call"]
  }],
  
  alert_triggered: Boolean,              // Indexed
  
  // Image data
  image_size: { width, height },
  image_base64: String (base64 encoded),
  
  // Metadata
  processing_time_ms: Number,
  python_backend_success: Boolean,
  processed_by: String,
  status: enum["pending", "processed", "archived"],
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ camera_id: 1, createdAt: -1 }` - Fast camera history queries
- `{ "alerts.severity": 1 }` - Filter by alert severity
- `{ "vehicles.license_plate": 1 }` - License plate lookup
- `{ alert_triggered: 1, createdAt: -1 }` - Recent alerts
- `{ timestamp_utc: -1 }` - Time-based queries
- TTL Index: Auto-delete after 90 days

**Query Examples**:
```javascript
// Get recent alerts for a camera
db.detections.find({ 
  camera_id: "cam-1", 
  alert_triggered: true 
}).sort({ createdAt: -1 }).limit(10)

// Find vehicle detections
db.detections.find({ 
  "detections.objects.class": "car",
  "detections.objects.confidence": { $gte: 0.8 }
})

// License plate history
db.detections.find({ 
  "vehicles.license_plate": "ABC123" 
}).sort({ timestamp_utc: -1 })
```

---

### 2. Whitelist Collection

**Purpose**: Store authorized vehicles

**Schema**:
```javascript
{
  _id: ObjectId,
  
  // Plate info
  license_plate: String,                // Unique, Indexed
  
  // Vehicle details
  vehicle: {
    owner_name: String,
    vehicle_type: enum["car", "truck", "bus", "motorcycle", "bicycle", "other"],
    color: String,
    make: String,
    model: String,
    year: Number
  },
  
  // Contact info
  contact: {
    phone: String,
    email: String,
    address: String
  },
  
  // Authorization
  authorization: {
    authorized_by: String,
    authorized_date: Date,
    expiry_date: Date,
    is_active: Boolean,                // Indexed
    reason: String
  },
  
  // Access control
  access_level: enum["employee", "visitor", "contractor", "vip", "general"],
  allowed_zones: [String],
  allowed_hours: {
    enabled: Boolean,
    start_time: String (HH:MM),
    end_time: String,
    days_of_week: [Number]
  },
  
  // Detection history
  last_detected: Date,
  detection_count: Number,
  
  // Status
  status: enum["active", "inactive", "suspended", "expired"],  // Indexed
  
  // Metadata
  notes: String,
  tags: [String],
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ license_plate: 1 }` - Fast lookups
- `{ "authorization.is_active": 1 }` - Check validity
- `{ status: 1 }` - Filter by status
- `{ "authorization.expiry_date": 1 }` - Find expired entries
- `{ last_detected: -1 }` - Recently seen vehicles

---

### 3. Blacklist Collection

**Purpose**: Store blocked/suspicious vehicles

**Schema**:
```javascript
{
  _id: ObjectId,
  
  license_plate: String,                // Unique, Indexed
  reason: enum["stolen_vehicle", "expired_registration", "unpaid_parking", ...],
  reason_details: String,
  
  // Alert settings
  alert_level: enum["critical", "high", "medium", "low"],  // Indexed
  
  // Actions to take
  actions: {
    send_notification: Boolean,
    trigger_alarm: Boolean,
    call_security: Boolean,
    log_detection: Boolean,
    block_entry: Boolean,
    additional_actions: [String]
  },
  
  // Vehicle info
  vehicle_info: {
    make: String,
    model: String,
    color: String,
    last_known_owner: String
  },
  
  // Administration
  blacklist_admin: {
    added_by: String,
    added_date: Date,
    reason_for_addition: String,
    approved_by: String,
    approval_date: Date
  },
  
  // Removal info
  removal: {
    can_be_removed: Boolean,
    removal_date: Date,
    removed_by: String,
    removal_reason: String
  },
  
  // Detection history
  detection_count: Number,              // Indexed
  last_detected: Date,
  detections: [{
    detection_id: ObjectId,
    camera_id: String,
    timestamp: Date,
    alert_sent: Boolean
  }],
  
  // Status
  status: enum["active", "inactive", "removed"],  // Indexed
  expiry_date: Date,
  is_permanent: Boolean,
  
  // Additional
  severity_notes: String,
  tags: [String],
  references: [String],
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ license_plate: 1 }` - Fast lookup
- `{ status: 1 }` - Filter active
- `{ alert_level: 1 }` - Priority alerts
- `{ last_detected: -1 }` - Recent detections
- `{ detection_count: -1 }` - Most frequent

---

### 4. AlertRule Collection

**Purpose**: Define detection alert rules and actions

**Schema**:
```javascript
{
  _id: ObjectId,
  
  rule_name: String,                    // Unique
  description: String,
  rule_category: enum["detection_based", "vehicle_based", "time_based", "location_based", "custom"],
  
  // Trigger conditions
  triggers: {
    detection_type: {
      enabled: Boolean,
      values: [String]                  // e.g., ["blocked_vehicle", "unknown_vehicle"]
    },
    confidence_threshold: {
      enabled: Boolean,
      min_value: Number
    },
    motion_detected: {
      enabled: Boolean,
      min_score: Number
    },
    vehicle_type: {
      enabled: Boolean,
      values: [String]
    },
    time_window: {
      enabled: Boolean,
      start_time: String,
      end_time: String,
      days_of_week: [Number]
    },
    camera_zones: {
      enabled: Boolean,
      camera_ids: [String],
      zones: [String]
    },
    custom_condition: String             // JavaScript expression
  },
  
  // Actions
  actions: {
    notifications: {
      enabled: Boolean,
      email: Boolean,
      sms: Boolean,
      push: Boolean,
      recipients: [{ type: String, method: String }]
    },
    alarm: {
      enabled: Boolean,
      type: enum["beep", "siren", "voice", "none"],
      duration_seconds: Number
    },
    logging: {
      enabled: Boolean,
      log_level: enum["debug", "info", "warning", "error", "critical"]
    },
    webhook: {
      enabled: Boolean,
      url: String,
      method: enum["GET", "POST", "PUT"],
      headers: Object
    },
    external_actions: [{ service: String, config: Object }]
  },
  
  priority: Number (1-10),              // Indexed
  is_active: Boolean,                   // Indexed
  
  // Execution stats
  execution: {
    enabled_date: Date,
    disabled_date: Date,
    last_triggered: Date,
    trigger_count: Number
  },
  
  // Test mode
  is_test_rule: Boolean,
  test_mode: {
    enabled: Boolean,
    test_from_date: Date,
    test_to_date: Date
  },
  
  // Management
  created_by: String,
  last_modified_by: String,
  rule_version: Number,
  validation_status: enum["valid", "invalid", "needs_review"],
  validation_errors: [String],
  
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ rule_name: 1 }` - Lookup by name
- `{ is_active: 1, priority: -1 }` - Get active rules
- `{ rule_category: 1 }` - Filter by type
- `{ createdAt: -1 }` - Recent rules

---

### 5. Camera Collection

**Purpose**: Store camera configurations and health status

**Schema**:
```javascript
{
  _id: ObjectId,
  
  // Identification
  camera_id: String,                    // Unique, Indexed
  camera_name: String,
  
  // Connection
  connection: {
    protocol: enum["rtsp", "rtmp", "http", "https", "mjpeg"],
    host: String,
    port: Number,
    username: String,
    password: String,
    stream_path: String,
    stream_url: String
  },
  
  // Location
  location: {
    zone: String,
    area: String,
    latitude: Number,
    longitude: Number,
    description: String
  },
  
  // Hardware
  specs: {
    make: String,
    model: String,
    resolution: { width: Number, height: Number },
    fps: Number,
    lens_type: String,
    field_of_view: String
  },
  
  // Detection settings
  detection_settings: {
    enabled: Boolean,
    yolo_confidence: Number,
    detect_objects: { enabled: Boolean, types: [String] },
    detect_motion: { enabled: Boolean, sensitivity: Number },
    extract_license_plates: { enabled: Boolean },
    alert_on_detection: { enabled: Boolean, types: [String] }
  },
  
  // Processing
  processing: {
    frame_rate: Number,
    frame_interval: Number,
    resize_frames: { enabled: Boolean, max_width: Number, max_height: Number },
    batch_processing: { enabled: Boolean, batch_size: Number }
  },
  
  // Storage
  storage: {
    store_frames: Boolean,
    store_detections: Boolean,
    retention_days: Number,
    compression: enum["none", "low", "medium", "high"]
  },
  
  // Status & health
  status: enum["online", "offline", "degraded", "error"],  // Indexed
  health: {
    last_frame_time: Date,
    frame_count: Number,
    error_count: Number,
    last_error: String,
    last_error_time: Date,
    uptime_percentage: Number
  },
  
  // Scheduling
  schedule: {
    always_on: Boolean,
    active_from: Date,
    active_until: Date,
    time_windows: [{ name, start_time, end_time, days }]
  },
  
  // Maintenance
  installed_date: Date,
  maintenance: {
    last_cleaned: Date,
    last_serviced: Date,
    next_maintenance: Date,
    notes: String
  },
  
  is_active: Boolean,                   // Indexed
  tags: [String],
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ camera_id: 1 }` - Lookup by ID
- `{ status: 1 }` - Check online status
- `{ "location.zone": 1 }` - Cameras by zone
- `{ is_active: 1 }` - Active cameras

---

## Index Strategy

### Performance Optimization

1. **High-frequency queries**:
   - Detection by camera and time
   - License plate lookup
   - Active alert rules
   - Camera status checks

2. **Indexes created automatically** via Mongoose schemas

3. **TTL Index** on detections for auto-cleanup

4. **Compound indexes** for complex queries

---

## Data Relationships

```
Detection
├── camera_id → Camera
├── vehicles.license_plate → Whitelist or Blacklist
└── alerts → AlertRule (matched triggers)

Whitelist/Blacklist
├── license_plate (unique)
└── Detection (populated from vehicle detections)

Camera
├── camera_id (unique)
└── Detection (frames from this camera)

AlertRule
├── Triggered by Detection objects
└── Contains actions to execute
```

---

## Backup & Maintenance

### Regular Tasks

1. **Daily**: Monitor detection count
2. **Weekly**: Verify indexes are working
3. **Monthly**: Cleanup archived detections
4. **Quarterly**: Update alert rules
5. **Yearly**: Review and archive old data

### Backup Strategy

```bash
# Export collections
mongodump --uri="mongodb://localhost:27017/myDatabase" --out=./backup

# Import collections
mongorestore --uri="mongodb://localhost:27017/myDatabase" ./backup
```

---

## Query Examples

### Get recent detections with vehicles
```javascript
db.detections.find({
  "detections.vehicles": { $gt: 0 },
  createdAt: { $gte: new Date(Date.now() - 3600000) }  // Last hour
}).sort({ createdAt: -1 })
```

### Find alerts by severity
```javascript
db.detections.find({
  "alerts.severity": "high"
}).sort({ createdAt: -1 }).limit(20)
```

### Check whitelist status
```javascript
db.whitelist.find({
  status: "active",
  "authorization.is_active": true,
  "authorization.expiry_date": { $gt: new Date() }
})
```

### Get active alert rules
```javascript
db.alert_rules.find({
  is_active: true
}).sort({ priority: -1 })
```

---

## Size Estimates

| Collection | Typical Docs/Month | Document Size | Total Storage |
|------------|-------------------|---------------|---------------|
| Detections | 500,000 | 2KB | 1GB |
| Whitelist | 100 | 1KB | 100KB |
| Blacklist | 50 | 1.5KB | 75KB |
| AlertRules | 50 | 3KB | 150KB |
| Cameras | 20 | 5KB | 100KB |

---

**Total**: 1GB/month at scale

---

## See Also

- Backend Models: `/models/`
- Database Init: `/config/dbInit.js`
- Express Routes: `/routes/detectionRoutes.js`
