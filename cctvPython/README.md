# CCTV AI Detection System - Python Backend

Production-ready FastAPI backend for real-time CCTV object detection, motion detection, and license plate recognition.

## Features

- **YOLOv8 Object Detection**: Detect people, vehicles, and other objects
- **License Plate OCR**: Extract text from detected license plates using Tesseract
- **Motion Detection**: Frame-to-frame motion analysis
- **Smart Alerts**: Generate alerts based on detections (blacklist, whitelist, unknown)
- **Stream Processing**: Process RTMP/HTTP video streams
- **REST API**: Three main endpoints for detection
- **Fast & Modular**: Optimized for low-latency real-time processing

## Installation

### Prerequisites
- Python 3.8+
- pip or conda
- Tesseract OCR (optional, for license plate reading):
  - **Windows**: Download from https://github.com/UB-Mannheim/tesseract/wiki
  - **Linux**: `sudo apt-get install tesseract-ocr`
  - **macOS**: `brew install tesseract`

### Setup

1. Install dependencies:
```bash
cd Backend/cctvPython
pip install -r requirements.txt
```

2. Create `.env` file from example:
```bash
cp .env.example .env
```

3. Configure settings in `.env` as needed (optional, defaults work out of the box)

## Running the Server

Start the FastAPI server:
```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`

### Interactive API Documentation
Visit `http://localhost:8000/docs` for Swagger UI documentation

## API Endpoints

### 1. Health Check
```
GET /health
```
Returns model status and server health.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123456",
  "models_loaded": true
}
```

### 2. Detect Frame
```
POST /detect-frame
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
        "class": "person",
        "class_id": 0,
        "confidence": 0.92,
        "bbox": {
          "x1": 100,
          "y1": 150,
          "x2": 250,
          "y2": 400,
          "width": 150,
          "height": 250
        },
        "center": {
          "x": 175,
          "y": 275
        }
      },
      {
        "class": "car",
        "class_id": 2,
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
      "confidence": 0.87,
      "bbox": {...},
      "license_plate": "ABC123XYZ",
      "alert_status": "unknown",
      "alert_message": "Unknown vehicle: ABC123XYZ"
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
  "alert_triggered": true,
  "image_size": {
    "width": 1280,
    "height": 720
  }
}
```

### 3. Process Stream
```
POST /process-stream
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
  "timestamp": "2024-01-15T10:30:45.123456",
  "stream_url": "rtmp://example.com/live/stream",
  "total_frames_processed": 150,
  "frames_with_detections": 12,
  "frames_with_motion": 45,
  "total_alerts": 3,
  "detections_summary": [...],
  "alerts": [...]
}
```

### 4. Detect from File
```
POST /detect-frame-file
Content-Type: multipart/form-data

file: <image.jpg>
```

## Configuration

Edit `.env` to customize:

```
# API Server
PYTHON_API_HOST=0.0.0.0
PYTHON_API_PORT=8000
LOG_LEVEL=INFO

# YOLO Model (n, s, m, l, x)
YOLO_MODEL=yolov8m.pt
YOLO_CONFIDENCE=0.5
YOLO_IOU=0.45

# Motion Detection Sensitivity (0-1, higher = more sensitive)
MOTION_SENSITIVITY=0.1
MOTION_THRESHOLD=3000

# Alert Confidence Threshold
ALERT_CONFIDENCE_THRESHOLD=0.6

# Tesseract OCR Path (for license plates)
TESSERACT_PATH=/path/to/tesseract

# Node.js API
NODEJS_API_URL=http://localhost:3000
```

## Module Structure

```
cctvPython/
├── main.py                 # FastAPI entry point
├── requirements.txt        # Python dependencies
├── .env.example           # Configuration template
├── config/
│   └── settings.py        # Configuration management
├── detection/
│   ├── yolo_detector.py       # YOLOv8 object detection
│   ├── license_plate_ocr.py   # License plate text extraction
│   ├── motion_detector.py     # Motion detection algorithm
│   └── data_processor.py      # Detection processing & alerts
├── utils/
│   └── image_processor.py     # Image utilities
└── models/                # Pre-downloaded YOLO models
    └── yolov8m.pt
```

## Performance Tips

1. **Model Selection**: Use `yolov8n.pt` for speed, `yolov8x.pt` for accuracy
2. **Confidence Threshold**: Adjust `YOLO_CONFIDENCE` based on your use case
3. **Frame Resizing**: Enabled by default, improves speed
4. **Stream Processing**: Adjust `frame_interval` to skip frames
5. **Motion Sensitivity**: Increase for parking lots, decrease for indoor areas

## Troubleshooting

### YOLO Model Not Loading
- Models download on first run (~200MB for yolov8m)
- Check internet connection
- Manually download from: https://github.com/ultralytics/assets/releases

### OCR Not Working
- Install Tesseract separately
- Update `TESSERACT_PATH` in `.env`
- On Windows, ensure it's added to PATH

### High Latency
- Reduce image resolution
- Use smaller YOLO model (yolov8s or yolov8n)
- Process every other frame
- Disable visualization

### Memory Issues
- Run on system with 4GB+ RAM
- Use smaller models
- Process shorter streams

## Integration with Node.js

The Python backend sends detection results to Node.js via:
```
POST {NODEJS_API_URL}/api/detection/process
```

Configure this in `.env`:
```
NODEJS_API_URL=http://localhost:3000
```

## License & Attribution

- **YOLOv8**: Ultralytics (AGPL-3.0)
- **OpenCV**: BSD
- **Tesseract**: Apache 2.0

## Support

For issues or feature requests, check the main repository documentation.
