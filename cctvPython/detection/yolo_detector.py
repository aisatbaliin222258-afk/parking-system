"""YOLOv8 object detection module"""
import cv2
import numpy as np
from ultralytics import YOLO
from typing import Dict, List, Tuple, Any
from config.settings import YOLO_MODEL, YOLO_CONFIDENCE, YOLO_IOU, DETECT_CLASSES
import logging

logger = logging.getLogger(__name__)


class YOLODetector:
    """YOLOv8 detector for objects, people, and vehicles"""
    
    def __init__(self, model_name: str = YOLO_MODEL):
        """Initialize YOLO model"""
        try:
            self.model = YOLO(model_name)
            logger.info(f"YOLO model '{model_name}' loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            raise
    
    def detect(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Run detection on image
        
        Args:
            image: Input image (numpy array or file path)
        
        Returns:
            Dictionary with detection results
        """
        try:
            results = self.model(
                image,
                conf=YOLO_CONFIDENCE,
                iou=YOLO_IOU,
                verbose=False
            )
            
            detections = self._parse_results(results[0], image)
            return detections
        except Exception as e:
            logger.error(f"Detection error: {e}")
            return {
                "success": False,
                "error": str(e),
                "objects": [],
                "humans": [],
                "vehicles": []
            }
    
    def _parse_results(self, result: Any, image: np.ndarray) -> Dict[str, Any]:
        """Parse YOLO results into structured format"""
        img_height, img_width = image.shape[:2]
        
        objects = []
        humans = []
        vehicles = []
        
        if result.boxes is None:
            return {
                "success": True,
                "objects": [],
                "humans": [],
                "vehicles": [],
                "image_size": {"width": img_width, "height": img_height}
            }
        
        for box in result.boxes:
            class_id = int(box.cls[0])
            class_name = result.names[class_id]
            confidence = float(box.conf[0])
            
            # Get bounding box coordinates
            x1, y1, x2, y2 = box.xyxy[0]
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            
            detection = {
                "class": class_name,
                "class_id": class_id,
                "confidence": round(confidence, 3),
                "bbox": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "width": x2 - x1,
                    "height": y2 - y1
                },
                "center": {
                    "x": (x1 + x2) // 2,
                    "y": (y1 + y2) // 2
                }
            }
            
            objects.append(detection)
            
            # Categorize detections
            if class_name == "person":
                humans.append(detection)
            elif class_name in ["car", "truck", "bus", "motorcycle"]:
                vehicles.append(detection)
        
        return {
            "success": True,
            "objects": objects,
            "humans": humans,
            "vehicles": vehicles,
            "image_size": {
                "width": img_width,
                "height": img_height
            },
            "total_detections": len(objects),
            "total_humans": len(humans),
            "total_vehicles": len(vehicles)
        }
    
    def detect_with_visualization(
        self, 
        image: np.ndarray, 
        draw_boxes: bool = True
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Run detection and optionally draw bounding boxes
        
        Args:
            image: Input image
            draw_boxes: Whether to draw bounding boxes on image
        
        Returns:
            Tuple of (annotated image, detection results)
        """
        detections = self.detect(image)
        
        if draw_boxes and detections["success"]:
            image_copy = image.copy()
            for obj in detections["objects"]:
                bbox = obj["bbox"]
                # Draw rectangle
                cv2.rectangle(
                    image_copy,
                    (bbox["x1"], bbox["y1"]),
                    (bbox["x2"], bbox["y2"]),
                    (0, 255, 0),
                    2
                )
                # Draw label
                label = f"{obj['class']} {obj['confidence']:.2f}"
                cv2.putText(
                    image_copy,
                    label,
                    (bbox["x1"], bbox["y1"] - 5),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 255, 0),
                    2
                )
            return image_copy, detections
        
        return image, detections


# Global detector instance
_detector = None


def get_detector() -> YOLODetector:
    """Get or create global detector instance"""
    global _detector
    if _detector is None:
        _detector = YOLODetector()
    return _detector
