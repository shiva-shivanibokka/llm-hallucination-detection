# Backend image for GCP Cloud Run. CPU-only, non-root.
FROM python:3.12-slim

# Non-root user.
RUN useradd -m -u 1000 user
WORKDIR /app

# Install CPU torch first from the CPU wheel index so requirements.txt (which
# pins torch==2.6.0) is satisfied without pulling the multi-GB CUDA build.
RUN pip install --no-cache-dir torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cache model weights under a writable, owned dir.
ENV HF_HOME=/app/.cache \
    TRANSFORMERS_CACHE=/app/.cache \
    PORT=8080
RUN mkdir -p /app/.cache && chown -R user:user /app
USER user

# Cloud Run sets $PORT at runtime (default 8080). Shell form so it's honored.
EXPOSE 8080
CMD exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8080}
