# One container for Cloud Run: the React UI built to static files, served by the FastAPI app.
# Build context is the repo root. Deploy with ./deploy.sh.

FROM node:22-slim AS ui
WORKDIR /ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

FROM python:3.12-slim
RUN pip install --no-cache-dir uv==0.11.28
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY app/pyproject.toml app/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app/src ./src
RUN uv sync --frozen --no-dev
COPY --from=ui /ui/dist ./ui
ENV PATH="/app/.venv/bin:$PATH" UI_DIR=/app/ui
CMD ["sh", "-c", "uvicorn handover.server:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips='*'"]
