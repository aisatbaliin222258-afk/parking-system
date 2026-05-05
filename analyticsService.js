const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Detection = require('./models/detectionModel');
const socketModule = require('./socket');

const DATA_DIR = path.join(__dirname, 'data');
const JSON_FILE = path.join(DATA_DIR, 'detections.json');

function ensureDataDir(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(JSON_FILE)) fs.writeFileSync(JSON_FILE, JSON.stringify([]));
}

async function saveEvent(event){
  // Basic normalization and validation
  if (event.timestamp) event.timestamp = new Date(event.timestamp);
  if (!event.camera_id) event.camera_id = 'unknown';
  if (!Array.isArray(event.detections)) event.detections = Array.isArray(event.detections?.objects) ? event.detections.objects : [];
  event.detections = (event.detections||[]).map(d=>({
    type: d.type || d.class || 'object',
    confidence: typeof d.confidence === 'string' ? Number(d.confidence) : (Number(d.confidence) || 0),
    status: d.status || d.alert_status || 'detected',
    plate_number: d.plate_number || d.license_plate || null
  }));

  const useMongo = mongoose.connection && mongoose.connection.readyState === 1;

  if (useMongo){
    // Deduplicate: if a detection with same camera_id and timestamp within 1 second exists, skip saving
    const ts = event.timestamp || new Date();
    const windowBefore = new Date(ts.getTime() - 1000);
    const windowAfter = new Date(ts.getTime() + 1000);
    try{
      const exists = await Detection.findOne({ camera_id: event.camera_id, timestamp_utc: { $gte: windowBefore, $lte: windowAfter } }).lean();
      if (exists){
        console.info('Duplicate detection skipped for', event.camera_id, ts.toISOString());
        // still emit via websocket to keep realtime UI in sync
        const io = socketModule.getIO();
        if (io) io.emit('NEW_DETECTION', formatEmitPayload(exists));
        return exists;
      }
    }catch(e){ console.warn('Dedupe check failed', e); }

    const doc = new Detection({
      camera_id: event.camera_id || 'unknown',
      timestamp_utc: event.timestamp || new Date(),
      detections: buildDetectionsSummary(event.detections),
      vehicles: (event.detections||[]).filter(d=>d.type==='vehicle').map(v=>({
        license_plate: v.plate_number || v.license_plate || null,
        confidence: Number(v.confidence) || 0,
        alert_status: v.status === 'blocked' ? 'blocked' : (v.status === 'authorized' ? 'authorized' : 'unknown')
      })),
      alerts: buildAlertsFromDetections(event.detections),
      alert_triggered: (event.detections||[]).some(d=>d.status==='blocked' || d.status==='unauthorized'),
      image_base64: event.image_base64 || null,
      processed_by: 'python_backend',
    });

    const saved = await doc.save();

    const io = socketModule.getIO();
    if (io){
      io.emit('NEW_DETECTION', formatEmitPayload(saved));
    }

    console.info('Saved detection', saved._id || null, 'camera', saved.camera_id);
    return saved;
  } else {
    ensureDataDir();
    const raw = fs.readFileSync(JSON_FILE,'utf8');
    const arr = JSON.parse(raw || '[]');
    const rec = {
      id: (arr.length+1),
      camera_id: event.camera_id || 'unknown',
      timestamp: (event.timestamp || new Date()).toISOString(),
      detections: event.detections || [],
    };
    arr.push(rec);
    fs.writeFileSync(JSON_FILE, JSON.stringify(arr, null, 2));

    const io = socketModule.getIO();
    if (io) io.emit('NEW_DETECTION', rec);

    return rec;
  }
}

function buildDetectionsSummary(detections){
  const summary = {
    total_objects: 0,
    high_confidence_objects: 0,
    humans: 0,
    vehicles: 0,
    objects: []
  };
  (detections||[]).forEach(d=>{
    summary.total_objects++;
    if ((d.confidence||0) > 0.6) summary.high_confidence_objects++;
    if (d.type === 'human') summary.humans++;
    if (d.type === 'vehicle') summary.vehicles++;
    summary.objects.push({ class: d.type, confidence: d.confidence, license_plate: d.plate_number || d.license_plate });
  });
  return summary;
}

function buildAlertsFromDetections(detections){
  const alerts = [];
  (detections||[]).forEach(d=>{
    if (d.status === 'blocked') alerts.push({ type: 'blocked_vehicle', severity: 'high', message: `Blocked ${d.type} detected`, license_plate: d.plate_number || d.license_plate });
    if (d.status === 'unauthorized') alerts.push({ type: 'unauthorized', severity: 'medium', message: `Unauthorized ${d.type} detected` });
    if (d.type === 'movement' && d.status === 'detected') alerts.push({ type: 'motion_detected', severity: 'low', message: 'Movement detected' });
  });
  return alerts;
}

function formatEmitPayload(doc){
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const ts = obj.timestamp_utc || obj.createdAt || new Date();
  const iso = (ts && ts.toISOString) ? ts.toISOString() : (new Date(ts)).toISOString();
  return {
    id: obj._id || obj.id || null,
    camera_id: obj.camera_id || 'unknown',
    timestamp: iso,
    detections: (obj.detections && obj.detections.objects) ? obj.detections.objects.map(o=>({ type: o.class, confidence: Number(o.confidence) || 0, plate_number: o.license_plate || null })) : (Array.isArray(obj.detections) ? obj.detections : []),
    alerts: Array.isArray(obj.alerts) ? obj.alerts : []
  };
}

async function getSummary(opts = {}){
  const { startDate, endDate, period } = opts || {};
  function parseISO(d){ if (!d) return null; const x = new Date(d); return isNaN(x.getTime()) ? null : x; }
  let start = parseISO(startDate), end = parseISO(endDate);

  if (period === 'this_week' || period === 'last_week'){
    // Week defined: Monday (00:00 UTC) to Sunday (23:59:59.999 UTC)
    const now = new Date();
    const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
    const todayUtc = new Date(Date.UTC(y,m,d));
    const dow = todayUtc.getUTCDay(); // 0=Sun,1=Mon...
    const daysSinceMon = (dow + 6) % 7;
    let wkStart = new Date(todayUtc.getTime() - daysSinceMon * 24*60*60*1000);
    if (period === 'last_week') wkStart = new Date(wkStart.getTime() - 7*24*60*60*1000);
    const wkEnd = new Date(wkStart.getTime() + 7*24*60*60*1000 - 1);
    start = wkStart; end = wkEnd;
  }

  const useMongo = mongoose.connection && mongoose.connection.readyState === 1;
  if (useMongo){
    const pipeline = [];
    if (start || end){
      const m = {};
      if (start) m.$gte = start;
      if (end) m.$lte = end;
      pipeline.push({ $match: { timestamp_utc: m } });
    }
    pipeline.push(
      { $unwind: { path: '$detections.objects', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: null,
        total_humans: { $sum: { $cond: [ { $eq: ['$detections.objects.class','human'] }, 1, 0 ] } },
        total_vehicles: { $sum: { $cond: [ { $eq: ['$detections.objects.class','vehicle'] }, 1, 0 ] } },
        total_alerts: { $sum: { $size: { $ifNull: ['$alerts', []] } } },
        blocked_vehicles: {
          $sum: {
            $size: {
              $filter: {
                input: { $ifNull: ['$vehicles', []] },
                as: 'v',
                cond: { $eq: ['$$v.alert_status','blocked'] }
              }
            }
          }
        },
        unauthorized_movement: {
          $sum: {
            $size: {
              $filter: {
                input: { $ifNull: ['$alerts', []] },
                as: 'a',
                cond: { $eq: ['$$a.type','motion_detected'] }
              }
            }
          }
        }
      } }
    );
    const agg = await Detection.aggregate(pipeline);
    const res = agg[0] || {};
    return {
      total_human_detections: res.total_humans || 0,
      total_vehicle_detections: res.total_vehicles || 0,
      total_alerts: res.total_alerts || 0,
      blocked_vehicles_count: res.blocked_vehicles || 0,
      unauthorized_movement_count: res.unauthorized_movement || 0
    };
  } else {
    ensureDataDir();
    const arr = JSON.parse(fs.readFileSync(JSON_FILE,'utf8')||'[]');
    const filtered = arr.filter(r=>{
      if (!start && !end) return true;
      const t = new Date(r.timestamp || r.timestamp_utc || r.createdAt);
      if (start && t < start) return false;
      if (end && t > end) return false;
      return true;
    });
    let total_humans=0, total_vehicles=0, total_alerts=0, blocked_vehicles_count=0, unauthorized_movement_count=0;
    filtered.forEach(r=>{
      (r.detections||[]).forEach(d=>{
        if (d.type==='human') total_humans++;
        if (d.type==='vehicle') total_vehicles++;
        if (d.status==='blocked') { total_alerts++; blocked_vehicles_count++; }
        if (d.status==='unauthorized' || d.type==='movement') { total_alerts++; if (d.status==='unauthorized') unauthorized_movement_count++; }
      });
    });
    return { total_human_detections: total_humans, total_vehicle_detections: total_vehicles, total_alerts, blocked_vehicles_count, unauthorized_movement_count };
  }
}

async function getLive(limit=20, opts={}){
  const { startDate, endDate, period } = opts || {};
  function parseISO(d){ if (!d) return null; const x = new Date(d); return isNaN(x.getTime()) ? null : x; }
  let start = parseISO(startDate), end = parseISO(endDate);
  if (period === 'this_week' || period === 'last_week'){
    const now = new Date();
    const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
    const todayUtc = new Date(Date.UTC(y,m,d));
    const dow = todayUtc.getUTCDay();
    const daysSinceMon = (dow + 6) % 7;
    let wkStart = new Date(todayUtc.getTime() - daysSinceMon * 24*60*60*1000);
    if (period === 'last_week') wkStart = new Date(wkStart.getTime() - 7*24*60*60*1000);
    const wkEnd = new Date(wkStart.getTime() + 7*24*60*60*1000 - 1);
    start = wkStart; end = wkEnd;
  }

  const useMongo = mongoose.connection && mongoose.connection.readyState === 1;
  if (useMongo){
    const q = {};
    if (start || end){ q.timestamp_utc = {}; if (start) q.timestamp_utc.$gte = start; if (end) q.timestamp_utc.$lte = end; }
    const docs = await Detection.find(q).sort({ createdAt: -1 }).limit(limit);
    return docs.map(d=>formatEmitPayload(d));
  } else {
    ensureDataDir();
    const arr = JSON.parse(fs.readFileSync(JSON_FILE,'utf8')||'[]');
    const filtered = arr.filter(r=>{
      const t = new Date(r.timestamp || r.timestamp_utc || r.createdAt);
      if (start && t < start) return false;
      if (end && t > end) return false;
      return true;
    });
    return filtered.slice(-limit).reverse();
  }
}

async function getHistory(groupBy='day', limit=30, opts={}){
  const { startDate, endDate, period } = opts || {};
  function parseISO(d){ if (!d) return null; const x = new Date(d); return isNaN(x.getTime()) ? null : x; }
  let start = parseISO(startDate), end = parseISO(endDate);
  if (period === 'this_week' || period === 'last_week'){
    const now = new Date();
    const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
    const todayUtc = new Date(Date.UTC(y,m,d));
    const dow = todayUtc.getUTCDay();
    const daysSinceMon = (dow + 6) % 7;
    let wkStart = new Date(todayUtc.getTime() - daysSinceMon * 24*60*60*1000);
    if (period === 'last_week') wkStart = new Date(wkStart.getTime() - 7*24*60*60*1000);
    const wkEnd = new Date(wkStart.getTime() + 7*24*60*60*1000 - 1);
    start = wkStart; end = wkEnd;
  }

  const useMongo = mongoose.connection && mongoose.connection.readyState === 1;
  if (useMongo){
    const dateFormat = groupBy==='hour' ? '%Y-%m-%dT%H:00:00Z' : '%Y-%m-%d';
    const pipeline = [];
    if (start || end){
      const m = {};
      if (start) m.$gte = start;
      if (end) m.$lte = end;
      pipeline.push({ $match: { timestamp_utc: m } });
    }
    pipeline.push(
      { $addFields: { grp: { $dateToString: { format: dateFormat, date: '$timestamp_utc' } } } },
      { $group: { _id: '$grp', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: limit }
    );
    const agg = await Detection.aggregate(pipeline);
    return agg.map(a=>({ period: a._id, count: a.count })).reverse();
  } else {
    ensureDataDir();
    const arr = JSON.parse(fs.readFileSync(JSON_FILE,'utf8')||'[]');
    const filtered = arr.filter(r=>{
      const t = new Date(r.timestamp || r.timestamp_utc || r.createdAt);
      if (start && t < start) return false;
      if (end && t > end) return false;
      return true;
    });
    const map = {};
    filtered.forEach(r=>{
      const d = new Date(r.timestamp || r.timestamp_utc || r.createdAt);
      const key = groupBy==='hour' ? d.toISOString().substring(0,13) + ':00:00Z' : d.toISOString().substring(0,10);
      map[key] = (map[key]||0)+1;
    });
    return Object.keys(map).sort().map(k=>({ period: k, count: map[k] }));
  }
}

module.exports = { saveEvent, getSummary, getLive, getHistory };