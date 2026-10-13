#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/ai-stack"
LLM_DIR="${ROOT}/compose/qwen38-vllm"
IMG_DIR="${ROOT}/compose/qwen-image21"
API_DIR="${ROOT}/compose/qwen-image21-api"
CMF_DIR="${ROOT}/compose/comfyui"

LLM="qwen38-vllm"
IMG="qwen-image21"
API="qwen-image21-api"
CMF="comfyui"

usage() {
  cat <<'EOF'
DGX Spark AI Stack Manager

用法:
  ai.sh <command>

模型模式(互斥切换, 自动停掉其它):
  ai.sh use llm          切换到 Qwen3.8 (LLM)
                         停止其它全部 → 启动 LLM → 等待 API Ready
  ai.sh use image        切换到 Qwen-Image-2.1 (A: 无头 Python 引擎)
                         停止其它全部 → 启动 Image
  ai.sh use image-api    切换到 B: Diffusers 引擎 + 网页/API 服务
                         停止其它全部 → 启动 image-api → 等待模型 Ready
  ai.sh use comfyui      切换到 C: ComfyUI 节点式可视化引擎
                         停止其它全部 → 启动 comfyui → 等待 :8188 Ready

状态:
  ai.sh status           查看 GPU、Docker、全部容器状态
  ai.sh health           执行基础健康检查(含 API/ComfyUI 可达性)
  ai.sh info             查看模型、运行栈、API、目录等固定信息
  ai.sh commands         显示最常用命令速查

LLM — Qwen3.8 / vLLM:
  ai.sh llm start|stop|restart|logs|test

IMAGE (A) — Qwen-Image-2.1 / Diffusers 无头引擎:
  ai.sh image start|stop|restart|logs|test

IMAGE-API (B) — 同一 Diffusers 引擎 + Web UI + OpenAI 兼容接口 (:7860):
  ai.sh image-api start|stop|restart|logs|test

COMFYUI (C) — ComfyUI 独立引擎 + 节点式 Web UI (:8188):
  ai.sh comfyui start|stop|restart|logs|test

全部:
  ai.sh stop             停止全部 AI 容器

帮助:
  ai.sh help
  ai.sh --help
  ai.sh -h

无参数运行 ai.sh 也会显示本帮助。
EOF
}

info() {
  cat <<EOF
DGX Spark AI Stack

Host
  Platform  : DGX Spark / GB10 / ARM64
  Root      : ${ROOT}

LLM — 编码/对话
  Model     : nvidia/Qwen3.8-27B-NVFP4
  Engine    : vLLM
  Container : ${LLM}
  API       : http://127.0.0.1:8000/v1
  Compose   : ${LLM_DIR}/compose.yaml

IMAGE (A) — 无头 Python 引擎
  Model     : Qwen/Qwen-Image-2.1
  Framework : Hugging Face Diffusers
  Pipeline  : QwenImage21Pipeline
  Container : ${IMG}
  Compose   : ${IMG_DIR}/compose.yaml

IMAGE-API (B) — 复用 A 的引擎与权重, 不新增引擎/权重
  Container : ${API}
  Compose   : ${API_DIR}/compose.yaml
  Web UI    : http://192.0.2.10:7860
  API       : POST http://192.0.2.10:7860/v1/images/generations
  Health    : GET  http://192.0.2.10:7860/health

COMFYUI (C) — 独立节点式引擎(非 Diffusers, 自带专用 INT8 权重)
  Container : ${CMF}
  Compose   : ${CMF_DIR}/compose.yaml
  Version   : ComfyUI 0.38.0
  Web UI    : http://192.0.2.10:8188  → Templates → Qwen Image 2.1
  Weights   : ${ROOT}/comfyui/models/ (Comfy-Org/Qwen-Image-2.1 INT8)

Shared
  HF Cache  : ${ROOT}/hf-cache/        (A / B 共用)
  ComfyUI   : ${ROOT}/comfyui/models/  (C 专用, 与上面不通用)
  Input     : ${ROOT}/input/
  Output    : ${ROOT}/output/
  Logs      : ${ROOT}/logs/
EOF
}

commands() {
  cat <<'EOF'
常用命令速查

  ai.sh use llm          # 切到 LLM(编码)
  ai.sh use image        # 切到 A(无头生图引擎)
  ai.sh use image-api    # 切到 B(网页 + OpenAI 接口生图)
  ai.sh use comfyui      # 切到 C(ComfyUI 节点式)
  ai.sh status           # 当前状态
  ai.sh health           # 健康检查
  ai.sh llm test         # LLM 测试
  ai.sh image test       # A 生图测试
  ai.sh image-api test   # B 就绪检查
  ai.sh comfyui test     # C 就绪检查
  ai.sh llm logs         # LLM 日志
  ai.sh stop             # 全部停止
  ai.sh help             # 完整帮助
EOF
}

exists() {
  docker inspect "$1" >/dev/null 2>&1
}

running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = "true" ]
}

# ---------- start / stop primitives ----------
llm_start()  { docker compose -f "${LLM_DIR}/compose.yaml" up -d; }
llm_stop()   { exists "$LLM" && docker stop "$LLM" >/dev/null || true; }

img_start()  { docker compose -f "${IMG_DIR}/compose.yaml" up -d; }
img_stop()   { exists "$IMG" && docker stop "$IMG" >/dev/null || true; }

api_start()  { docker compose -f "${API_DIR}/compose.yaml" up -d; }
api_stop()   { exists "$API" && docker stop "$API" >/dev/null || true; }

cmf_start()  { docker compose -f "${CMF_DIR}/compose.yaml" up -d; }
cmf_stop()   { exists "$CMF" && docker stop "$CMF" >/dev/null || true; }

stop_all_others() {
  # $1 = keep
  [ "$1" != "llm"  ] && llm_stop || true
  [ "$1" != "img"  ] && img_stop || true
  [ "$1" != "api"  ] && api_stop || true
  [ "$1" != "cmf"  ] && cmf_stop || true
}

# ---------- tests ----------
llm_test() {
  echo "Waiting for vLLM API..."
  for _ in $(seq 1 120); do
    if curl -fsS http://127.0.0.1:8000/v1/models >/dev/null 2>&1; then
      curl -sS http://127.0.0.1:8000/v1/models
      echo
      echo "LLM API: READY"
      return 0
    fi
    sleep 5
  done

  echo "LLM API: NOT READY"
  return 1
}

img_test() {
  docker exec "$IMG" python - <<'PY'
import torch, transformers, diffusers
print("torch:", torch.__version__)
print("transformers:", transformers.__version__)
print("diffusers:", diffusers.__version__)
print("cuda:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("device:", torch.cuda.get_device_name(0))
PY

  docker exec "$IMG" \
    python /workspace/generate.py \
      --prompt "A red cube on a clean white background" \
      --out /workspace/output/qwen-image-smoke.png \
      --width 1024 \
      --height 1024 \
      --steps 20

  test -s "${ROOT}/output/qwen-image-smoke.png"
  file "${ROOT}/output/qwen-image-smoke.png"
  echo "IMAGE TEST: PASS"
}

api_test() {
  echo "Waiting for Image API model to load..."
  for _ in $(seq 1 60); do
    if getent hosts localhost >/dev/null 2>&1 \
       && curl -fsS http://127.0.0.1:7860/health 2>/dev/null \
          | grep -q '"status"[[:space:]]*:[[:space:]]*"ready"'; then
      echo "Image API: READY"
      echo "  Web UI : http://192.0.2.10:7860"
      echo "  API    : POST http://192.0.2.10:7860/v1/images/generations"
      return 0
    fi
    sleep 5
  done
  echo "Image API: NOT READY (still loading? check: ai.sh image-api logs)"
  return 1
}

cmf_test() {
  echo "Waiting for ComfyUI :8188 ..."
  for _ in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:8188/system_stats >/dev/null 2>&1; then
      curl -sS http://127.0.0.1:8188/system_stats | head -c 200
      echo
      echo "ComfyUI: READY"
      echo "  Web UI : http://192.0.2.10:8188  (Templates → Qwen Image 2.1)"
      return 0
    fi
    sleep 3
  done
  echo "ComfyUI: NOT READY (check: ai.sh comfyui logs)"
  return 1
}

# ---------- status / health ----------
status() {
  echo "===== DGX SPARK AI STACK ====="
  echo

  nvidia-smi >/dev/null 2>&1 \
    && echo "Host GPU       : OK" \
    || echo "Host GPU       : FAIL"

  docker info >/dev/null 2>&1 \
    && echo "Docker         : OK" \
    || echo "Docker         : FAIL"

  if running "$LLM"; then
    echo "LLM            : RUNNING   (http://192.0.2.10:8000/v1)"
  else
    echo "LLM            : STOPPED"
  fi

  if running "$IMG"; then
    echo "Image (A)      : RUNNING   (headless python engine)"
  else
    echo "Image (A)      : STOPPED"
  fi

  if running "$API"; then
    echo "Image-API (B)  : RUNNING   (http://192.0.2.10:7860)"
  else
    echo "Image-API (B)  : STOPPED"
  fi

  if running "$CMF"; then
    echo "ComfyUI (C)    : RUNNING   (http://192.0.2.10:8188)"
  else
    echo "ComfyUI (C)    : STOPPED"
  fi

  echo
  df -h "${ROOT}" | tail -1
  free -h | sed -n '1,2p'
}

health() {
  status
  echo

  if running "$LLM"; then
    curl -fsS http://127.0.0.1:8000/v1/models >/dev/null \
      && echo "LLM API        : READY" \
      || echo "LLM API        : NOT READY"
  fi

  if running "$IMG"; then
    docker exec "$IMG" python -c \
      'import torch; assert torch.cuda.is_available(); print("Image CUDA     : READY")' \
      || echo "Image CUDA     : FAIL"
  fi

  if running "$API"; then
    curl -fsS http://127.0.0.1:7860/health >/dev/null \
      && echo "Image-API      : READY" \
      || echo "Image-API      : NOT READY"
  fi

  if running "$CMF"; then
    curl -fsS http://127.0.0.1:8188/system_stats >/dev/null \
      && echo "ComfyUI        : READY" \
      || echo "ComfyUI        : NOT READY"
  fi
}

case "${1:-}" in
  help|-h|--help|"")
    usage
    ;;

  info)     info ;;
  commands) commands ;;
  status)   status ;;
  health)   health ;;

  use)
    case "${2:-}" in
      llm)
        stop_all_others llm
        llm_start
        llm_test
        ;;
      image)
        stop_all_others img
        img_start
        echo "Image container started."
        ;;
      image-api)
        stop_all_others api
        api_start
        api_test
        ;;
      comfyui)
        stop_all_others cmf
        cmf_start
        cmf_test
        ;;
      *)
        usage; exit 1
        ;;
    esac
    ;;

  llm)
    case "${2:-}" in
      start)   llm_start ;;
      stop)    llm_stop ;;
      restart)
        llm_stop
        llm_start
        llm_test
        ;;
      logs)    docker logs -f --tail 200 "$LLM" ;;
      test)    llm_test ;;
      *) usage; exit 1 ;;
    esac
    ;;

  image)
    case "${2:-}" in
      start)   img_start ;;
      stop)    img_stop ;;
      restart)
        img_stop
        img_start
        ;;
      logs)    docker logs -f --tail 200 "$IMG" ;;
      test)    img_test ;;
      *) usage; exit 1 ;;
    esac
    ;;

  image-api)
    case "${2:-}" in
      start)   api_start ;;
      stop)    api_stop ;;
      restart)
        api_stop
        api_start
        api_test
        ;;
      logs)    docker logs -f --tail 200 "$API" ;;
      test)    api_test ;;
      *) usage; exit 1 ;;
    esac
    ;;

  comfyui)
    case "${2:-}" in
      start)   cmf_start ;;
      stop)    cmf_stop ;;
      restart)
        cmf_stop
        cmf_start
        cmf_test
        ;;
      logs)    docker logs -f --tail 200 "$CMF" ;;
      test)    cmf_test ;;
      *) usage; exit 1 ;;
    esac
    ;;

  stop)
    llm_stop
    img_stop
    api_stop
    cmf_stop
    echo "All AI containers stopped."
    ;;

  *)
    usage
    exit 1
    ;;
esac
