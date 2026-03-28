from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

ROOT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Virtual Security Officer"
    environment: str = "development"
    debug: bool = True

    database_url: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/virtual_security_officer"
    )
    redis_url: str = "redis://localhost:6379/0"

    supabase_url: str = "https://your-project.supabase.co"
    supabase_anon_key: str = "your-supabase-anon-key"
    supabase_service_key: str = "your-supabase-service-key"

    gemini_api_key: str = "your-gemini-api-key"
    # 1.5-flash usually has free-tier quota; 2.0-flash may show limit 0 on free tier in some projects.
    gemini_model: str = "gemini-1.5-flash"
    resend_api_key: str = "your-resend-api-key"
    # Resend test sender (no domain verification). Override when your domain is verified in Resend.
    resend_from_address: str = "Virtual Security Officer <onboarding@resend.dev>"
    public_app_url: str = "http://localhost:3000"
    secret_key: str = "change-me-in-production"


settings = Settings()
