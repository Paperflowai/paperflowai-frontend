"""
Supabase writer that validates OCR JSON and performs idempotent upserts.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError, field_validator
from supabase import Client, create_client

load_dotenv()


class Customer(BaseModel):
    name: str
    organization_number: Optional[str] = Field(default=None, description="Org or VAT number")
    email: Optional[str] = None
    phone: Optional[str] = None


class Offer(BaseModel):
    offer_number: str
    customer: Customer
    total_amount: Optional[float] = None
    currency: str = "SEK"
    issued_at: Optional[str] = None


class Receipt(BaseModel):
    receipt_number: str
    customer: Customer
    total_amount: Optional[float] = None
    vat_amount: Optional[float] = None
    issued_at: Optional[str] = None


class DocumentBatch(BaseModel):
    customers: list[Customer] = Field(default_factory=list)
    offers: list[Offer] = Field(default_factory=list)
    receipts: list[Receipt] = Field(default_factory=list)

    @field_validator("customers", "offers", "receipts", mode="before")
    @classmethod
    def default_to_list(cls, value: Any) -> list[Any]:
        if value is None:
            return []
        if isinstance(value, dict):
            return [value]
        return list(value)


class SupabaseWriter:
    def __init__(self, url: str, key: str) -> None:
        self.client: Client = create_client(url, key)

    def upsert_customers(self, customers: Iterable[Customer]) -> None:
        for customer in customers:
            self._upsert(
                table="customers",
                match_key="organization_number",
                match_value=customer.organization_number or customer.name,
                data=customer.model_dump(),
            )

    def upsert_offers(self, offers: Iterable[Offer]) -> None:
        for offer in offers:
            customer_ref = self._upsert(
                table="customers",
                match_key="organization_number",
                match_value=offer.customer.organization_number or offer.customer.name,
                data=offer.customer.model_dump(),
                return_id=True,
            )
            payload = offer.model_dump()
            payload["customer_id"] = customer_ref
            self._upsert(
                table="offers",
                match_key="offer_number",
                match_value=offer.offer_number,
                data=payload,
            )

    def upsert_receipts(self, receipts: Iterable[Receipt]) -> None:
        for receipt in receipts:
            customer_ref = self._upsert(
                table="customers",
                match_key="organization_number",
                match_value=receipt.customer.organization_number or receipt.customer.name,
                data=receipt.customer.model_dump(),
                return_id=True,
            )
            payload = receipt.model_dump()
            payload["customer_id"] = customer_ref
            self._upsert(
                table="receipts",
                match_key="receipt_number",
                match_value=receipt.receipt_number,
                data=payload,
            )

    def _upsert(
        self,
        *,
        table: str,
        match_key: str,
        match_value: Any,
        data: Dict[str, Any],
        return_id: bool = False,
    ) -> Optional[Any]:
        if match_value is None:
            raise ValueError(f"Cannot upsert {table} without {match_key}")
        response = (
            self.client.table(table)
            .upsert(data, on_conflict=match_key)
            .select("id")
            .eq(match_key, match_value)
            .execute()
        )
        rows = getattr(response, "data", [])
        if not rows:
            return None
        if return_id:
            return rows[0].get("id")
        return None


def load_batch(path: Path) -> DocumentBatch:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return DocumentBatch.model_validate(payload)


def persist_batch(batch: DocumentBatch, writer: SupabaseWriter) -> None:
    writer.upsert_customers(batch.customers)
    writer.upsert_offers(batch.offers)
    writer.upsert_receipts(batch.receipts)


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: python supabase_writer.py <payload.json>")
        return 1

    env_url = Path("./python-scripts/.env")
    if env_url.exists():
        load_dotenv(env_url)

    from os import getenv

    supabase_url = getenv("SUPABASE_URL")
    supabase_key = getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return 1

    try:
        batch = load_batch(Path(argv[1]))
    except (OSError, json.JSONDecodeError, ValidationError) as exc:
        print(f"Invalid payload: {exc}")
        return 1

    writer = SupabaseWriter(supabase_url, supabase_key)
    persist_batch(batch, writer)
    print("Persisted batch to Supabase")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
