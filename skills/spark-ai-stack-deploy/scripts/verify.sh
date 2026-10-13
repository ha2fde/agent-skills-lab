#!/usr/bin/env bash
# Runbook V2.1 verification: V0 - V8 + deployment fingerprint (§13 / §14)
# Usage: bash verify.sh all      (runs everything)
#        bash verify.sh v0|v1|...|v8|fingerprint
set -u
ROOT=/home/deployuser/ai-stack
LOG="$ROOT/logs"
mkdir -p "$LOG"
PASS=0; FAIL=0
ok(){ echo "  [PASS] $1"; PASS=$((PASS+1)); }
ng(){ echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

v0(){
  echo "===== V0 Host ====="
  nvidia-smi -L >/dev/null 2>&1 && ok "nvidia-smi" || ng "nvidia-smi"
  docker info  >/dev/null 2>&1 && ok "docker" || ng "docker"
  nvidia-ctk --version >/dev/null 2>&1 && ok "nvidia-ctk" || ng "nvidia-ctk"
  df -h "$ROOT" | tail -1
  free -h | sed -n '1,2p'
}
v1(){
  echo "===== V1 Docker GPU smoke ====="
  # NOTE: do NOT pipe to `head` here - closing the pipe early makes docker exit
  # non-zero via SIGPIPE and yields a false FAIL.
  if docker run --rm --gpus=all nvcr.io/nvidia/cuda:13.0.1-devel-ubuntu24.04 \
       nvidia-smi -L 2>&1 | grep -q "NVIDIA GB10"; then
    ok "CUDA container sees GPU"
  else
    ng "CUDA container GPU"
  fi
}
v2(){
  echo "===== V2 LLM container health ====="
  docker ps -a --filter name=qwen38-vllm --format '{{.Names}} {{.Status}}'
  docker logs --tail 120 qwen38-vllm 2>&1 | tee "$LOG/v2-llm-logs.txt" | tail -25
  if docker logs --tail 200 qwen38-vllm 2>&1 | grep -Ei "cuda error|no available memory|out of memory|undefined symbol|arch|unsupported|\.so.*cannot open" ; then
    ng "found critical error keywords"
  else
    ok "no critical error keywords in LLM logs"
  fi
}
v3(){
  echo "===== V3 LLM API ====="
  curl -sS -m 20 http://127.0.0.1:8000/v1/models | tee "$LOG/v3-models.json"
  echo
  curl -sS -m 20 http://127.0.0.1:8000/v1/models | grep -q '"id"' && ok "/v1/models returns model" || ng "/v1/models"
}
v4(){
  echo "===== V4 LLM real inference ====="
  curl -sS -m 300 http://127.0.0.1:8000/v1/chat/completions \
    -H 'Content-Type: application/json' \
    -d '{"model":"nvidia/Qwen3.8-27B-NVFP4","messages":[{"role":"user","content":"Say hello in one short sentence."}],"max_tokens":64,"temperature":0}' \
    | tee "$LOG/v4-chat.json"
  echo
  grep -q '"choices"' "$LOG/v4-chat.json" && ok "chat completion returned choices" || ng "chat completion"
}
v5(){
  echo "===== V5 Image python/CUDA ====="
  docker exec qwen-image21 python - <<'PY'
import torch, transformers, diffusers
print("torch:", torch.__version__)
print("transformers:", transformers.__version__)
print("diffusers:", diffusers.__version__)
print("cuda:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("device:", torch.cuda.get_device_name(0))
PY
  docker exec qwen-image21 python -c 'import torch;assert torch.cuda.is_available()' && ok "image CUDA" || ng "image CUDA"
}
v6(){
  echo "===== V6 Image real generation ====="
  docker exec qwen-image21 python /workspace/generate.py \
    --prompt "A red cube on a clean white background" \
    --out /workspace/output/qwen-image-smoke.png \
    --width 1024 --height 1024 --steps 20 2>&1 | tail -20
  if [ -s "$ROOT/output/qwen-image-smoke.png" ]; then
    ok "PNG produced ($(stat -c%s "$ROOT/output/qwen-image-smoke.png") bytes)"
  else
    ng "no PNG"
  fi
}
v7(){
  echo "===== V7 mode switching ====="
  "$ROOT/bin/ai.sh" use image >/dev/null 2>&1 && ok "switch -> image" || ng "switch -> image"
  sleep 5
  "$ROOT/bin/ai.sh" use llm 2>&1 | tail -3
  curl -sS -m 20 http://127.0.0.1:8000/v1/models >/dev/null && ok "switch back -> llm API ready" || ng "switch back -> llm"
}
v8(){
  echo "===== V8 restart resilience ====="
  docker restart qwen38-vllm >/dev/null 2>&1
  for i in $(seq 1 60); do
    curl -fsS -m 10 http://127.0.0.1:8000/v1/models >/dev/null 2>&1 && break
    sleep 5
  done
  curl -sS -m 20 http://127.0.0.1:8000/v1/models >/dev/null && ok "llm restart -> API ready" || ng "llm restart"
  docker restart qwen-image21 >/dev/null 2>&1
  sleep 5
  docker exec qwen-image21 python -c 'import torch;assert torch.cuda.is_available()' && ok "image restart -> CUDA ok" || ng "image restart"
}
fingerprint(){
  echo "===== Deployment fingerprint ====="
  {
    date -Is
    uname -a
    nvidia-smi
    docker --version
    nvidia-ctk --version
    docker ps -a
    docker images --digests
    echo "===== inspect qwen38-vllm ====="
    docker inspect qwen38-vllm
    echo "===== inspect qwen-image21 ====="
    docker inspect qwen-image21
    echo "===== versions ====="
    docker run --rm --gpus=all --entrypoint bash nvcr.io/nvidia/vllm:26.09-py3 -c "pip show vllm 2>/dev/null | head -2; python -c 'import torch;print(torch.__version__)'"
    docker exec qwen-image21 python -c "import torch,transformers,diffusers;print(torch.__version__, transformers.__version__, diffusers.__version__)"
    echo "===== model revisions (HF hub >=1.x layout: \$HF_HOME/hub/models--*) ====="
    for m in models--nvidia--Qwen3.8-27B-NVFP4 models--Qwen--Qwen-Image-2.1; do
      for base in "$ROOT/hf-cache" "$ROOT/hf-cache/hub"; do
        if [ -f "$base/$m/refs/main" ]; then
          echo "$base/$m -> $(cat "$base/$m/refs/main")"
        fi
      done
    done
    du -sh "$ROOT/hf-cache"
  } > "$ROOT/logs/final-deployment-fingerprint.txt" 2>&1
  wc -l "$ROOT/logs/final-deployment-fingerprint.txt"
  ok "fingerprint saved"
}

case "${1:-all}" in
  v0) v0;; v1) v1;; v2) v2;; v3) v3;; v4) v4;; v5) v5;; v6) v6;; v7) v7;; v8) v8;;
  fingerprint) fingerprint;;
  all)
    v0; v1; v2; v3; v4; v5; v6; v7; v8; fingerprint
    echo "===== SUMMARY: PASS=$PASS FAIL=$FAIL ====="
    ;;
  *) echo "usage: $0 all|v0..v8|fingerprint"; exit 2;;
esac
