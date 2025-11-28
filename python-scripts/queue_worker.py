"""
Redis-backed worker that consumes OCR jobs, runs extraction, and persists to Supabase.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable, Dict

import redis
import requests
from dotenv import load_dotenv

from supabase_writer import DocumentBatch, SupabaseWriter, load_batch, persist_batch

JOB_STREAM = "ocr_jobs"
DEAD_LETTER = "ocr_dead_letter"
DEFAULT_BACKOFF = 2


class QueueWorker:
    def __init__(self, redis_url: str, supabase_url: str, supabase_key: str, ocr_url: str) -> None:
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.ocr_url = ocr_url.rstrip("/")
        self.writer = SupabaseWriter(supabase_url, supabase_key)

    def run_forever(self, *, sleep_seconds: int = 1) -> None:
        while True:
            job = self.redis.lpop(JOB_STREAM)
            if job is None:
                time.sleep(sleep_seconds)
                continue
            self._process_job(job)

    def _process_job(self, job_payload: str) -> None:
        try:
            job = json.loads(job_payload)
        except json.JSONDecodeError:
            self.redis.lpush(DEAD_LETTER, job_payload)
            return

        try:
            batch = self._extract(job)
            persist_batch(batch, self.writer)
        except Exception:
            self.redis.lpush(DEAD_LETTER, job_payload)
            raise

    def _extract(self, job: Dict[str, Any]) -> DocumentBatch:
        payload = job.get("payload")
        if isinstance(payload, dict):
            return DocumentBatch.model_validate(payload)
        if isinstance(payload, str):
            return load_batch(Path(payload))

        url = job.get("file_url")
        if not url:
            raise ValueError("Job missing file_url")
        document = requests.get(url, timeout=20)
        document.raise_for_status()
        files = {"file": (Path(url).name, document.content)}
        response = requests.post(self.ocr_url, files=files, timeout=60)
        response.raise_for_status()
        data = response.json()
        return DocumentBatch.model_validate(data)


def backoff_retry(func: Callable[[], None], *, retries: int = 3, backoff: int = DEFAULT_BACKOFF) -> None:
    for attempt in range(1, retries + 1):
        try:
            func()
            return
        except Exception:
            if attempt == retries:
                raise
            time.sleep(backoff * attempt)


def main() -> None:
    load_dotenv()
    from os import getenv

    redis_url = getenv("REDIS_URL", "redis://localhost:6379/0")
    supabase_url = getenv("SUPABASE_URL")
    supabase_key = getenv("SUPABASE_SERVICE_ROLE_KEY")
    ocr_url = getenv("OCR_SERVICE_URL", "http://localhost:8000/extract")

    if not supabase_url or not supabase_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

    worker = QueueWorker(redis_url, supabase_url, supabase_key, ocr_url)
    backoff_retry(worker.run_forever)


if __name__ == "__main__":
    main()
