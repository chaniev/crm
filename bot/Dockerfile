FROM python:3.13-slim AS builder
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN if [ -f pyproject.toml ]; then \
      pip install --upgrade pip && \
      pip install --no-cache-dir . ; \
    fi


FROM python:3.13-slim AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 --user-group --shell /usr/sbin/nologin app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/opt/venv/bin:$PATH"

COPY --from=builder /opt/venv /opt/venv
COPY . .

RUN mkdir -p /app/data/bot && chown -R app:app /app /opt/venv
USER app

EXPOSE 8080
VOLUME ["/app/data/bot"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=8s --retries=10 \
  CMD curl -fsS http://127.0.0.1:8080/health/live || exit 1

CMD ["python", "-m", "gym_crm_bot.main"]
