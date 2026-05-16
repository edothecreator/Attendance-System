# AttendAI - Automated Facial Recognition Attendance System

An MVP facial recognition system with two core flows: **Student Enrollment** and **Video Identification**, powered by DeepFace (ArcFace) and MTCNN.

## Tech Stack

- **Backend**: FastAPI (Python)
- **AI Engine**: DeepFace (ArcFace model) + MTCNN detection
- **Database**: PostgreSQL
- **Task Queue**: Redis (via FastAPI BackgroundTasks)
- **Frontend**: React (Vite) + Tailwind CSS
- **Real-time**: WebSocket

## Quick Start

### 1. Start Infrastructure

```bash
cd attend-ai
docker-compose up -d
```

This starts PostgreSQL and Redis.

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create the database tables (first run):
```bash
python -c "
import asyncio
from app.database import engine, Base
from app.models import *
from app.models_session import *

async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

asyncio.run(init())
"
```

Start the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/students/enroll` | Enroll a student with 3-5 face images |
| POST | `/api/sessions/identify` | Upload video for identification |
| GET | `/api/sessions/{id}` | Get session status & results |
| WS | `/ws/session/{id}` | Real-time identification updates |
| GET | `/health` | Health check |

## Architecture

```
React Frontend → FastAPI → MTCNN (detect) → ArcFace (embed) → PostgreSQL (store/match)
                        ↓
                  Background Worker → WebSocket → Frontend Dashboard
```

## Configuration

Environment variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `FACE_MATCH_THRESHOLD` - Cosine similarity threshold (default: 0.8)
- `FRAME_EXTRACTION_FPS` - Frames extracted per second from video (default: 1)
