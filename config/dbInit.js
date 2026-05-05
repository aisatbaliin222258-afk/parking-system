/**
 * MongoDB Database Initialization & Index Creation
 * Creates all necessary collections and indexes for CCTV detection system
 */

const mongoose = require("mongoose");

// Import all models
const Detection = require("../models/detectionModel");
const Whitelist = require("../models/Whitelist");
const Blacklist = require("../models/Blacklist");
const AlertRule = require("../models/AlertRule");
const Camera = require("../models/Camera");
const Vehicle = require("../models/vehicle");
const Event = require("../models/event");
const User = require("../models/User");

/**
 * Initialize database - create collections and indexes
 */
async function initializeDatabase() {
  try {
    console.log("\n=== Starting Database Initialization ===\n");

    // Create collections and indexes for each model
    const models = [
      { name: "Detection", model: Detection },
      { name: "Whitelist", model: Whitelist },
      { name: "Blacklist", model: Blacklist },
      { name: "AlertRule", model: AlertRule },
      { name: "Camera", model: Camera },
      { name: "Vehicle", model: Vehicle },
      { name: "Event", model: Event },
      { name: "User", model: User },
    ];

    for (const { name, model } of models) {
      try {
        // Create indexes for the model
        await model.collection.createIndexes();
        console.log(`✓ ${name} - indexes created successfully`);
      } catch (error) {
        console.warn(`⚠ ${name} - ${error.message}`);
      }
    }

    // Create additional specific indexes if needed
    await createCustomIndexes();

    console.log("\n=== Database Initialization Complete ===\n");
    return true;
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}

/**
 * Create custom indexes for optimized queries
 */
async function createCustomIndexes() {
  try {
    // Detection collection - compound indexes for common queries
    await Detection.collection.createIndex(
      { camera_id: 1, timestamp_utc: -1 },
      { name: "camera_time_index" }
    );

    await Detection.collection.createIndex(
      { alert_triggered: 1, createdAt: -1 },
      { name: "alerts_recent_index" }
    );

    await Detection.collection.createIndex(
      { "vehicles.license_plate": 1, timestamp_utc: -1 },
      { name: "plate_time_index" }
    );

    // Whitelist - check active and authorized
    await Whitelist.collection.createIndex(
      { status: 1, "authorization.is_active": 1 },
      { name: "whitelist_active_index" }
    );

    // Blacklist - for rapid lookup on detection
    await Blacklist.collection.createIndex(
      { status: 1, alert_level: 1 },
      { name: "blacklist_alert_index" }
    );

    // AlertRule - active rules prioritized
    await AlertRule.collection.createIndex(
      { is_active: 1, priority: -1 },
      { name: "active_rules_priority_index" }
    );

    // Camera - quick status check
    await Camera.collection.createIndex(
      { status: 1, "health.last_frame_time": -1 },
      { name: "camera_status_health_index" }
    );

    // TTL Index for automatic deletion of old detections (optional - 90 days)
    await Detection.collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 7776000, name: "ttl_index" } // 90 days
    );

    console.log("✓ Custom indexes created successfully");
  } catch (error) {
    console.warn("⚠ Custom indexes - " + error.message);
  }
}

/**
 * Create default alert rules if they don't exist
 */
async function createDefaultAlertRules() {
  try {
    const defaultRules = [
      {
        rule_name: "Blocked Vehicle Alert",
        description: "Alert when a blocked vehicle is detected",
        rule_category: "vehicle_based",
        triggers: {
          detection_type: {
            enabled: true,
            values: ["blocked_vehicle"],
          },
        },
        actions: {
          notifications: { enabled: true },
          alarm: { enabled: true, type: "siren", duration_seconds: 10 },
          logging: { enabled: true, log_level: "critical" },
        },
        priority: 10,
        is_active: true,
        created_by: "system",
      },
      {
        rule_name: "Unknown Vehicle",
        description: "Alert on unknown/unauthorized vehicle",
        rule_category: "vehicle_based",
        triggers: {
          detection_type: {
            enabled: true,
            values: ["unknown_vehicle"],
          },
        },
        actions: {
          notifications: { enabled: true },
          logging: { enabled: true, log_level: "warning" },
        },
        priority: 7,
        is_active: true,
        created_by: "system",
      },
      {
        rule_name: "High Motion Detection",
        description: "Alert on significant motion in monitored zones",
        rule_category: "detection_based",
        triggers: {
          motion_detected: {
            enabled: true,
            min_score: 0.7,
          },
        },
        actions: {
          logging: { enabled: true, log_level: "info" },
        },
        priority: 5,
        is_active: true,
        created_by: "system",
      },
    ];

    for (const rule of defaultRules) {
      const exists = await AlertRule.findOne({ rule_name: rule.rule_name });
      if (!exists) {
        await AlertRule.create(rule);
        console.log(`✓ Default rule created: ${rule.rule_name}`);
      }
    }
  } catch (error) {
    console.warn("⚠ Default rules - " + error.message);
  }
}

/**
 * Verify database connection
 */
async function verifyConnection() {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`✓ Connected to MongoDB - ${collections.length} collections found`);
    return true;
  } catch (error) {
    console.error("⚠ Database connection verification failed:", error.message);
    return false;
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  try {
    const stats = {
      detection_count: await Detection.countDocuments(),
      whitelist_count: await Whitelist.countDocuments(),
      blacklist_count: await Blacklist.countDocuments(),
      alert_rules: await AlertRule.countDocuments(),
      cameras: await Camera.countDocuments(),
      alerts_today: await Detection.countDocuments({
        alert_triggered: true,
        createdAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      }),
    };

    return stats;
  } catch (error) {
    console.error("Error getting database stats:", error);
    return null;
  }
}

/**
 * Drop all collections (WARNING - for testing only)
 */
async function dropAllCollections() {
  try {
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    for (const collection of collections) {
      await mongoose.connection.db.dropCollection(collection.name);
      console.log(`✓ Dropped collection: ${collection.name}`);
    }

    console.log("✓ All collections dropped");
    return true;
  } catch (error) {
    console.error("Error dropping collections:", error);
    return false;
  }
}

module.exports = {
  initializeDatabase,
  createCustomIndexes,
  createDefaultAlertRules,
  verifyConnection,
  getDatabaseStats,
  dropAllCollections,
};
