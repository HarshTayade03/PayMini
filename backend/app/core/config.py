from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_PORT: int = 8000
    SECRET_KEY: str = "dev_secret_key_needs_to_be_at_least_32_chars_long!"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # PostgreSQL Database URL
    DATABASE_URL: str = "postgresql+psycopg://wallet_user:wallet_password_local_dev@localhost:5432/wallet_db"

    # Business Rules & Minor Units (100 paise = ₹1.00)
    STARTING_BALANCE_PAISE: int = 50000        # ₹500.00
    TOPUP_MAX_PER_REQUEST_PAISE: int = 100000  # ₹1,000.00
    TOPUP_MAX_DAILY_PAISE: int = 500000        # ₹5,000.00
    TRANSFER_MAX_PER_TX_PAISE: int = 200000    # ₹2,000.00
    DEFAULT_CURRENCY: str = "INR"

    # Rate Limiting
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 60

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
