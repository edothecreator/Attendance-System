from typing import Generator
import cv2
import numpy as np

from app.config import settings


def extract_frames(video_path: str, fps: int = None) -> Generator[tuple[int, float, np.ndarray], None, None]:
    """
    Extract frames from a video at a specified rate.
    Applies preprocessing to improve face detection in video frames.

    Args:
        video_path: Path to the video file
        fps: Frames per second to extract (default from settings)

    Yields:
        Tuple of (frame_number, timestamp_seconds, frame_array_rgb)
    """
    if fps is None:
        fps = settings.frame_extraction_fps

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video file: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Browser-recorded WebM often reports wrong FPS (0, 1000, etc.)
    # Detect and fix unreliable FPS
    if video_fps <= 0 or video_fps > 120:
        # Estimate real FPS from frame count and duration
        if total_frames > 0:
            # Assume ~30fps for browser recordings
            video_fps = 30.0
        else:
            video_fps = 30.0

    frame_interval = max(1, int(video_fps / fps))

    frame_count = 0
    extracted_count = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % frame_interval == 0:
                # Preprocess frame for better face detection
                processed = preprocess_frame(frame)
                timestamp = frame_count / video_fps
                yield extracted_count, timestamp, processed
                extracted_count += 1

            frame_count += 1
    finally:
        cap.release()


def preprocess_frame(frame: np.ndarray) -> np.ndarray:
    """
    Preprocess a video frame to improve face detection.
    - Convert BGR to RGB
    - Auto-adjust brightness/contrast if too dark
    - Upscale small frames
    """
    # Convert BGR to RGB
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # If frame is too small, upscale (faces need to be at least ~80px for good detection)
    h, w = frame_rgb.shape[:2]
    if max(h, w) < 640:
        scale = 640 / max(h, w)
        frame_rgb = cv2.resize(frame_rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Auto brightness/contrast adjustment if image is too dark
    gray = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2GRAY)
    mean_brightness = gray.mean()
    if mean_brightness < 80:
        # Image is dark, apply CLAHE (adaptive histogram equalization)
        lab = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2LAB)
        l_channel = lab[:, :, 0]
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(l_channel)
        frame_rgb = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
    elif mean_brightness < 120:
        # Slightly dark, gentle brightness boost
        frame_rgb = cv2.convertScaleAbs(frame_rgb, alpha=1.2, beta=10)

    return frame_rgb


def get_video_info(video_path: str) -> dict:
    """Get basic video metadata."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video file: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Fix unreliable FPS from browser recordings
    if fps <= 0 or fps > 120:
        fps = 30.0

    info = {
        "fps": fps,
        "frame_count": frame_count,
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
    }
    info["duration_sec"] = frame_count / fps if fps > 0 else 0
    cap.release()
    return info
