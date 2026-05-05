"""License plate OCR detection module"""
import cv2
import numpy as np
import pytesseract
from typing import Optional, Dict, List, Tuple
from config.settings import TESSERACT_PATH
import logging
import re

logger = logging.getLogger(__name__)

if TESSERACT_PATH:
    pytesseract.pytesseract.pytesseract_cmd = TESSERACT_PATH


class LicensePlateOCR:
    """Extract and recognize license plate text from vehicle regions"""
    
    def __init__(self):
        """Initialize OCR detector"""
        self.plate_pattern = re.compile(r'[A-Z0-9]{2,}')  # Matches license plates
        logger.info("License Plate OCR initialized")
    
    def detect_and_extract(
        self, 
        image: np.ndarray, 
        vehicle_bbox: Dict
    ) -> Optional[str]:
        """
        Extract license plate text from vehicle region
        
        Args:
            image: Full image
            vehicle_bbox: Vehicle bounding box dict with x1, y1, x2, y2
        
        Returns:
            Extracted license plate text or None
        """
        try:
            # Crop vehicle region
            x1, y1, x2, y2 = (
                vehicle_bbox["x1"],
                vehicle_bbox["y1"],
                vehicle_bbox["x2"],
                vehicle_bbox["y2"]
            )
            
            # Add margins to crop (license plates typically in lower half)
            crop_height = y2 - y1
            crop_y1 = max(0, int(y1 + crop_height * 0.6))
            crop_y2 = y2
            
            vehicle_crop = image[crop_y1:crop_y2, x1:x2]
            
            if vehicle_crop.size == 0:
                return None
            
            # Preprocess for OCR
            processed = self._preprocess_image(vehicle_crop)
            
            # Extract text
            plate_text = pytesseract.image_to_string(
                processed,
                config='--psm 8 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            ).strip().upper()
            
            # Validate and clean
            if self._is_valid_plate(plate_text):
                return plate_text
            
            return None
        
        except Exception as e:
            logger.warning(f"OCR extraction error: {e}")
            return None
    
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR accuracy"""
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Increase contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrast = clahe.apply(gray)
        
        # Threshold
        _, binary = cv2.threshold(contrast, 150, 255, cv2.THRESH_BINARY)
        
        # Denoise
        denoised = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
        
        # Upscale for better OCR
        upscaled = cv2.resize(denoised, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        
        return upscaled
    
    def _is_valid_plate(self, text: str) -> bool:
        """Validate if text looks like a license plate"""
        if not text or len(text) < 2:
            return False
        
        # Should contain alphanumeric characters
        if not re.search(r'[A-Z0-9]', text):
            return False
        
        # Remove spaces and special characters for final validation
        cleaned = re.sub(r'[^A-Z0-9]', '', text)
        
        return len(cleaned) >= 3
    
    def batch_extract_from_vehicles(
        self,
        image: np.ndarray,
        vehicle_detections: List[Dict]
    ) -> List[Dict]:
        """
        Extract license plates from multiple vehicles
        
        Args:
            image: Full image
            vehicle_detections: List of vehicle detection dicts
        
        Returns:
            List of vehicle detections with license plate text added
        """
        results = []
        
        for vehicle in vehicle_detections:
            vehicle_copy = vehicle.copy()
            
            plate_text = self.detect_and_extract(image, vehicle["bbox"])
            vehicle_copy["license_plate"] = plate_text
            
            results.append(vehicle_copy)
        
        return results


# Global OCR instance
_ocr_instance = None


def get_ocr() -> LicensePlateOCR:
    """Get or create global OCR instance"""
    global _ocr_instance
    if _ocr_instance is None:
        _ocr_instance = LicensePlateOCR()
    return _ocr_instance
