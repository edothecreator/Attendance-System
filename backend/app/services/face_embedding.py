import numpy as np
from deepface import DeepFace


def extract_embedding_from_image(img_array: np.ndarray) -> np.ndarray:
    """
    Extract a 512-dimensional face embedding using Facenet512.
    Tries multiple detector backends for maximum compatibility.

    Args:
        img_array: Full image as numpy array (RGB)

    Returns:
        512-dimensional embedding vector as numpy array
    """
    backends = ["mtcnn", "opencv", "ssd"]

    for backend in backends:
        try:
            result = DeepFace.represent(
                img_path=img_array,
                model_name="Facenet512",
                enforce_detection=True,
                detector_backend=backend,
            )
            return np.array(result[0]["embedding"])
        except Exception:
            continue

    # Last resort: skip detection entirely (assume the whole image is a face)
    result = DeepFace.represent(
        img_path=img_array,
        model_name="Facenet512",
        enforce_detection=False,
        detector_backend="skip",
    )
    return np.array(result[0]["embedding"])


def extract_embedding_from_face(face_pixels: np.ndarray) -> np.ndarray:
    """
    Extract embedding from an already-detected face crop.
    Used during video identification where faces are already extracted.

    Args:
        face_pixels: Cropped face as numpy array (RGB), already aligned by DeepFace

    Returns:
        512-dimensional embedding vector
    """
    # Resize to what Facenet512 expects (160x160)
    from PIL import Image

    img = Image.fromarray(face_pixels)
    img = img.resize((160, 160))
    face_resized = np.array(img)

    result = DeepFace.represent(
        img_path=face_resized,
        model_name="Facenet512",
        enforce_detection=False,
        detector_backend="skip",
    )
    embedding = np.array(result[0]["embedding"])
    return embedding


def average_embeddings(embeddings: list[np.ndarray]) -> np.ndarray:
    """
    Average multiple embeddings and L2-normalize the result.

    Args:
        embeddings: List of 512-d embedding vectors

    Returns:
        Averaged and L2-normalized 512-d vector
    """
    stacked = np.stack(embeddings)
    averaged = np.mean(stacked, axis=0)
    # L2 normalize
    norm = np.linalg.norm(averaged)
    if norm > 0:
        averaged = averaged / norm
    return averaged
