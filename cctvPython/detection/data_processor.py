"""Detection data processor and alert generator"""
from typing import Dict, List, Any
from datetime import datetime
from config.settings import ALERT_CONFIDENCE_THRESHOLD
import logging
import base64
import io
from PIL import Image
import cv2
import numpy as np

logger = logging.getLogger(__name__)


class DetectionProcessor:
    """Process detection results and generate alerts"""
    
    def __init__(self):
        """Initialize processor"""
        self.alert_threshold = ALERT_CONFIDENCE_THRESHOLD
    
    def process_frame_detections(
        self,
        frame: np.ndarray,
        yolo_detections: Dict,
        motion_data: Dict,
        vehicle_ocr_results: List[Dict],
        whitelist: List[str] = None,
        blacklist: List[str] = None
    ) -> Dict[str, Any]:
        """
        Process all detections for a frame and generate alerts
        
        Args:
            frame: Original frame
            yolo_detections: YOLO detection results
            motion_data: Motion detection results
            vehicle_ocr_results: OCR results for vehicles
            whitelist: List of authorized license plates
            blacklist: List of blocked license plates
        
        Returns:
            Processed detection with alerts
        """
        if whitelist is None:
            whitelist = []
        if blacklist is None:
            blacklist = []
        
        timestamp = datetime.utcnow().isoformat()
        
        # Filter high confidence detections
        high_confidence_objects = [
            obj for obj in yolo_detections.get("objects", [])
            if obj["confidence"] >= self.alert_threshold
        ]
        
        # Process vehicles with OCR
        vehicles_with_alerts = self._generate_vehicle_alerts(
            vehicle_ocr_results,
            whitelist,
            blacklist
        )
        
        # Generate overall alerts
        alerts = self._generate_alerts(
            yolo_detections,
            motion_data,
            vehicles_with_alerts
        )
        
        return {
            "timestamp": timestamp,
            "success": yolo_detections.get("success", False),
            "detections": {
                "total_objects": yolo_detections.get("total_detections", 0),
                "high_confidence_objects": len(high_confidence_objects),
                "humans": yolo_detections.get("total_humans", 0),
                "vehicles": yolo_detections.get("total_vehicles", 0),
                "objects": high_confidence_objects
            },
            "motion": {
                "detected": motion_data.get("motion_detected", False),
                "score": motion_data.get("motion_score", 0.0),
                "percentage": motion_data.get("motion_percentage", 0.0)
            },
            "vehicles": vehicles_with_alerts,
            "alerts": alerts,
            "alert_triggered": len(alerts) > 0,
            "image_size": yolo_detections.get("image_size", {})
        }
    
    def _generate_vehicle_alerts(
        self,
        vehicles: List[Dict],
        whitelist: List[str],
        blacklist: List[str]
    ) -> List[Dict]:
        """
        Generate alerts for vehicles based on whitelist/blacklist
        
        Args:
            vehicles: Vehicle detections with license plates
            whitelist: Authorized license plates
            blacklist: Blocked license plates
        
        Returns:
            Vehicle detections with alert status
        """
        results = []
        
        for vehicle in vehicles:
            vehicle_copy = vehicle.copy()
            plate = vehicle.get("license_plate")
            
            if plate:
                if plate in blacklist:
                    vehicle_copy["alert_status"] = "blocked"
                    vehicle_copy["alert_message"] = f"Vehicle on blacklist: {plate}"
                elif plate in whitelist:
                    vehicle_copy["alert_status"] = "authorized"
                    vehicle_copy["alert_message"] = f"Authorized vehicle: {plate}"
                else:
                    vehicle_copy["alert_status"] = "unknown"
                    vehicle_copy["alert_message"] = f"Unknown vehicle: {plate}"
            else:
                vehicle_copy["alert_status"] = "plate_not_found"
                vehicle_copy["alert_message"] = "Unable to read license plate"
            
            results.append(vehicle_copy)
        
        return results
    
    def _generate_alerts(
        self,
        yolo_detections: Dict,
        motion_data: Dict,
        vehicles: List[Dict]
    ) -> List[Dict]:
        """
        Generate alerts based on detections
        
        Args:
            yolo_detections: YOLO results
            motion_data: Motion results
            vehicles: Vehicle results with status
        
        Returns:
            List of alerts
        """
        alerts = []
        
        # Alert for blocked vehicles
        for vehicle in vehicles:
            if vehicle.get("alert_status") == "blocked":
                alerts.append({
                    "type": "blocked_vehicle",
                    "severity": "high",
                    "message": vehicle.get("alert_message"),
                    "license_plate": vehicle.get("license_plate"),
                    "confidence": vehicle.get("confidence")
                })
        
        # Alert for unknown vehicles
        for vehicle in vehicles:
            if vehicle.get("alert_status") == "unknown":
                alerts.append({
                    "type": "unknown_vehicle",
                    "severity": "medium",
                    "message": vehicle.get("alert_message"),
                    "license_plate": vehicle.get("license_plate"),
                    "confidence": vehicle.get("confidence")
                })
        
        # Alert for unidentified vehicles (no plate)
        for vehicle in vehicles:
            if vehicle.get("alert_status") == "plate_not_found":
                alerts.append({
                    "type": "unidentified_vehicle",
                    "severity": "low",
                    "message": vehicle.get("alert_message"),
                    "confidence": vehicle.get("confidence")
                })
        
        # Alert for significant motion without objects
        if motion_data.get("motion_detected") and \
           yolo_detections.get("total_detections", 0) == 0:
            alerts.append({
                "type": "motion_detected",
                "severity": "low",
                "message": f"Motion detected (score: {motion_data.get('motion_score', 0)})"
            })
        
        return alerts
    
    def encode_frame_to_base64(self, frame: np.ndarray) -> str:
        """
        Encode frame to base64 for transmission
        
        Args:
            frame: Image frame
        
        Returns:
            Base64 encoded image string
        """
        try:
            _, buffer = cv2.imencode('.jpg', frame)
            img_str = base64.b64encode(buffer).decode()
            return img_str
        except Exception as e:
            logger.error(f"Error encoding frame: {e}")
            return ""
    
    def set_alert_threshold(self, threshold: float):
        """Update alert confidence threshold"""
        self.alert_threshold = max(0.0, min(1.0, threshold))
        logger.info(f"Alert threshold set to {self.alert_threshold}")


# Global processor instance
_processor = None


def get_processor() -> DetectionProcessor:
    """Get or create global processor instance"""
    global _processor
    if _processor is None:
        _processor = DetectionProcessor()
    return _processor
