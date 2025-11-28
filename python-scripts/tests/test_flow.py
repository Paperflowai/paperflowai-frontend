import json
from pathlib import Path
from typing import Any

import pytest

from supabase_writer import load_batch, persist_batch


class DummyTable:
    def __init__(self) -> None:
        self.records: list[dict[str, Any]] = []

    def upsert(self, data: dict[str, Any], on_conflict: str):
        existing = next((row for row in self.records if row.get(on_conflict) == data.get(on_conflict)), None)
        if existing:
            existing.update(data)
        else:
            self.records.append({"id": len(self.records) + 1, **data})
        return self

    def select(self, _fields: str):
        return self

    def eq(self, _key: str, _value: Any):
        return self

    def execute(self):
        return type("Response", (), {"data": self.records})


class DummyClient:
    def __init__(self) -> None:
        self.tables: dict[str, DummyTable] = {}

    def table(self, name: str) -> DummyTable:
        self.tables.setdefault(name, DummyTable())
        return self.tables[name]


def test_load_batch(tmp_path: Path):
    payload = tmp_path / "payload.json"
    payload.write_text(json.dumps({"customers": {"name": "Solo"}}), encoding="utf-8")
    batch = load_batch(payload)
    assert batch.customers[0].name == "Solo"


def test_persist_batch_updates_all_entities(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    payload_path = Path(__file__).parent / "fixtures" / "sample_payload.json"
    batch = load_batch(payload_path)
    dummy = DummyClient()

    monkeypatch.setattr("supabase_writer.create_client", lambda url, key: dummy)
    from supabase_writer import SupabaseWriter

    writer = SupabaseWriter("http://example.com", "key")
    persist_batch(batch, writer)

    assert dummy.table("customers").records[0]["organization_number"] == "556677-8899"
    assert dummy.table("offers").records[0]["offer_number"] == "OFF-1001"
    assert dummy.table("receipts").records[0]["receipt_number"] == "RCPT-9001"
    assert dummy.table("offers").records[0]["customer_id"] == 1
    assert dummy.table("receipts").records[0]["customer_id"] == 1
