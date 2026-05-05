"""Configuration settings for CCTV AI Detection System"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Base paths
BASE_DIR = Path(__file__).parent.parent
DETECTION_DIR = BASE_DIR / "detection"
MODELS_DIR = BASE_DIR / "models"

# Create necessary directories
MODELS_DIR.mkdir(exist_ok=True)

# API Configuration
API_HOST = os.getenv("PYTHON_API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("PYTHON_API_PORT", 8000))

# YOLO Configuration
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8m.pt")
YOLO_CONFIDENCE = float(os.getenv("YOLO_CONFIDENCE", 0.5))
YOLO_IOU = float(os.getenv("YOLO_IOU", 0.45))

# Detection Classes of Interest
DETECT_CLASSES = {
    "person": 0,
    "car": 2,
    "truck": 7,
    "bus": 5,
    "motorcycle": 3,
    "bicycle": 1,
}

# Motion Detection Sensitivity (0-1, higher = more sensitive)
MOTION_SENSITIVITY = float(os.getenv("MOTION_SENSITIVITY", 0.1))
MOTION_THRESHOLD = int(os.getenv("MOTION_THRESHOLD", 3000))

# Alert Configuration
ALERT_CONFIDENCE_THRESHOLD = float(os.getenv("ALERT_CONFIDENCE_THRESHOLD", 0.6))

# OCR Configuration
TESSERACT_PATH = os.getenv("TESSERACT_PATH", None)

# Node.js API Configuration
NODEJS_API_URL = os.getenv("NODEJS_API_URL", "http://localhost:3000")
NODEJS_DETECTION_ENDPOINT = f"{NODEJS_API_URL}/api/detection/process"

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
