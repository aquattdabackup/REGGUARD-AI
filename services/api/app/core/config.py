import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(os.environ.get("REGGUARD_ROOT", Path(__file__).resolve().parents[4])).resolve()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    app_env: str = "development"
    demo_mode: bool = False
    database_url: str = "sqlite:///./.data/regguard.db"
    app_origin: str = "http://localhost:3000"
    data_dir: Path = ROOT / ".data"
    supabase_url: str = ""
    supabase_secret_key: str = ""
    supabase_service_role_key: str = ""  # Legacy JWT key, accepted during migration.
    supabase_storage_bucket: str = "evidence"
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    openai_max_output_tokens: int = 3000
    ai_monthly_budget_usd: float = 5
    ai_input_usd_per_million: float = 0.40
    ai_output_usd_per_million: float = 1.60
    evm_rpc_url: str = ""
    evm_chain_id: int = 11155111
    audit_registry_address: str = ""
    anchor_signer_private_key: str = ""
    cre_mode: str = "unavailable"
    max_upload_bytes: int = 10 * 1024 * 1024
    max_documents_per_case: int = 5
    max_pages: int = 100
    max_text_chars: int = 100_000
    lease_seconds: int = 300

    def validate_runtime(self):
        if self.demo_mode and self.app_env != "development":
            raise RuntimeError("Demo authentication is restricted to development")
        if not self.demo_mode and (not self.supabase_url or self.database_url.startswith("sqlite")):
            raise RuntimeError(
                "Live mode requires Supabase Auth and PostgreSQL; use DEMO_MODE=true for local fixtures"
            )


@lru_cache
def settings():
    return Settings()
