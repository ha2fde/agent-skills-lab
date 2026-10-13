#!/usr/bin/env bash
set -uo pipefail
LOG="$HOME/ai-stack/logs/00-host-probe.txt"
mkdir -p "$(dirname "$LOG")"
{
  date -Is

  echo "===== SYSTEM ====="
  uname -a
  uname -m
  cat /etc/os-release
  dpkg --print-architecture 2>/dev/null || true
  lscpu | sed -n '1,40p'

  echo "===== GPU / DRIVER ====="
  nvidia-smi
  nvidia-smi --query-gpu=name,driver_version,cuda_version \
    --format=csv,noheader 2>/dev/null || true

  echo "===== HOST CUDA — INFO ONLY ====="
  which nvcc || true
  nvcc --version 2>/dev/null || true

  echo "===== DOCKER ====="
  docker --version || true
  systemctl is-active docker 2>/dev/null || true
  docker info 2>/dev/null | sed -n '1,160p' || true

  echo "===== NVIDIA CONTAINER TOOLKIT ====="
  nvidia-ctk --version 2>/dev/null || true

  echo "===== EXISTING CONTAINERS / IMAGES ====="
  docker ps -a || true
  docker images --digests || true

  echo "===== HOST PYTHON — INFO ONLY ====="
  python --version 2>/dev/null || true
  python -m pip list 2>/dev/null | grep -Ei \
    'vllm|torch|triton|transformers|diffusers|accelerate|flash|cuda' || true

  echo "===== PORTS ====="
  ss -lntp 2>/dev/null | grep -E ':8000|:8188|:7860' || true

  echo "===== STORAGE / MEMORY ====="
  df -h
  docker system df 2>/dev/null || true
  free -h
} > "$LOG" 2>&1
echo "PROBE_DONE:$(wc -l < "$LOG")"
