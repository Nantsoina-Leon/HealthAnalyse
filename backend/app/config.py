from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "MadaDoc AI"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    GEMINI_API_KEY: str
    DATABASE_URL: str  # URL stricte sans valeur par défaut SQLite

    # Corrige automatiquement l'URL de Render (postgres:// -> postgresql://)
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_postgres_url(cls, value: str) -> str:
        if value and value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql://", 1)
        return value

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()