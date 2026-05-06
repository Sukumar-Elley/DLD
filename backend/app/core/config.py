# pyre-ignore-all-errors
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "LeakShield"
    DEBUG: bool = True
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    MAX_FILE_SIZE_MB: int = 500
    UPLOAD_DIR: str = "uploads"
    CORRELATION_THRESHOLD: float = 0.95
    MUTUAL_INFO_THRESHOLD: float = 0.85
    SEVERITY_HIGH: float = 0.75
    SEVERITY_MEDIUM: float = 0.50
    SEVERITY_LOW: float = 0.25

    class Config:
        env_file = ".env"

settings = Settings()
