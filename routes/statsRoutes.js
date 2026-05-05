const express = require("express");
const router = express.Router();
const Detection = require("../models/detectionModel");

/**
 * GET /api/stats/summary
 * Returns quick dashboard stats
 */
router.get("/summary", async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    const totalDetections = await Detection.countDocuments();
    const recentDetections = await Detection.countDocuments({ createdAt: { $gte: since } });
    const alertsLast24h = await Detection.countDocuments({ alert_triggered: true, createdAt: { $gte: since } });

    // Top alert types
    const pipeline = [
      { $match: { alert_triggered: true, createdAt: { $gte: since } } },
      { $unwind: "$alerts" },
      { $group: { _id: "$alerts.type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ];
    const topAlerts = await Detection.aggregate(pipeline);

    res.json({
      totalDetections,
      recentDetections,
      alertsLast24h,
      topAlerts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stats/top-plates
 * Returns most frequently detected license plates
 */
router.get("/top-plates", async (req, res) => {
  try {
    const pipeline = [
      { $unwind: "$vehicles" },
      { $match: { "vehicles.license_plate": { $ne: null } } },
      { $group: { _id: "$vehicles.license_plate", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ];

    const topPlates = await Detection.aggregate(pipeline);
    res.json({ topPlates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
