# CCTV AI Detection System - Quick Start Guide

## Project Overview

You now have a **complete production-ready Python AI backend** for CCTV detection:
- YOLOv8 object detection (people, vehicles)
- Tesseract OCR for license plates
- Motion detection algorithm
- Intelligent alert generation

## File Structure Created

```
Backend/cctvPython/
├── main.py                          # FastAPI server (START HERE)
├── requirements.txt                 # Python dependencies
├── README.md                        # Full documentation
├── .env.example                     # Configuration template
├── config/
│   ├── __init__.py
│   └── settings.py                  # Configuration management
├── detection/
│   ├── __init__.py
│   ├── yolo_detector.py            # YOLOv8 detection (people, vehicles)
│   ├── license_plate_ocr.py        # License plate text extraction
│   ├── motion_detector.py          # Motion detection algorithm
│   └── data_processor.py           # Alert generation & processing
├── utils/
│   ├── __init__.py
│   └── image_processor.py          # Image utilities
├── models/                          # YOLO models (auto-downloaded)
└── logs/                           # Application logs
```

## Quick Start (3 Steps)

### Step 1: Install Dependencies
```bash
cd Backend/cctvPython
pip install -r requirements.txt
```

First run will download YOLOv8 model (~200MB).

### Step 2: Configure (Optional)
```bash
# Copy example config
cp .env.example .env

# Edit if needed, otherwise defaults work fine
# Default settings: yolov8m, localhost:8000
```

### Step 3: Run the Server
```bash
python main.py
```

You should see:
```
Initializing YOLO detector...
YOLO model 'yolov8m.pt' loaded successfully
Motion detector initialized...
...
Starting CCTV AI Detection API on 0.0.0.0:8000
```

## API Usage

### Test the Server
```bash
# Health check
curl http://localhost:8000/health

# Interactive docs
Open: http://localhost:8000/docs
```

### Example: Detect Objects in a Frame

```python
import requests
import base64

# Read image
with open("test_image.jpg", "rb") as f:
    img_base64 = base64.b64encode(f.read()).decode()

# Send to detection API
response = requests.post(
    "http://localhost:8000/detect-frame",
    json={
        "image_base64": img_base64,
        "include_visualization": False,
        "resize": True
    }
)

# Get results
results = response.json()
print(f"Found {results['detections']['total_objects']} objects")
print(f"Humans: {results['detections']['humans']}")
print(f"Vehicles: {results['detections']['vehicles']}")
print(f"Alerts: {results['alerts']}")
```

### Example: Process Video Stream

```python
requests.post(
    "http://localhost:8000/process-stream",
    json={
        "stream_url": "rtmp://example.com/stream",
        "duration_seconds": 30,
        "frame_interval": 5
    }
)
```

## What Each Module Does

| Module | Purpose | Input | Output |
|--------|---------|-------|--------|
| **yolo_detector.py** | Detect objects | Image (numpy array) | Objects with boxes, confidence |
| **license_plate_ocr.py** | Extract plate text | Vehicle box + image | License plate string |
| **motion_detector.py** | Detect movement | Frame 1, Frame 2 | Motion score (0-1) |
| **data_processor.py** | Generate alerts | All detections + lists | JSON with alerts |

## Configuration Options

Edit `.env` to customize:

```bash
# API Server
PYTHON_API_PORT=8000

# YOLO Model (bigger = more accurate, slower)
YOLO_MODEL=yolov8m.pt      # options: n, s, m, l, x

# Detection confidence (0-1, higher = fewer false positives)
YOLO_CONFIDENCE=0.5

# Motion sensitivity (0-1, higher = more sensitive)
MOTION_SENSITIVITY=0.1

# Alert threshold (only alert if confidence > this)
ALERT_CONFIDENCE_THRESHOLD=0.6
```

## JSON Response Example

```json
{
  "timestamp": "2024-01-15T10:30:45.123456",
  "success": true,
  "detections": {
    "total_objects": 3,
    "humans": 1,
    "vehicles": 2,
    "objects": [
      {
        "class": "person",
        "confidence": 0.92,
        "bbox": {"x1": 100, "y1": 150, "x2": 250, "y2": 400, "width": 150, "height": 250},
        "center": {"x": 175, "y": 275}
      },
      {
        "class": "car",
        "confidence": 0.87,
        "bbox": {...},
        "license_plate": "ABC123XYZ"
      }
    ]
  },
  "motion": {
    "detected": true,
    "score": 0.45,
    "percentage": 2.3
  },
  "vehicles": [
    {
      "class": "car",
      "license_plate": "ABC123XYZ",
      "alert_status": "unknown",
      "alert_message": "Unknown vehicle: ABC123XYZ",
      "confidence": 0.87
    }
  ],
  "alerts": [
    {
      "type": "unknown_vehicle",
      "severity": "medium",
      "message": "Unknown vehicle: ABC123XYZ",
      "license_plate": "ABC123XYZ",
      "confidence": 0.87
    }
  ],
  "alert_triggered": true
}
```

## Troubleshooting

### "Module not found" errors
```bash
# Make sure you're in the right directory
cd Backend/cctvPython

# Reinstall dependencies
pip install --upgrade -r requirements.txt
```

### "YOLO model download failed"
- Check internet connection
- Model will download on first run
- Or manually download from: https://github.com/ultralytics/assets/releases

### "ImportError: No module named 'config'"
- Make sure main.py is in `Backend/cctvPython/` (it is)
- Check you're running `python main.py` from that directory

### High CPU/Memory Usage
- Use smaller model: `YOLO_MODEL=yolov8n.pt` (faster)
- Reduce image size (auto-resized to 1280x720)
- Process fewer frames: increase `frame_interval` in stream endpoint

## Next: Node.js Integration

The Python backend is complete! Next step is building the Node.js API layer that will:

1. **Call Python endpoints** for detections
2. **Store results in MongoDB** (whitelist, blacklist, events)
3. **Broadcast alerts via WebSocket** to frontend
4. **Provide REST API** for frontend

See the main project plan for Phase 2 & 3 setup.

## Key Features

✅ **YOLOv8 Detection** - Accurate object recognition  
✅ **License Plate OCR** - Extract text from plates  
✅ **Motion Detection** - Movement analysis  
✅ **Smart Alerts** - Whitelist/blacklist matching  
✅ **REST API** - Easy integration  
✅ **Async Processing** - High throughput  
✅ **Error Handling** - Graceful failures  
✅ **Logging** - Full debugging info  
✅ **Docker Ready** - Containerizable  

## Documentation

- **Main Docs**: `Backend/cctvPython/README.md`
- **API Docs**: http://localhost:8000/docs (when running)
- **Configuration**: `.env` file options
- **Source Code**: Well-commented modules

---

**Happy detecting! 🎥**
