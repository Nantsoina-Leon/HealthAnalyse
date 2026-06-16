from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "MadaDoc AI"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    GEMINI_API_KEY: str
    DATABASE_URL: str = "sqlite:///./madadoc.db"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()