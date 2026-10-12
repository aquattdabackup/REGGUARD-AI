import os
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

root = Path(__file__).resolve().parents[3]
(root / ".data").mkdir(exist_ok=True)
os.environ["DEMO_MODE"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///" + str(
    root / ".data" / ("test-" + uuid4().hex + ".db")
).replace("\\", "/")
os.environ["APP_ENV"] = "development"

from app.core.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app, rate_windows  # noqa: E402
from app.models import entities  # noqa: E402, F401


@pytest.fixture
def client():
    rate_windows.clear()
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    with TestClient(app) as client:
        yield client


@pytest.fixture
def session(client):
    response = client.post("/api/v1/demo/session")
    assert response.status_code == 201, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}
