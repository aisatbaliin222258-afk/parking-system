"""Image processing utilities"""
import cv2
import numpy as np
import base64
import io
from typing import Tuple, Optional
from PIL import Image
import logging

logger = logging.getLogger(__name__)


def load_image_from_base64(base64_str: str) -> Optional[np.ndarray]:
    """
    Load image from base64 string
    
    Args:
        base64_str: Base64 encoded image
    
    Returns:
        Numpy array or None if error
    """
    try:
        img_data = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.error(f"Error decoding base64 image: {e}")
        return None


def load_image_from_file(file_path: str) -> Optional[np.ndarray]:
    """
    Load image from file path
    
    Args:
        file_path: Path to image file
    
    Returns:
        Numpy array or None if error
    """
    try:
        img = cv2.imread(file_path)
        if img is None:
            logger.error(f"Failed to load image: {file_path}")
            return None
        return img
    except Exception as e:
        logger.error(f"Error loading image: {e}")
        return None


def encode_image_to_base64(image: np.ndarray, format: str = 'jpg') -> str:
    """
    Encode image to base64 string
    
    Args:
        image: Numpy array image
        format: Image format ('jpg', 'png')
    
    Returns:
        Base64 encoded string
    """
    try:
        if format.lower() == 'jpg':
            _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 80])
        else:
            _, buffer = cv2.imencode('.png', image)
        
        img_str = base64.b64encode(buffer).decode()
        return img_str
    except Exception as e:
        logger.error(f"Error encoding image: {e}")
        return ""


def resize_image(
    image: np.ndarray,
    width: Optional[int] = None,
    height: Optional[int] = None,
    max_width: int = 1280,
    max_height: int = 720
) -> np.ndarray:
    """
    Resize image to specifications
    
    Args:
        image: Input image
        width: Target width (or None to auto)
        height: Target height (or None to auto)
        max_width: Maximum width
        max_height: Maximum height
    
    Returns:
        Resized image
    """
    try:
        h, w = image.shape[:2]
        
        # If specific dimensions provided
        if width and height:
            return cv2.resize(image, (width, height))
        
        # Scale to max if exceeds
        if w > max_width or h > max_height:
            scale = min(max_width / w, max_height / h)
            new_w = int(w * scale)
            new_h = int(h * scale)
            return cv2.resize(image, (new_w, new_h))
        
        return image
    except Exception as e:
        logger.error(f"Error resizing image: {e}")
        return image


def draw_detections_on_image(
    image: np.ndarray,
    detections: dict,
    draw_humans: bool = True,
    draw_vehicles: bool = True
) -> np.ndarray:
    """
    Draw detection boxes on image
    
    Args:
        image: Input image
        detections: Detection results with objects
        draw_humans: Whether to draw human detections
        draw_vehicles: Whether to draw vehicle detections
    
    Returns:
        Image with drawings
    """
    try:
        result = image.copy()
        
        for obj in detections.get("objects", []):
            class_name = obj.get("class", "unknown")
            confidence = obj.get("confidence", 0)
            bbox = obj.get("bbox", {})
            
            # Skip if we don't want to draw this type
            if class_name == "person" and not draw_humans:
                continue
            if class_name in ["car", "truck", "bus", "motorcycle"] and not draw_vehicles:
                continue
            
            x1, y1, x2, y2 = bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]
            
            # Choose color
            if class_name == "person":
                color = (0, 255, 0)  # Green
            else:
                color = (0, 0, 255)  # Red
            
            # Draw rectangle
            cv2.rectangle(result, (x1, y1), (x2, y2), color, 2)
            
            # Draw label
            label = f"{class_name} {confidence:.2f}"
            cv2.putText(
                result,
                label,
                (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2
            )
        
        return result
    except Exception as e:
        logger.error(f"Error drawing detections: {e}")
        return image


def crop_region(
    image: np.ndarray,
    bbox: dict,
    padding: int = 0
) -> Optional[np.ndarray]:
    """
    Crop region from image using bounding box
    
    Args:
        image: Source image
        bbox: Bounding box dict with x1, y1, x2, y2
        padding: Extra padding around crop
    
    Returns:
        Cropped image or None
    """
    try:
        h, w = image.shape[:2]
        x1 = max(0, bbox["x1"] - padding)
        y1 = max(0, bbox["y1"] - padding)
        x2 = min(w, bbox["x2"] + padding)
        y2 = min(h, bbox["y2"] + padding)
        
        return image[y1:y2, x1:x2]
    except Exception as e:
        logger.error(f"Error cropping region: {e}")
        return None
