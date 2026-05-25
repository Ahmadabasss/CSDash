from pathlib import Path

from .config import SCENARIOS_DIR, get_settings
from .services.base import DataSource
from .services.mock import MockDataSource

_instance: DataSource | None = None
_current_scenario: str = "noisy"


def get_data_source() -> DataSource:
    global _instance, _current_scenario
    if _instance is None:
        settings = get_settings()
        if settings.data_source == "mock":
            _current_scenario = settings.mock_scenario
            _instance = MockDataSource(data_dir=_scenario_path(_current_scenario))
        elif settings.data_source == "sql":
            from .services.sql import SqlDataSource
            _instance = SqlDataSource(
                connection_string=settings.sql_connection_string,
            )
        else:
            raise NotImplementedError(
                f"Unknown DATA_SOURCE='{settings.data_source}'. Valid values: mock, sql"
            )
    return _instance


def switch_scenario(scenario: str) -> None:
    global _instance, _current_scenario
    _instance = MockDataSource(data_dir=_scenario_path(scenario))
    _current_scenario = scenario


def current_scenario() -> str:
    return _current_scenario


def _scenario_path(scenario: str) -> Path:
    path = SCENARIOS_DIR / scenario
    if not path.exists():
        raise FileNotFoundError(f"Scenario directory not found: {path}")
    return path
