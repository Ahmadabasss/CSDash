from pathlib import Path

from .config import SCENARIOS_DIR, get_settings
from .services.base import DataSource
from .services.mock import MockDataSource

# Module-level singleton — replaced by the scenario switcher at runtime.
_instance: DataSource | None = None
_current_scenario: str = "noisy"


def get_data_source() -> DataSource:
    global _instance, _current_scenario
    if _instance is None:
        settings = get_settings()
        if settings.data_source == "mock":
            _current_scenario = settings.mock_scenario
            _instance = MockDataSource(data_dir=_scenario_path(_current_scenario))
        else:
            raise NotImplementedError(
                "AzureDataSource not yet implemented — set DATA_SOURCE=mock "
                "or implement app/services/azure.py"
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
