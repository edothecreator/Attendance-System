"""
Optimized Face Recognition Engine.
- Pre-loads model once at startup (no repeated loading)
- Uses numpy vectorized operations for fast batch comparison
- Caches embeddings in memory for instant matching
"""
import numpy as np
from threading import Lock

_engine_lock = Lock()
_model_loaded = False


def _ensure_model():
    """Pre-load the Facenet512 model on first use (cached after)."""
    global _model_loaded
    if not _model_loaded:
        from deepface import DeepFace
        # Trigger model download/load by running a dummy represent
        dummy = np.zeros((160, 160, 3), dtype=np.uint8)
        try:
            DeepFace.represent(img_path=dummy, model_name="Facenet512", enforce_detection=False, detector_backend="skip")
        except Exception:
            pass
        _model_loaded = True


def extract_embedding_fast(img_array: np.ndarray) -> np.ndarray:
    """
    Extract embedding from a full image. DeepFace handles detection + alignment.
    Uses MTCNN with fallback to skip (for enrollment photos that are already face-only).
    """
    from deepface import DeepFace
    _ensure_model()

    # Try MTCNN first
    try:
        result = DeepFace.represent(
            img_path=img_array,
            model_name="Facenet512",
            enforce_detection=True,
            detector_backend="mtcnn",
        )
        return np.array(result[0]["embedding"], dtype=np.float32)
    except Exception:
        pass

    # Fallback: try opencv
    try:
        result = DeepFace.represent(
            img_path=img_array,
            model_name="Facenet512",
            enforce_detection=True,
            detector_backend="opencv",
        )
        return np.array(result[0]["embedding"], dtype=np.float32)
    except Exception:
        pass

    # Last resort: skip detection (assume whole image is a face)
    result = DeepFace.represent(
        img_path=img_array,
        model_name="Facenet512",
        enforce_detection=False,
        detector_backend="skip",
    )
    return np.array(result[0]["embedding"], dtype=np.float32)


def extract_faces_from_frame_fast(frame: np.ndarray) -> list[np.ndarray]:
    """
    Extract all face embeddings from a video frame.
    Optimized: uses MTCNN, filters by face size, returns float32 for fast math.
    """
    from deepface import DeepFace
    _ensure_model()

    try:
        results = DeepFace.represent(
            img_path=frame,
            model_name="Facenet512",
            enforce_detection=False,
            detector_backend="mtcnn",
        )
        embeddings = []
        for r in results:
            area = r.get("facial_area", {})
            w = area.get("w", 0)
            h = area.get("h", 0)
            if w >= 40 and h >= 40:
                embeddings.append(np.array(r["embedding"], dtype=np.float32))
        return embeddings
    except Exception:
        return []


class FastMatcher:
    """
    Vectorized batch matching engine.
    Pre-computes a numpy matrix of all stored embeddings for instant comparison.
    """

    def __init__(self, stored_embeddings: list[dict], threshold: float = 0.6):
        self.threshold = threshold
        self.students = []  # list of {student_id, name, student_ref}
        self.student_indices = {}  # student_ref -> list of row indices in matrix

        if not stored_embeddings:
            self.matrix = np.zeros((0, 512), dtype=np.float32)
            return

        # Build embedding matrix and index
        vectors = []
        for i, emb in enumerate(stored_embeddings):
            ref = emb["student_ref"]
            vectors.append(np.array(emb["embedding"], dtype=np.float32))
            self.students.append({
                "student_id": emb["student_id"],
                "name": emb["name"],
                "student_ref": ref,
            })
            if ref not in self.student_indices:
                self.student_indices[ref] = []
            self.student_indices[ref].append(i)

        self.matrix = np.array(vectors, dtype=np.float32)
        # Normalize all stored embeddings for fast cosine via dot product
        norms = np.linalg.norm(self.matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1
        self.matrix_normalized = self.matrix / norms

    def find_match(self, query_embedding: np.ndarray) -> dict | None:
        """
        Find the best matching student using vectorized cosine similarity.
        ~100x faster than looping in Python.
        """
        if len(self.matrix) == 0:
            return None

        # Normalize query
        query = np.array(query_embedding, dtype=np.float32)
        norm = np.linalg.norm(query)
        if norm == 0:
            return None
        query_normalized = query / norm

        # Compute cosine similarity against ALL embeddings at once (single matrix multiply)
        similarities = self.matrix_normalized @ query_normalized

        # Group by student — find best score per student
        student_best: dict[str, tuple[float, int]] = {}
        for i, sim in enumerate(similarities):
            ref = self.students[i]["student_ref"]
            if ref not in student_best or sim > student_best[ref][0]:
                student_best[ref] = (float(sim), i)

        if not student_best:
            return None

        # Sort by score
        sorted_students = sorted(student_best.items(), key=lambda x: x[1][0], reverse=True)
        best_ref, (best_score, best_idx) = sorted_students[0]

        if best_score < self.threshold:
            return None

        # Margin check between different students
        if len(sorted_students) > 1:
            _, (second_score, _) = sorted_students[1]
            if second_score > self.threshold and (best_score - second_score) < 0.03:
                return None

        return {
            "student_id": self.students[best_idx]["student_id"],
            "name": self.students[best_idx]["name"],
            "student_ref": best_ref,
            "confidence": best_score,
        }
