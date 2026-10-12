# Worker

Run `python -m app.worker` from the repository root using the same environment and virtualenv as the API. Jobs persist in PostgreSQL (SQLite only for local demo). Claims use row locks, SKIP LOCKED, leases and conditional updates. Use one worker process for the hackathon, particularly when a shared anchor signer is configured. No Redis or web-process background task is required.
