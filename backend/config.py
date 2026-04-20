# Copyright (c) 2026 Vilhelm Hilding. MIT License.
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV), extra="ignore")

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    max_tokens: int = 5000
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    secret_key: str = "change-me-in-production-use-a-long-random-string"


settings = Settings()
