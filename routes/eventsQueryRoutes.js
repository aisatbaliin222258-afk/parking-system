const express = require("express");
const router = express.Router();
const Detection = require("../models/detectionModel");

/**
 * GET /api/events/query
 * Query detections with filters: camera_id, from, to, plate, alert_type, severity
 */
router.get("/", async (req, res) => {
  try {
    const {
      camera_id,
      plate,
      alert_type,
      severity,
      from,
      to,
      limit = 50,
      skip = 0,
      sort = "-createdAt",
    } = req.query;

    const query = {};

    if (camera_id) query.camera_id = camera_id;
    if (plate) query["vehicles.license_plate"] = plate.toUpperCase();
    if (alert_type) query["alerts.type"] = alert_type;
    if (severity) query["alerts.severity"] = severity;

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    // Build sort
    const sortObj = {};
    if (sort.startsWith("-")) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const results = await Detection.find(query)
      .sort(sortObj)
      .skip(parseInt(skip))
      .limit(Math.min(1000, parseInt(limit)));

    const total = await Detection.countDocuments(query);

    res.json({ total, limit: parseInt(limit), skip: parseInt(skip), results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
