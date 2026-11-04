"""Runtime settings, all read from environment variables (never hard-coded)."""
import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.env = os.getenv("ZENTY_ENV", "development")  # development | production
        self.is_prod = self.env == "production"

        # Public URL of the app (frontend + /api on the same origin).
        self.app_url = os.getenv("APP_URL", "http://localhost:5173").rstrip("/")

        db_url = os.getenv("DATABASE_URL", "sqlite:///./zenty-dev.db")
        # Neon / Supabase / Vercel hand out postgres:// URLs; SQLAlchemy needs a driver.
        if db_url.startswith("postgres://"):
            db_url = "postgresql+psycopg://" + db_url[len("postgres://"):]
        elif db_url.startswith("postgresql://"):
            db_url = "postgresql+psycopg://" + db_url[len("postgresql://"):]
        self.database_url = db_url

        # Fernet key used to encrypt bank access tokens at rest.
        # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
        self.encryption_key = os.getenv("ZENTY_ENCRYPTION_KEY", "")

        self.cookie_secure = _bool("COOKIE_SECURE", self.is_prod)
        self.session_days = int(os.getenv("SESSION_DAYS", "7"))

        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")

        self.resend_api_key = os.getenv("RESEND_API_KEY", "")
        self.email_from = os.getenv("EMAIL_FROM", "Zenty <onboarding@resend.dev>")

        self.plaid_client_id = os.getenv("PLAID_CLIENT_ID", "")
        self.plaid_secret = os.getenv("PLAID_SECRET", "")
        self.plaid_env = os.getenv("PLAID_ENV", "sandbox")  # sandbox | production

        # SMS codes for two-step sign-in (Twilio).
        self.twilio_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.twilio_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.twilio_from = os.getenv("TWILIO_FROM_NUMBER", "")

        # Shared secret that the scheduled job (Vercel Cron) must present.
        self.cron_secret = os.getenv("CRON_SECRET", "")

    @property
    def sms_enabled(self) -> bool:
        return bool(self.twilio_sid and self.twilio_token and self.twilio_from)

    def validate(self) -> None:
        """Refuse to start in production with unsafe settings."""
        if not self.is_prod:
            return
        problems = []
        if not self.encryption_key:
            problems.append("ZENTY_ENCRYPTION_KEY is required")
        if self.database_url.startswith("sqlite"):
            problems.append("DATABASE_URL must point at Postgres in production")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE must be true in production")
        if not self.app_url.startswith("https://"):
            problems.append("APP_URL must be https in production")
        if problems:
            raise RuntimeError("Unsafe production config: " + "; ".join(problems))


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.validate()
    return s
