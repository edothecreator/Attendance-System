import numpy as np
from collections import defaultdict

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
    Find the best matching STUDENT (not embedding) for a query embedding.
    
    Since we store multiple embeddings per student, we need to:
    1. Find the best score per STUDENT (not per embedding)
    2. Return the student with the highest best-match score
    3. Only apply margin check between DIFFERENT students
    """
    if threshold is None:
        threshold = settings.face_match_threshold

    query_vec = np.array(query_embedding, dtype=np.float64)

    # Group scores by student
    student_scores: dict[str, dict] = {}  # student_ref -> {best_score, info}

    for stored in stored_embeddings:
        stored_vec = np.array(stored["embedding"], dtype=np.float64)
        score = cosine_similarity(query_vec, stored_vec)

        ref = stored["student_ref"]
        if ref not in student_scores or score > student_scores[ref]["score"]:
            student_scores[ref] = {
                "score": score,
                "student_id": stored["student_id"],
                "name": stored["name"],
                "student_ref": ref,
            }

    if not student_scores:
        return None

    # Sort students by their best score
    sorted_students = sorted(student_scores.values(), key=lambda x: x["score"], reverse=True)

    best = sorted_students[0]
    if best["score"] < threshold:
        return None

    # Margin check: only between different students (not between embeddings of same student)
    if len(sorted_students) > 1:
        second_best = sorted_students[1]
        margin = best["score"] - second_best["score"]
        # Only reject if second-best is also above threshold AND margin is tiny
        if second_best["score"] > threshold and margin < 0.03:
            return None

    return {
        "student_id": best["student_id"],
        "name": best["name"],
        "student_ref": best["student_ref"],
        "confidence": best["score"],
    }
