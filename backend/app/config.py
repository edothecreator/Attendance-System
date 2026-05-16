from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://attendai:attendai_secret@localhost:5432/attendai"
    redis_url: str = "redis://localhost:6379/0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    cors_origins: str = "http://localhost:5173"
    face_match_threshold: float = 0.6
    frame_extraction_fps: int = 3
    upload_dir: str = "./uploads"
    app_url: str = "https://localhost:5173"  # Frontend URL for QR codes

    # SMTP for email alerts
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "attendai@fst-marrakech.ac.ma"

    class Config:
        env_file = ".env"


settings = Settings()
