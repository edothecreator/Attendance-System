import numpy as np

from app.config import settings


def cosine_similarity(embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
    """Compute cosine similarity between two embeddings."""
    norm_a = np.linalg.norm(embedding_a)
    norm_b = np.linalg.norm(embedding_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(embedding_a, embedding_b) / (norm_a * norm_b))


def find_best_match(
    query_embedding: np.ndarray,
    stored_embeddings: list[dict],
    threshold: float = None,
) -> dict | None:
    """
    Find the best matching student for a query embedding.
    Uses cosine similarity only — simple and reliable.

    A match must exceed the threshold AND be the clear best match.

    Args:
        query_embedding: 512-d face embedding to identify
        stored_embeddings: List of dicts with keys: 'student_id', 'name', 'student_ref', 'embedding'
        threshold: Minimum cosine similarity (default from settings)

    Returns:
        Dict with match info or None if no match above threshold
    """
    if threshold is None:
        threshold = settings.face_match_threshold

    best_match = None
    best_score = -1.0
    second_best_score = -1.0

    query_vec = np.array(query_embedding, dtype=np.float64)

    for stored in stored_embeddings:
        stored_vec = np.array(stored["embedding"], dtype=np.float64)
        score = cosine_similarity(query_vec, stored_vec)

        if score > best_score:
            second_best_score = best_score
            best_score = score
            best_match = stored
        elif score > second_best_score:
            second_best_score = score

    if best_match is None or best_score < threshold:
        return None

    # Require a clear margin between best and second-best to avoid false positives
    # If two people score similarly, it's ambiguous — reject
    margin = best_score - second_best_score
    if second_best_score > 0.3 and margin < 0.05:
        return None

    return {
        "student_id": best_match["student_id"],
        "name": best_match["name"],
        "student_ref": best_match["student_ref"],
        "confidence": best_score,
    }
