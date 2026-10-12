FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 REGGUARD_ROOT=/app
WORKDIR /app
COPY services/api services/api
COPY policies policies
RUN pip install --no-cache-dir -c services/api/requirements.lock ./services/api && useradd --create-home regguard && mkdir -p /app/.data && chown -R regguard:regguard /app
USER regguard
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
