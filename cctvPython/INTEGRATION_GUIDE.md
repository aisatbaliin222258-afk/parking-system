# Python Backend Integration Guide

## Overview

Your Python backend is **complete and ready to receive requests** from the Node.js API layer.

This document explains how Node.js will integrate with the Python backend.

---

## 🔌 Integration Points

### Python Backend Exposes These Endpoints

The Node.js server will call these HTTP endpoints:

#### 1. Health Check
```
GET http://localhost:8000/health
```
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123456",
  "models_loaded": true
}
```
**Use**: Check if Python backend is running before sending detection requests

---

#### 2. Single Frame Detection
```
POST http://localhost:8000/detect-frame
Content-Type: application/json

{
  "image_base64": "iVBORw0KGgoAAAANSUhEUg...",
  "include_visualization": false,
  "resize": true
}
```

**Response:**
```json
{
  "timestamp": "2024-01-15T10:30:45.123456",
  "success": true,
  "detections": {
    "total_objects": 3,
    "high_confidence_objects": 2,
    "humans": 1,
    "vehicles": 2,
    "objects": [
      {
        "class": "car",
        "confidence": 0.87,
        "bbox": {"x1": 100, "y1": 150, "x2": 250, "y2": 400},
        "license_plate": "ABC123XYZ"
      }
    ]
  },
  "motion": {
    "detected": true,
    "score": 0.45
  },
  "vehicles": [...],
  "alerts": [
    {
      "type": "unknown_vehicle",
      "severity": "medium",
      "license_plate": "ABC123XYZ",
      "message": "Unknown vehicle detected"
    }
  ],
  "alert_triggered": true
}
```

---

#### 3. Video Stream Processing
```
POST http://localhost:8000/process-stream
Content-Type: application/json

{
  "stream_url": "rtmp://example.com/live/stream",
  "duration_seconds": 30,
  "frame_interval": 5
}
```

**Response:**
```json
{
  "status": "success",
  "timestamp": "...",
  "total_frames_processed": 150,
  "frames_with_detections": 12,
  "total_alerts": 3,
  "alerts": [...]
}
```

---

#### 4. File Upload Detection
```
POST http://localhost:8000/detect-frame-file
Content-Type: multipart/form-data

file: <binary image data>
```

**Response:** Same as `/detect-frame`

---

## 📝 Node.js Integration Example

Here's how Node.js routes will call Python:

### 1. Receive CCTV Frame (from frontend or camera)
```javascript
// Backend/routes/detectionRoutes.js
router.post('/api/detection/process', async (req, res) => {
  try {
    const { image_base64, camera_id } = req.body;
    
    // Call Python backend
    const pythonResponse = await axios.post(
      'http://localhost:8000/detect-frame',
      {
        image_base64: image_base64,
        include_visualization: false,
        resize: true
      }
    );
    
    // pythonResponse.data contains:
    // {
    //   detections, motion, vehicles, alerts, alert_triggered
    // }
    
    // Store in MongoDB
    const detection = new Detection({
      camera_id,
      timestamp: new Date(),
      detections: pythonResponse.data.detections,
      motion: pythonResponse.data.motion,
      vehicles: pythonResponse.data.vehicles,
      alerts: pythonResponse.data.alerts,
      alert_triggered: pythonResponse.data.alert_triggered
    });
    
    await detection.save();
    
    // Broadcast alert via WebSocket if triggered
    if (pythonResponse.data.alert_triggered) {
      io.emit('alert', {
        camera_id,
        timestamp: new Date(),
        alerts: pythonResponse.data.alerts
      });
    }
    
    res.json(pythonResponse.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🔄 Data Flow

```
┌──────────────┐
│  CCTV Camera │
│   or File    │
└──────┬───────┘
       │
       │ Frame/Image
       ▼
┌──────────────────────────┐
│    Frontend Upload       │
│  or Camera Bridge        │
└──────┬───────────────────┘
       │
       │ Base64 Image
       │ POST /api/detection/capture
       ▼
┌──────────────────────────┐
│   Node.js Express API    │  Detection Route
│  - Receives image        │  /api/detection/process
│  - Calls Python backend  │
└──────┬───────────────────┘
       │
       │ POST /detect-frame
       │ (base64 image)
       ▼
┌──────────────────────────┐
│  Python FastAPI Backend  │
│  - YOLOv8 Detection      │
│  - Motion Detection      │
│  - License Plate OCR     │
│  - Alert Generation      │
└──────┬───────────────────┘
       │
       │ JSON Response
       │ {detections, motion, alerts}
       ▼
┌──────────────────────────┐
│   Node.js Express API    │
│  - Stores in MongoDB     │
│  - Broadcasts via WS     │
└──────┬───────────────────┘
       │
       │ WebSocket Alert
       ▼
┌──────────────────────────┐
│   Frontend Dashboard     │
│  - Real-time alerts      │
│  - Event history         │
│  - Statistics            │
└──────────────────────────┘
```

---

## 🔐 Integration Checklist

For Node.js implementation, ensure:

- [ ] **Health Check**: Call `/health` on startup to verify Python is running
- [ ] **Error Handling**: Handle connection failures gracefully
- [ ] **Timeout**: Set reasonable timeout (Python might take 2-5 seconds per frame)
- [ ] **Scaling**: Use connection pooling for multiple concurrent requests
- [ ] **Whitelist/Blacklist**: Pass to frontend for alert filtering (or to Python via settings)
- [ ] **Logging**: Log all detection results for debugging
- [ ] **Rate Limiting**: Don't send more than 1 frame/second per camera initially

---

## 📊 Database Schema (MongoDB)

Store detection results in MongoDB:

```javascript
// Detection Event Schema
{
  _id: ObjectId,
  camera_id: "camera-1",
  timestamp: ISODate,
  
  // From Python backend
  detections: {
    total_objects: 3,
    humans: 1,
    vehicles: 2,
    objects: [
      {
        class: "car",
        confidence: 0.87,
        bbox: {...}
      }
    ]
  },
  
  motion: {
    detected: true,
    score: 0.45,
    percentage: 2.3
  },
  
  vehicles: [
    {
      class: "car",
      license_plate: "ABC123XYZ",
      alert_status: "unknown",
      confidence: 0.87
    }
  ],
  
  alerts: [
    {
      type: "unknown_vehicle",
      severity: "medium",
      license_plate: "ABC123XYZ"
    }
  ],
  
  alert_triggered: true
}
```

---

## 🚀 Performance Considerations

### Python Backend
- **Single frame**: 200-500ms (depends on model size)
- **Typical throughput**: 2-5 frames/second on single GPU
- **Memory**: ~2-4GB for yolov8m

### Node.js Integration
- **Queue frames**: Don't send faster than Python can process
- **Connection pooling**: Keep connections alive
- **Batch storage**: Write detection batches to DB (not per-frame)
- **Cache whitelist/blacklist**: Don't query DB on every frame

### Recommendations
1. Start with 1 frame per second per camera
2. Use HTTP connection pooling
3. Batch write detections to MongoDB (every 10 frames)
4. Cache whitelist/blacklist in memory
5. Monitor Python backend CPU/memory usage

---

## 🔧 Configuration for Node.js

In Node.js `.env`:

```
# Python Backend
PYTHON_API_URL=http://localhost:8000
PYTHON_DETECT_FRAME_ENDPOINT=/detect-frame
PYTHON_HEALTH_ENDPOINT=/health

# Detection Settings
DETECTION_CONFIDENCE_THRESHOLD=0.6
MOTION_ALERT_ENABLED=true

# Camera Settings
CAMERA_FRAME_RATE=1          # frames per second
CAMERA_BATCH_SIZE=10         # frames before DB write
```

---

## 📡 WebSocket Integration

Once Node.js receives detections from Python:

1. **Check if alert triggered**:
   ```javascript
   if (pythonResponse.alert_triggered) {
     io.emit('alert', {
       camera_id,
       timestamp,
       alerts: pythonResponse.alerts,
       vehicles: pythonResponse.vehicles
     });
   }
   ```

2. **Frontend receives**:
   ```javascript
   socket.on('alert', (data) => {
     console.log('Alert:', data.alerts);
     // Update UI with alert
   });
   ```

---

## 🧪 Testing Python Backend

### From Node.js (using axios):

```javascript
const axios = require('axios');
const fs = require('fs');

async function testDetection() {
  // Load test image
  const imageBuffer = fs.readFileSync('test-image.jpg');
  const base64 = imageBuffer.toString('base64');
  
  try {
    const response = await axios.post(
      'http://localhost:8000/detect-frame',
      {
        image_base64: base64,
        resize: true
      }
    );
    
    console.log('Detection successful');
    console.log('Objects found:', response.data.detections.total_objects);
    console.log('Alerts:', response.data.alerts);
  } catch (error) {
    console.error('Detection failed:', error.message);
  }
}

testDetection();
```

---

## 📋 Next Steps

1. **Start Python backend**:
   ```bash
   cd Backend/cctvPython
   pip install -r requirements.txt
   python main.py
   ```

2. **Verify it's running**:
   ```bash
   curl http://localhost:8000/health
   ```

3. **Build Node.js routes** that:
   - Call `/detect-frame` endpoint
   - Store results in MongoDB
   - Broadcast via WebSocket

4. **Build Frontend** that:
   - Sends images to Node.js
   - Receives alerts via WebSocket
   - Displays detections

---

## 🆘 Troubleshooting

### Python backend not responding
```bash
# Check if it's running
curl http://localhost:8000/health

# Check logs
python main.py
# Look for error messages
```

### Timeout errors in Node.js
- Python detection is slow (2-5s per frame)
- Increase Node.js timeout: `timeout: 30000` (30 seconds)
- Or use async queue with smaller batch size

### High memory usage
- Use smaller YOLO model: `yolov8n.pt` instead of `yolov8m.pt`
- Resize images before sending
- Process fewer frames per second

### "Connection refused" error
- Python backend not running
- Wrong URL (check port 8000)
- Firewall blocking connections

---

## 📖 Reference

- **Python Backend URL**: `http://localhost:8000`
- **Main Endpoint**: `POST /detect-frame`
- **Health Check**: `GET /health`
- **API Docs**: `http://localhost:8000/docs`

---

**Ready to integrate with Node.js! 🚀**

See `Phase 2 & 3` in the main plan for MongoDB models and Node.js routes.
