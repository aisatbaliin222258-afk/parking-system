"""Motion detection module for frame-to-frame movement analysis"""
import cv2
import numpy as np
from typing import Dict, Optional, Tuple
from collections import deque
from config.settings import MOTION_SENSITIVITY, MOTION_THRESHOLD
import logging

logger = logging.getLogger(__name__)


class MotionDetector:
    """Detect motion and movement in video frames"""
    
    def __init__(self, sensitivity: float = MOTION_SENSITIVITY):
        """
        Initialize motion detector
        
        Args:
            sensitivity: Motion detection sensitivity (0-1, higher = more sensitive)
        """
        self.sensitivity = max(0.01, min(1.0, sensitivity))
        self.prev_frame = None
        self.motion_history = deque(maxlen=30)
        logger.info(f"Motion detector initialized with sensitivity: {self.sensitivity}")
    
    def detect_motion(self, frame: np.ndarray) -> Dict:
        """
        Detect motion in current frame compared to previous frame
        
        Args:
            frame: Current video frame
        
        Returns:
            Dictionary with motion detection results
        """
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (21, 21), 0)
            
            if self.prev_frame is None:
                self.prev_frame = blurred
                return {
                    "motion_detected": False,
                    "motion_score": 0.0,
                    "motion_percentage": 0.0,
                    "changed_pixels": 0
                }
            
            # Compute difference between frames
            frame_diff = cv2.absdiff(self.prev_frame, blurred)
            
            # Apply threshold
            _, threshold = cv2.threshold(
                frame_diff,
                int(255 * (1 - self.sensitivity)),
                255,
                cv2.THRESH_BINARY
            )
            
            # Dilate to fill gaps
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
            dilated = cv2.dilate(threshold, kernel, iterations=2)
            
            # Count changed pixels
            changed_pixels = cv2.countNonZero(dilated)
            total_pixels = frame.shape[0] * frame.shape[1]
            motion_percentage = (changed_pixels / total_pixels) * 100
            
            # Calculate motion score (0-1)
            motion_score = min(1.0, motion_percentage / 10.0)
            
            # Determine if significant motion detected
            motion_detected = changed_pixels > MOTION_THRESHOLD
            
            # Update history
            self.motion_history.append({
                "score": motion_score,
                "detected": motion_detected,
                "changed_pixels": changed_pixels
            })
            
            self.prev_frame = blurred
            
            return {
                "motion_detected": motion_detected,
                "motion_score": round(motion_score, 3),
                "motion_percentage": round(motion_percentage, 2),
                "changed_pixels": changed_pixels,
                "total_pixels": total_pixels,
                "average_motion_score": self._get_average_motion_score()
            }
        
        except Exception as e:
            logger.error(f"Motion detection error: {e}")
            self.prev_frame = None
            return {
                "motion_detected": False,
                "motion_score": 0.0,
                "motion_percentage": 0.0,
                "error": str(e)
            }
    
    def _get_average_motion_score(self) -> float:
        """Get average motion score from history"""
        if not self.motion_history:
            return 0.0
        return round(
            sum(h["score"] for h in self.motion_history) / len(self.motion_history),
            3
        )
    
    def reset(self):
        """Reset motion detector state"""
        self.prev_frame = None
        self.motion_history.clear()
        logger.info("Motion detector reset")
    
    def get_motion_region(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """
        Get mask of moving regions
        
        Args:
            frame: Current video frame
        
        Returns:
            Binary mask of moving regions or None
        """
        if self.prev_frame is None:
            return None
        
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (21, 21), 0)
            
            frame_diff = cv2.absdiff(self.prev_frame, blurred)
            _, threshold = cv2.threshold(
                frame_diff,
                int(255 * (1 - self.sensitivity)),
                255,
                cv2.THRESH_BINARY
            )
            
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
            dilated = cv2.dilate(threshold, kernel, iterations=2)
            
            return dilated
        
        except Exception as e:
            logger.error(f"Error getting motion region: {e}")
            return None


# Global detector instance
_motion_detector = None


def get_motion_detector() -> MotionDetector:
    """Get or create global motion detector instance"""
    global _motion_detector
    if _motion_detector is None:
        _motion_detector = MotionDetector()
    return _motion_detector
