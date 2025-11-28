"""Simple healthcheck runner for OCR service and Supabase."""
from __future__ import annotations

import time
from typing import Dict

import requests
from dotenv import load_dotenv

from supabase import create_client


def ping_ocr(url: str) -> Dict[str, float]:
    start = time.perf_counter()
    response = requests.get(url, timeout=5)
    response.raise_for_status()
    duration = time.perf_counter() - start
    return {"latency_ms": round(duration * 1000, 2)}


def ping_supabase(url: str, key: str) -> Dict[str, float]:
    start = time.perf_counter()
    client = create_client(url, key)
    client.table("customers").select("id").limit(1).execute()
    duration = time.perf_counter() - start
    return {"latency_ms": round(duration * 1000, 2)}


def main() -> None:
    load_dotenv()
    from os import getenv

    ocr_url = getenv("OCR_HEALTH_URL", "http://localhost:8000/health")
    supabase_url = getenv("SUPABASE_URL")
    supabase_key = getenv("SUPABASE_SERVICE_ROLE_KEY")

    results: Dict[str, Dict[str, float]] = {}
    try:
        results["ocr"] = ping_ocr(ocr_url)
    except Exception as exc:
        results["ocr_error"] = {"error": str(exc)}

    if supabase_url and supabase_key:
        try:
            results["supabase"] = ping_supabase(supabase_url, supabase_key)
        except Exception as exc:
            results["supabase_error"] = {"error": str(exc)}
    else:
        results["supabase_error"] = {"error": "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"}

    print(results)


if __name__ == "__main__":
    main()
