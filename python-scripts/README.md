# Python scripts setup

## Installation
1. (Optional) Create and activate a virtual environment.
2. From the repository root, install dependencies:
   ```bash
   python -m pip install -r python-scripts/requirements.txt
   ```
   If you are behind a corporate proxy, set `HTTPS_PROXY`/`HTTP_PROXY` or use an allow‑listed index mirror. A 403 or connection error means the proxy blocked the request.

## Usage
- CLI helpers: `python python-scripts/cli.py --help`
- Supabase writer (expects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`):
  ```bash
  python python-scripts/supabase_writer.py python-scripts/tests/fixtures/sample_payload.json
  ```
- Queue worker (requires Redis, OCR, and Supabase endpoints):
  ```bash
  python python-scripts/queue_worker.py
  ```
- Healthcheck (optional `OCR_HEALTH_URL`):
  ```bash
  python python-scripts/healthcheck.py
  ```

## Testing
After installing dependencies, run the lightweight tests:
```bash
python -m pytest python-scripts/tests -q
```
