const analyticsService = require('../analyticsService');

async function postEvent(req, res){
  try{
    const payload = req.body;
    if (!payload || !payload.camera_id) return res.status(400).json({ error: 'camera_id required' });
    const saved = await analyticsService.saveEvent(payload);
    res.json({ success: true, saved: typeof saved.toObject === 'function' ? saved.toObject() : saved });
  }catch(err){
    console.error('postEvent error', err);
    res.status(500).json({ error: err.message });
  }
}

// Helper: build opts from query params. Supports startDate/endDate ISO strings or period identifiers (this_week, last_week)
function buildDateOptsFromQuery(q){
  const opts = {};
  if (q.startDate) opts.startDate = q.startDate;
  if (q.endDate) opts.endDate = q.endDate;
  if (q.period) opts.period = q.period;
  return opts;
}

async function getSummary(req, res){
  try{
    const opts = buildDateOptsFromQuery(req.query);
    const summary = await analyticsService.getSummary(opts);
    // Normalize types and provide defaults to avoid frontend breakage
    const normalized = {
      total_human_detections: Number(summary.total_human_detections) || 0,
      total_vehicle_detections: Number(summary.total_vehicle_detections) || 0,
      total_alerts: Number(summary.total_alerts) || 0,
      blocked_vehicles_count: Number(summary.blocked_vehicles_count) || 0,
      unauthorized_movement_count: Number(summary.unauthorized_movement_count) || 0,
      // optional fields that frontend may use
      avg_occupancy: summary.avg_occupancy != null ? String(summary.avg_occupancy) : null,
      peak_hour: summary.peak_hour || null,
      peak_occupancy: summary.peak_occupancy != null ? String(summary.peak_occupancy) : null,
      busiest_zone: summary.busiest_zone || null
    };
    res.json(normalized);
  }catch(err){
    console.error('getSummary error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getLive(req, res){
  try{
    const limit = parseInt(req.query.limit) || 20;
    const opts = buildDateOptsFromQuery(req.query);
    const list = await analyticsService.getLive(limit, opts);
    res.json({ results: list });
  }catch(err){
    console.error('getLive error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getHistory(req, res){
  try{
    const groupBy = req.query.groupBy || 'day';
    const limit = parseInt(req.query.limit) || 30;
    const opts = buildDateOptsFromQuery(req.query);
    const h = await analyticsService.getHistory(groupBy, limit, opts);
    res.json({ results: h });
  }catch(err){
    console.error('getHistory error', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { postEvent, getSummary, getLive, getHistory }; // analyticsController updated