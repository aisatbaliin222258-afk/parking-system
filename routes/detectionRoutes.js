const express = require("express");
const router = express.Router();
const axios = require("axios");
const Detection = require("../models/detectionModel");
const Whitelist = require("../models/Whitelist");
const Blacklist = require("../models/Blacklist");
const Camera = require("../models/Camera");
const { getDatabaseStats } = require("../config/dbInit");

// Python backend URL
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

/**
 * POST /api/detection/process
 * Receive detection from Python backend and store in MongoDB
 */
// Shared process handler for POST /process and POST /
async function handleProcess(req, res) {
  try {
    const { camera_id, image_base64 } = req.body;

    if (!camera_id) {
      return res.status(400).json({ error: "camera_id required" });
    }

    // Verify camera exists and is active
    const camera = await Camera.findOne({ camera_id, is_active: true });
    if (!camera) {
      return res
        .status(404)
        .json({ error: `Camera ${camera_id} not found or inactive` });
    }

    // Call Python backend for detection
    console.log(`Processing detection for camera: ${camera_id}`);

    const pythonResponse = await axios.post(
      `${PYTHON_API_URL}/detect-frame`,
      {
        image_base64: image_base64 || "",
        include_visualization: false,
        resize: true,
      },
      { timeout: 30000 }
    );

    const pythonData = pythonResponse.data;

    // Create detection document
    const detection = new Detection({
      camera_id,
      source: "api",
      frame_id: camera.health?.frame_count || 0,
      timestamp_utc: new Date(pythonData.timestamp),
      detections: pythonData.detections,
      motion: pythonData.motion,
      vehicles: pythonData.vehicles,
      alerts: pythonData.alerts,
      alert_triggered: pythonData.alert_triggered,
      image_size: pythonData.image_size,
      python_backend_success: pythonData.success,
      processed_by: "python_backend",
    });

    // Save to database
    const saved = await detection.save();

    // Update camera's last frame time
    await Camera.updateOne(
      { camera_id },
      {
        $set: {
          "health.last_frame_time": new Date(),
          "status": "online",
        },
        $inc: { "health.frame_count": 1 },
      }
    );

    // Check vehicles against whitelist/blacklist
    const enrichedVehicles = await enrichVehicleAlerts(pythonData.vehicles);

    // Enrich vehicles (and optionally save enriched vehicles back)
    const enriched = enrichedVehicles;

    // Emit alert if triggered via Socket.io
    try {
      const socketModule = require("../socket");
      const io = socketModule.getIO();
      if (io && pythonData.alert_triggered) {
        console.log(`EMIT ALERT: ${pythonData.alerts.length} alerts for camera ${camera_id}`);
        // Emit to specific camera room
        io.to(camera_id).emit("alert", {
          camera_id,
          alerts: pythonData.alerts,
          vehicles: enriched,
          detection_id: saved._id,
          timestamp: saved.createdAt,
        });
        // Emit global alert as well
        io.emit("alert_global", {
          camera_id,
          alerts: pythonData.alerts,
          vehicles: enriched,
          detection_id: saved._id,
          timestamp: saved.createdAt,
        });
      }
    } catch (emitErr) {
      console.warn("Socket emit failed:", emitErr.message);
    }

    res.json({
      success: true,
      detection_id: saved._id,
      camera_id,
      alert_triggered: pythonData.alert_triggered,
      alerts_count: pythonData.alerts?.length || 0,
      vehicles_found: pythonData.vehicles?.length || 0,
      timestamp: saved.createdAt,
    });
  } catch (error) {
    console.error("Detection process error:", error.message);

    // Update camera error status
    if (req.body.camera_id) {
      await Camera.updateOne(
        { camera_id: req.body.camera_id },
        {
          $set: {
            status: "error",
            "health.last_error": error.message,
            "health.last_error_time": new Date(),
          },
          $inc: { "health.error_count": 1 },
        }
      );
    }

    res.status(500).json({
      error: error.message || "Detection processing failed",
      python_backend: error.code === "ECONNREFUSED" ? "unreachable" : "error",
    });
  }
}

// Attach authenticated routes
const { authenticateExpress } = require('../auth');
router.post('/', authenticateExpress, handleProcess);
router.post('/process', authenticateExpress, handleProcess);

/**
 * POST /api/detection/batch
 * Batch process multiple detections
 */
router.post("/batch", async (req, res) => {
  try {
    const { detections_list } = req.body;

    if (!Array.isArray(detections_list) || detections_list.length === 0) {
      return res.status(400).json({ error: "detections_list array required" });
    }

    const results = [];

    for (const detection of detections_list) {
      try {
        // Call Python backend
        const pythonResponse = await axios.post(
          `${PYTHON_API_URL}/detect-frame`,
          { image_base64: detection.image_base64 },
          { timeout: 30000 }
        );

        // Create and save detection
        const doc = new Detection({
          camera_id: detection.camera_id,
          source: "api_batch",
          timestamp_utc: new Date(),
          detections: pythonResponse.data.detections,
          motion: pythonResponse.data.motion,
          vehicles: pythonResponse.data.vehicles,
          alerts: pythonResponse.data.alerts,
          alert_triggered: pythonResponse.data.alert_triggered,
        });

        const saved = await doc.save();
        results.push({ success: true, detection_id: saved._id });
      } catch (err) {
        results.push({ success: false, error: err.message });
      }
    }

    res.json({
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/detection/:detection_id
 * Get detection by ID
 */
router.get("/:detection_id", async (req, res) => {
  try {
    const detection = await Detection.findById(req.params.detection_id);

    if (!detection) {
      return res.status(404).json({ error: "Detection not found" });
    }

    res.json(detection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/detection/camera/:camera_id
 * Get recent detections for a camera
 */
router.get("/camera/:camera_id", async (req, res) => {
  try {
    const { limit = 50, skip = 0, alert_only = false } = req.query;

    let query = { camera_id: req.params.camera_id };

    if (alert_only === "true") {
      query.alert_triggered = true;
    }

    const detections = await Detection.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Detection.countDocuments(query);

    res.json({
      camera_id: req.params.camera_id,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
      results: detections,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/detection/:detection_id
 * Delete a detection
 */
router.delete("/:detection_id", async (req, res) => {
  try {
    const result = await Detection.findByIdAndDelete(req.params.detection_id);

    if (!result) {
      return res.status(404).json({ error: "Detection not found" });
    }

    res.json({ success: true, deleted_id: result._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Enrich vehicle detection with whitelist/blacklist status
 */
async function enrichVehicleAlerts(vehicles) {
  if (!vehicles || vehicles.length === 0) return [];

  const enriched = [];

  for (const vehicle of vehicles) {
    const plate = vehicle.license_plate;

    let status = "unknown";
    let source = null;

    if (plate) {
      // Check whitelist
      const whitelisted = await Whitelist.findOne({
        license_plate: plate,
        status: "active",
      });

      if (whitelisted) {
        status = "authorized";
        source = "whitelist";
      } else {
        // Check blacklist
        const blacklisted = await Blacklist.findOne({
          license_plate: plate,
          status: "active",
        });

        if (blacklisted) {
          status = "blocked";
          source = "blacklist";
        }
      }
    }

    enriched.push({
      ...vehicle,
      alert_status: status,
      source,
    });
  }

  return enriched;
}

module.exports = router;
