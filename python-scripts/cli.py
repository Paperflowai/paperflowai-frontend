"""
Developer-friendly CLI for uploading, extracting, persisting, and checking statuses.
"""
from __future__ import annotations

import json
from pathlib import Path
import requests
import typer
from dotenv import load_dotenv

from supabase_writer import SupabaseWriter, load_batch, persist_batch

app = typer.Typer(help="PaperflowAI developer CLI")


def _load_supabase() -> SupabaseWriter:
    load_dotenv()
    from os import getenv

    supabase_url = getenv("SUPABASE_URL")
    supabase_key = getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        raise typer.Exit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return SupabaseWriter(supabase_url, supabase_key)


@app.command()
def upload(file: Path, bucket: str = "receipts") -> None:
    """Upload a file to Supabase storage."""
    writer = _load_supabase()
    response = writer.client.storage.from_(bucket).upload(str(file.name), file.read_bytes())
    typer.echo(response)


@app.command()
def extract(file: Path, endpoint: str = "http://localhost:8000/extract") -> None:
    """Send a file to the OCR extraction endpoint."""
    with file.open("rb") as handle:
        response = requests.post(endpoint, files={"file": handle}, timeout=30)
    response.raise_for_status()
    typer.echo(json.dumps(response.json(), indent=2, ensure_ascii=False))


@app.command()
def persist(payload: Path) -> None:
    """Persist an OCR JSON payload into Supabase tables."""
    writer = _load_supabase()
    batch = load_batch(payload)
    persist_batch(batch, writer)
    typer.echo("Persisted payload")


@app.command()
def status(queue_key: str = "ocr_jobs") -> None:
    """Show queue backlog for the Redis worker."""
    import redis

    from os import getenv

    redis_url = getenv("REDIS_URL", "redis://localhost:6379/0")
    client = redis.from_url(redis_url, decode_responses=True)
    pending = client.llen(queue_key)
    dead = client.llen("ocr_dead_letter")
    typer.echo(f"Pending jobs: {pending} | Dead-lettered: {dead}")


if __name__ == "__main__":
    app()
