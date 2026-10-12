from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def now():
    return datetime.now(UTC)


def iso(value=None):
    return (value or now()).replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")


def uid():
    return str(uuid4())


class Base(DeclarativeBase):
    pass


settings().data_dir.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    settings().database_url,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False}
    if settings().database_url.startswith("sqlite")
    else {},
)
if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def sqlite_settings(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=10000")


SessionLocal = sessionmaker(engine, expire_on_commit=False)


def db_session():
    with SessionLocal() as db:
        yield db
