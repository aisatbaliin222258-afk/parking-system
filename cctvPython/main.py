"""
CCTV AI Detection System - FastAPI Entry Point

Main API for receiving frames and stream inputs, running AI detection,
and returning JSON results with detection data and alerts.
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import numpy as np
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config.settings import (
    API_HOST, API_PORT, LOG_LEVEL
)
from detection.yolo_detector import get_detector
from detection.motion_detector import get_motion_detector
from detection.license_plate_ocr import get_ocr
from detection.data_processor import get_processor
from utils.image_processor import (
    load_image_from_base64,
    load_image_from_file,
    encode_image_to_base64,
    resize_image
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="CCTV AI Detection API",
    description="Real-time object detection, motion detection, and license plate OCR",
    version="1.0.0"
)

# Request/Response models
class DetectionRequest(BaseModel):
    """Request model for frame-based detection"""
    image_base64: str
    include_visualization: bool = False
    resize: bool = True


class StreamProcessRequest(BaseModel):
    """Request model for stream processing"""
    stream_url: Optional[str] = None
    duration_seconds: int = 30
    frame_interval: int = 5


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: str
    models_loaded: bool


# Global state
_detector_ready = False
_motion_ready = False


@app.on_event("startup")
async def startup_event():
    """Initialize models on startup"""
    global _detector_ready, _motion_ready
    try:
        logger.info("Initializing YOLO detector...")
        get_detector()
        _detector_ready = True
        logger.info("YOLO detector ready")
    except Exception as e:
        logger.error(f"Failed to load YOLO detector: {e}")
        _detector_ready = False
    
    try:
        logger.info("Initializing motion detector...")
        get_motion_detector()
        _motion_ready = True
        logger.info("Motion detector ready")
    except Exception as e:
        logger.error(f"Failed to initialize motion detector: {e}")
        _motion_ready = False
    
    try:
        logger.info("Initializing OCR module...")
        get_ocr()
        logger.info("OCR module ready")
    except Exception as e:
        logger.warning(f"OCR module not available: {e}")
    
    try:
        logger.info("Initializing detection processor...")
        get_processor()
        logger.info("Processor ready")
    except Exception as e:
        logger.error(f"Failed to initialize processor: {e}")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    
    Returns:
        Health status and model availability
    """
    return HealthResponse(
        status="healthy" if _detector_ready else "degraded",
        timestamp=datetime.utcnow().isoformat(),
        models_loaded=_detector_ready and _motion_ready
    )


@app.post("/detect-frame")
async def detect_frame(request: DetectionRequest):
    """
    Detect objects in a single frame
    
    Args:
        request: DetectionRequest with base64 encoded image
    
    Returns:
        JSON with detections, motion data, and alerts
    """
    if not _detector_ready:
        raise HTTPException(status_code=503, detail="Detector not initialized")
    
    try:
        # Decode image
        image = load_image_from_base64(request.image_base64)
        if image is None:
            raise HTTPException(status_code=400, detail="Failed to decode image")
        
        logger.info(f"Received frame: {image.shape}")
        
        # Resize if requested
        if request.resize:
            image = resize_image(image)
        
        # Run detections
        detector = get_detector()
        motion_detector = get_motion_detector()
        ocr = get_ocr()
        processor = get_processor()
        
        yolo_results = detector.detect(image)
        motion_results = motion_detector.detect_motion(image)
        
        # Extract license plates from vehicles
        vehicles_with_plates = ocr.batch_extract_from_vehicles(
            image,
            yolo_results.get("vehicles", [])
        )
        
        # Process all detections
        processed_results = processor.process_frame_detections(
            image,
            yolo_results,
            motion_results,
            vehicles_with_plates
        )
        
        # Add visualization if requested
        if request.include_visualization:
            from utils.image_processor import draw_detections_on_image
            viz_image = draw_detections_on_image(image, yolo_results)
            processed_results["visualization"] = encode_image_to_base64(viz_image)
        
        logger.info(f"Detection complete: {len(yolo_results.get('objects', []))} objects")
        return JSONResponse(content=processed_results)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process-stream")
async def process_stream(request: StreamProcessRequest):
    """
    Process video stream and detect objects
    
    Args:
        request: StreamProcessRequest with stream URL or file
    
    Returns:
        JSON with aggregated results from stream processing
    """
    if not _detector_ready:
        raise HTTPException(status_code=503, detail="Detector not initialized")
    
    try:
        import cv2
        
        if not request.stream_url:
            raise HTTPException(status_code=400, detail="stream_url is required")
        
        logger.info(f"Starting stream processing: {request.stream_url}")
        
        cap = cv2.VideoCapture(request.stream_url)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Failed to open stream")
        
        detector = get_detector()
        motion_detector = get_motion_detector()
        ocr = get_ocr()
        processor = get_processor()
        
        frame_count = 0
        detection_count = 0
        motion_count = 0
        detections_list = []
        alerts_list = []
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval = max(1, int(fps * request.frame_interval))
        
        while cap.isOpened() and frame_count < (fps * request.duration_seconds):
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process every nth frame
            if frame_count % frame_interval == 0:
                frame = resize_image(frame, max_width=640, max_height=480)
                
                yolo_results = detector.detect(frame)
                motion_results = motion_detector.detect_motion(frame)
                vehicles_with_plates = ocr.batch_extract_from_vehicles(
                    frame,
                    yolo_results.get("vehicles", [])
                )
                
                processed = processor.process_frame_detections(
                    frame,
                    yolo_results,
                    motion_results,
                    vehicles_with_plates
                )
                
                if yolo_results.get("total_detections", 0) > 0:
                    detection_count += 1
                    detections_list.append({
                        "frame": frame_count,
                        "detections": processed["detections"]
                    })
                
                if motion_results.get("motion_detected", False):
                    motion_count += 1
                
                if processed.get("alerts"):
                    alerts_list.extend(processed["alerts"])
            
            frame_count += 1
        
        cap.release()
        
        return JSONResponse(content={
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "stream_url": request.stream_url,
            "total_frames_processed": frame_count,
            "frames_with_detections": detection_count,
            "frames_with_motion": motion_count,
            "total_alerts": len(alerts_list),
            "detections_summary": detections_list,
            "alerts": alerts_list
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stream processing error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detect-frame-file")
async def detect_frame_file(file: UploadFile = File(...)):
    """
    Detect objects in uploaded image file
    
    Args:
        file: Uploaded image file (jpg, png, etc)
    
    Returns:
        JSON with detections and alerts
    """
    if not _detector_ready:
        raise HTTPException(status_code=503, detail="Detector not initialized")
    
    try:
        # Read uploaded file
        content = await file.read()
        nparr = np.frombuffer(content, np.uint8)
        import cv2
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(status_code=400, detail="Failed to decode image")
        
        logger.info(f"Processing uploaded file: {file.filename}")
        
        # Run detection
        detector = get_detector()
        motion_detector = get_motion_detector()
        ocr = get_ocr()
        processor = get_processor()
        
        image = resize_image(image)
        
        yolo_results = detector.detect(image)
        motion_results = motion_detector.detect_motion(image)
        vehicles_with_plates = ocr.batch_extract_from_vehicles(
            image,
            yolo_results.get("vehicles", [])
        )
        
        processed_results = processor.process_frame_detections(
            image,
            yolo_results,
            motion_results,
            vehicles_with_plates
        )
        
        return JSONResponse(content=processed_results)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File processing error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "CCTV AI Detection API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "detect_frame": "/detect-frame (POST)",
            "process_stream": "/process-stream (POST)",
            "detect_file": "/detect-frame-file (POST)"
        },
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting CCTV AI Detection API on {API_HOST}:{API_PORT}")
    uvicorn.run(
        app,
        host=API_HOST,
        port=API_PORT,
        log_level=LOG_LEVEL.lower()
    )
