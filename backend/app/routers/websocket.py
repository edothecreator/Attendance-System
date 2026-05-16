from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json

router = APIRouter()

# Shared instance - imported by workers
manager = None


def get_manager():
    global manager
    if manager is None:
        manager = ConnectionManager()
    return manager


class ConnectionManager:
    """Manages WebSocket connections per session."""

    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: dict):
        """Send a message to all clients connected to a session."""
        if session_id in self.active_connections:
            payload = json.dumps(message)
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_text(payload)
                except Exception:
                    pass

    async def send_status(self, session_id: str, status: str, progress: int = 0):
        await self.broadcast(session_id, {
            "type": "status",
            "data": {"status": status, "progress": progress},
        })

    async def send_match(self, session_id: str, name: str, student_id: str, confidence: float):
        await self.broadcast(session_id, {
            "type": "match",
            "data": {"name": name, "student_id": student_id, "confidence": round(confidence, 3)},
        })

    async def send_complete(self, session_id: str, total_identified: int, total_frames: int):
        await self.broadcast(session_id, {
            "type": "complete",
            "data": {"total_identified": total_identified, "total_frames": total_frames},
        })


# Singleton manager instance
ws_manager = ConnectionManager()


@router.websocket("/ws/session/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await ws_manager.connect(session_id, websocket)
    try:
        while True:
            # Keep connection alive, wait for client messages (ping/pong)
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(session_id, websocket)
