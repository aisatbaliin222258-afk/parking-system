const express = require("express");
const router = express.Router();
const Blacklist = require("../models/Blacklist");

/**
 * POST /api/blacklist
 * Add license plate to blacklist
 */
router.post("/", async (req, res) => {
  try {
    const { license_plate, reason, reason_details, alert_level, actions } = req.body;

    if (!license_plate || !reason) {
      return res.status(400).json({ error: "license_plate and reason required" });
    }

    const existing = await Blacklist.findOne({ license_plate: license_plate.toUpperCase() });
    if (existing) {
      return res.status(409).json({ error: "License plate already blacklisted" });
    }

    const entry = new Blacklist({
      license_plate: license_plate.toUpperCase(),
      reason,
      reason_details,
      alert_level: alert_level || "high",
      actions: actions || {},
      status: "active",
    });

    const saved = await entry.save();

    res.status(201).json({ success: true, id: saved._id, license_plate: saved.license_plate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/blacklist
 * List blacklist entries
 */
router.get("/", async (req, res) => {
  try {
    const { limit = 100, skip = 0, status = "active", search } = req.query;

    let query = {};
    if (status) query.status = status;
    if (search) query.$or = [
      { license_plate: { $regex: search, $options: "i" } },
      { reason_details: { $regex: search, $options: "i" } }
    ];

    const list = await Blacklist.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Blacklist.countDocuments(query);

    res.json({ total, limit: parseInt(limit), skip: parseInt(skip), results: list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/blacklist/:license_plate
 * Get entry by plate
 */
router.get("/:license_plate", async (req, res) => {
  try {
    const entry = await Blacklist.findOne({ license_plate: req.params.license_plate.toUpperCase() });
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/blacklist/:id
 * Update blacklist entry
 */
router.put("/:id", async (req, res) => {
  try {
    const entry = await Blacklist.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Not found" });

    Object.assign(entry, req.body);
    const updated = await entry.save();
    res.json({ success: true, id: updated._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/blacklist/:license_plate
 * Soft remove from blacklist
 */
router.delete("/:license_plate", async (req, res) => {
  try {
    const result = await Blacklist.updateOne(
      { license_plate: req.params.license_plate.toUpperCase() },
      { $set: { status: "removed" } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, message: "Blacklist entry removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
