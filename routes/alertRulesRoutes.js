const express = require("express");
const router = express.Router();
const AlertRule = require("../models/AlertRule");

// Create rule
router.post("/rules", async (req, res) => {
  try {
    const payload = req.body;
    const existing = await AlertRule.findOne({ rule_name: payload.rule_name });
    if (existing) return res.status(409).json({ error: "Rule name exists" });

    const rule = new AlertRule(payload);
    const saved = await rule.save();
    res.status(201).json({ success: true, id: saved._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List rules
router.get("/rules", async (req, res) => {
  try {
    const { active = "true", limit = 100, skip = 0 } = req.query;
    const query = {};
    if (active === "true") query.is_active = true;

    const rules = await AlertRule.find(query).sort({ priority: -1 }).limit(parseInt(limit)).skip(parseInt(skip));
    const total = await AlertRule.countDocuments(query);
    res.json({ total, results: rules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get rule
router.get("/rules/:id", async (req, res) => {
  try {
    const rule = await AlertRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: "Not found" });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update rule
router.put("/rules/:id", async (req, res) => {
  try {
    const rule = await AlertRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: "Not found" });
    Object.assign(rule, req.body);
    const updated = await rule.save();
    res.json({ success: true, id: updated._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete rule
router.delete("/rules/:id", async (req, res) => {
  try {
    const removed = await AlertRule.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, id: removed._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
