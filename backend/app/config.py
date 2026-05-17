from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings

SCENARIOS_DIR = Path(__file__).parent.parent.parent / "data" / "big-mock-data" / "generated" / "scenarios"
VALID_SCENARIOS = {"noisy", "compromised", "secured"}


class Settings(BaseSettings):
    data_source: str = "mock"
    mock_scenario: str = "noisy"
    cache_refresh_seconds: int = 300  # 5 min; set 0 to disable
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""
    azure_subscription_id: str = ""
    frontend_origin: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
