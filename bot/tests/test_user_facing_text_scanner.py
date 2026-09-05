from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

SCANNER_PATH = Path(__file__).parents[1] / "scripts/check_user_facing_text.py"
SPEC = importlib.util.spec_from_file_location("task165_bot_scanner", SCANNER_PATH)
assert SPEC is not None and SPEC.loader is not None
SCANNER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = SCANNER
SPEC.loader.exec_module(SCANNER)


def test_visible_copy_is_rejected_while_callback_telemetry_and_resources_are_accepted(
    tmp_path: Path,
) -> None:
    source = tmp_path / "bot/src/gym_crm_bot"
    _write(source / "visible.py", 'TEXT = "Сохранить"\n')
    _write(source / "contracts.py", 'callback_data = "кнопка"\nprint("Диагностика")\n')
    _write(source / "resources/example.py", 'TEXT = "Ресурс"\n')
    exceptions = tmp_path / "exceptions.json"
    allowlist = tmp_path / "allowlist.json"
    _write_entries(exceptions, [])
    _write_entries(allowlist, [])

    result = SCANNER.scan_user_facing_text(source, tmp_path, exceptions, allowlist)

    assert [finding.value for finding in result.violations] == ["Сохранить"]


def test_exact_allowlist_entry_becomes_stale_when_literal_disappears(tmp_path: Path) -> None:
    source = tmp_path / "bot/src/gym_crm_bot"
    _write(source / "clean.py", 'TEXT = "clean"\n')
    exceptions = tmp_path / "exceptions.json"
    allowlist = tmp_path / "allowlist.json"
    _write_entries(exceptions, [])
    _write_entries(
        allowlist,
        [
            {
                "path": "bot/src/gym_crm_bot/clean.py",
                "fingerprint": "sha256:" + hashlib.sha256("Удалено".encode()).hexdigest(),
            }
        ],
    )

    result = SCANNER.scan_user_facing_text(source, tmp_path, exceptions, allowlist)

    assert len(result.stale_allowlist) == 1


def _write(path: Path, contents: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents)


def _write_entries(path: Path, entries: list[dict[str, str]]) -> None:
    path.write_text(json.dumps({"entries": entries}))
