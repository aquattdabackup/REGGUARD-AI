import logging
import threading
import time

from app.core.config import settings
from app.core.db import SessionLocal
from app.models.entities import Document, Job, Run
from app.services.evaluation import process_document, process_run
from app.services.jobs import claim, finish, heartbeat

log = logging.getLogger("regguard.worker")


def tick():
    claimed = claim()
    if not claimed:
        return False
    job_id, owner = claimed
    stopped = threading.Event()

    def renew():
        while not stopped.wait(30):
            if not heartbeat(job_id, owner):
                return

    thread = threading.Thread(target=renew, daemon=True)
    thread.start()
    try:
        with SessionLocal() as db:
            job = db.get(Job, job_id)
            if job.job_type == "document":
                process_document(db, db.get(Document, job.reference_id))
            elif job.job_type == "evaluate":
                process_run(db, db.get(Run, job.reference_id), lambda: heartbeat(job_id, owner))
            elif job.job_type == "anchor":
                from app.services.blockchain import process_anchor

                if not process_anchor(db, job.reference_id):
                    from datetime import timedelta

                    from app.core.db import now

                    job.status = "QUEUED"
                    job.attempt_count = max(0, job.attempt_count - 1)
                    job.next_attempt_at = now() + timedelta(seconds=30)
                    job.lease_until = None
                    db.commit()
                    return True
            else:
                raise ValueError("UNSUPPORTED_JOB")
        finish(job_id, owner)
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) else type(error).__name__
        log.warning("job_failed", extra={"job_id": job_id, "error_code": code[:100]})
        finish(job_id, owner, code[:100])
    finally:
        stopped.set()
        thread.join(timeout=1)
    return True


def main():
    settings().validate_runtime()
    logging.basicConfig(level=logging.INFO)
    while True:
        if not tick():
            time.sleep(1)


if __name__ == "__main__":
    main()
