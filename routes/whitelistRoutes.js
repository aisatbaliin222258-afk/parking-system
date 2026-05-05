const express = require("express");
const router = express.Router();
const Whitelist = require("../models/Whitelist");

/**
 * POST /api/whitelist
 * Add vehicle to whitelist
 */
router.post("/", async (req, res) => {
  try {
    const {
      license_plate,
      vehicle,
      contact,
      authorization,
      access_level,
      allowed_zones,
      notes,
      tags,
    } = req.body;

    // Validate required fields
    if (!license_plate) {
      return res.status(400).json({ error: "license_plate required" });
    }

    // Check if already exists
    const existing = await Whitelist.findOne({
      license_plate: license_plate.toUpperCase(),
    });

    if (existing) {
      return res.status(409).json({ error: "License plate already whitelisted" });
    }

    const whitelist = new Whitelist({
      license_plate: license_plate.toUpperCase(),
      vehicle: {
        owner_name: vehicle?.owner_name || "Unknown",
        vehicle_type: vehicle?.vehicle_type || "car",
        color: vehicle?.color,
        make: vehicle?.make,
        model: vehicle?.model,
        year: vehicle?.year,
      },
      contact: contact || {},
      authorization: {
        authorized_by: authorization?.authorized_by || "admin",
        authorized_date: new Date(),
        expiry_date: authorization?.expiry_date,
        is_active: true,
        reason: authorization?.reason,
      },
      access_level: access_level || "general",
      allowed_zones: allowed_zones || [],
      notes,
      tags: tags || [],
      status: "active",
    });

    const saved = await whitelist.save();

    res.status(201).json({
      success: true,
      id: saved._id,
      license_plate: saved.license_plate,
      message: "Vehicle added to whitelist",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/whitelist
 * Get all whitelisted vehicles
 */
router.get("/", async (req, res) => {
  try {
    const { limit = 100, skip = 0, status = "active", search } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { license_plate: { $regex: search, $options: "i" } },
        { "vehicle.owner_name": { $regex: search, $options: "i" } },
      ];
    }

    const whitelist = await Whitelist.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Whitelist.countDocuments(query);

    res.json({
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
      results: whitelist,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/whitelist/:license_plate
 * Get whitelist entry by license plate
 */
router.get("/:license_plate", async (req, res) => {
  try {
    const entry = await Whitelist.findOne({
      license_plate: req.params.license_plate.toUpperCase(),
    });

    if (!entry) {
      return res.status(404).json({ error: "License plate not found in whitelist" });
    }

    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/whitelist/:id
 * Update whitelist entry
 */
router.put("/:id", async (req, res) => {
  try {
    const { vehicle, contact, authorization, access_level, notes, status, tags } =
      req.body;

    const entry = await Whitelist.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({ error: "Whitelist entry not found" });
    }

    // Update fields
    if (vehicle) Object.assign(entry.vehicle, vehicle);
    if (contact) Object.assign(entry.contact, contact);
    if (authorization) Object.assign(entry.authorization, authorization);
    if (access_level) entry.access_level = access_level;
    if (notes) entry.notes = notes;
    if (status) entry.status = status;
    if (tags) entry.tags = tags;

    const updated = await entry.save();

    res.json({
      success: true,
      id: updated._id,
      message: "Whitelist entry updated",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/whitelist/:license_plate
 * Remove from whitelist (soft delete)
 */
router.delete("/:license_plate", async (req, res) => {
  try {
    const result = await Whitelist.updateOne(
      { license_plate: req.params.license_plate.toUpperCase() },
      { $set: { status: "inactive" } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "License plate not found" });
    }

    res.json({ success: true, message: "Removed from whitelist" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/whitelist/bulk-import
 * Bulk import whitelist entries
 */
router.post("/bulk-import", async (req, res) => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: "entries array required" });
    }

    const results = [];

    for (const entry of entries) {
      try {
        const whitelist = new Whitelist({
          license_plate: entry.license_plate.toUpperCase(),
          vehicle: entry.vehicle || {},
          contact: entry.contact || {},
          authorization: {
            authorized_by: entry.authorized_by || "bulk_import",
            is_active: true,
            reason: entry.reason,
          },
          status: "active",
        });

        const saved = await whitelist.save();
        results.push({ success: true, plate: saved.license_plate });
      } catch (err) {
        results.push({ success: false, plate: entry.license_plate, error: err.message });
      }
    }

    const successful = results.filter((r) => r.success).length;

    res.json({
      imported: entries.length,
      successful,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
