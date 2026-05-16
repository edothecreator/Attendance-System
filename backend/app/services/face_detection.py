import numpy as np
from PIL import Image
from io import BytesIO

# Detector backend: mtcnn is more accurate than opencv for varied poses/lighting
DETECTOR_BACKEND = "mtcnn"


def load_image(image_bytes: bytes) -> np.ndarray:
    """Load image bytes into a numpy array (RGB)."""
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    return np.array(image)


def validate_single_face(image_bytes: bytes) -> np.ndarray:
    """
    Validate that at least one face exists in the image.
    Uses MTCNN which is much better at detecting faces at angles.

    Args:
        image_bytes: Raw image bytes (JPEG/PNG)

    Returns:
        Image as numpy array (RGB) - full image, not cropped

    Raises:
        ValueError: If no face is detected.
    """
    from deepface import DeepFace

    img_array = load_image(image_bytes)

    try:
        faces = DeepFace.extract_faces(
            img_path=img_array,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=True,
        )
    except ValueError:
        raise ValueError("No face detected in the image.")

    if len(faces) == 0:
        raise ValueError("No face detected in the image.")

    return img_array
