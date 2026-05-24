from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings

SCENARIOS_DIR = Path(__file__).parent.parent.parent / "data" / "big-mock-data" / "generated" / "scenarios"
VALID_SCENARIOS = {"noisy", "compromised", "secured"}


class Settings(BaseSettings):
    data_source: str = "sql"
    mock_scenario: str = "noisy"
    # Full ODBC connection string — copy from Azure Portal → SQL Database → Connection strings → ODBC
    sql_connection_string: str = ""
    frontend_origin: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
