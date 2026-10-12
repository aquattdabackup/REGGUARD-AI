import importlib.util
import re
import threading
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pytest

spec = importlib.util.spec_from_file_location(
    "local_setup", Path(__file__).resolve().parents[1] / "local_setup.py"
)
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


def test_save_preserves_unrelated_settings_and_replaces_key(tmp_path):
    target = tmp_path / ".env"
    target.write_text(
        "DEMO_MODE=true\n# keep this\nOPENAI_API_KEY=old\nAI_MONTHLY_BUDGET_USD=2\n"
    )
    key = "sk-" + "test_only" * 3
    setup.save_key(tmp_path, key)
    assert (
        target.read_text()
        == "DEMO_MODE=true\n# keep this\nAI_MONTHLY_BUDGET_USD=2\nOPENAI_API_KEY="
        + key
        + "\n"
    )
    before = target.read_text()
    with pytest.raises(ValueError):
        setup.save_key(tmp_path, key + "\nDEMO_MODE=false")
    assert target.read_text() == before


def test_form_is_write_only_and_refuses_cross_origin(tmp_path):
    server = setup.make_server(tmp_path, 0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:
        with urlopen(origin) as response:
            body = response.read().decode()
            assert response.headers["Cache-Control"] == "no-store"
        csrf = re.search(r'name="csrf" value="([^"]+)"', body).group(1)
        key = "sk-" + "fixture_only" * 3
        data = urlencode({"csrf": csrf, "key": key}).encode()
        for headers in [
            {"Origin": "https://evil.example"},
            {"Origin": origin, "Host": "evil.example"},
        ]:
            with pytest.raises(HTTPError) as error:
                urlopen(Request(origin + "/save", data=data, headers=headers))
            assert error.value.code == 403
        assert not (tmp_path / ".env").exists()
        with pytest.raises(HTTPError) as error:
            urlopen(
                Request(
                    origin + "/save",
                    data=urlencode({"csrf": "wrong", "key": key}).encode(),
                    headers={"Origin": origin},
                )
            )
        assert error.value.code == 403
        with urlopen(
            Request(origin + "/save", data=data, headers={"Origin": origin})
        ) as response:
            assert response.status == 200
            assert key not in response.read().decode()
        assert key in (tmp_path / ".env").read_text()
        with urlopen(origin) as response:
            assert key not in response.read().decode()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
