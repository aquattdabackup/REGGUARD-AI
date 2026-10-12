from types import SimpleNamespace

import pytest

from app.services import documents


@pytest.mark.parametrize(
    "secret,legacy,expected",
    [
        ("sb_secret_example", "", {"apikey": "sb_secret_example"}),
        ("", "legacy-jwt", {"apikey": "legacy-jwt", "Authorization": "Bearer legacy-jwt"}),
        ("sb_secret_preferred", "legacy-jwt", {"apikey": "sb_secret_preferred"}),
    ],
)
def test_storage_api_key_headers(monkeypatch, secret, legacy, expected):
    monkeypatch.setattr(
        documents,
        "settings",
        lambda: SimpleNamespace(
            supabase_secret_key=secret,
            supabase_service_role_key=legacy,
        ),
    )
    assert documents.Storage().headers() == expected


def test_storage_missing_key_fails_closed(monkeypatch):
    monkeypatch.setattr(
        documents,
        "settings",
        lambda: SimpleNamespace(
            supabase_secret_key="",
            supabase_service_role_key="",
        ),
    )
    with pytest.raises(ValueError, match="STORAGE_NOT_CONFIGURED"):
        documents.Storage().headers()
