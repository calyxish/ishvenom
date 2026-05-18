# IshVenom cloud inference — RunPod serverless worker image.
#
# Base image is RunPod's CUDA 12.1 development image which already
# contains Python 3.10 + PyTorch wheels, so vLLM installs in ~30s
# instead of ~5 minutes on a clean image.
#
# The model weights are NOT baked into the image. They sit on a
# persistent RunPod network volume mounted at /runpod-volume. This
# keeps the image ~8 GB instead of ~70 GB and lets us swap models
# (26B MoE vs 31B dense) without rebuilding.
FROM runpod/pytorch:2.4.0-py3.10-cuda12.1.1-devel-ubuntu22.04

WORKDIR /app

# System deps. curl is kept for health checks during local debug.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py ./

# RunPod serverless workers set PYTHONUNBUFFERED so our prints reach logs.
ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "handler.py"]
