#!/bin/bash
# 下载 ComfyUI 格式 Qwen-Image-2.1 INT8 权重 —— 宿主机 curl 直连 hf-mirror.com（不走 Clash 代理）。
# 实测直连 10.5 MB/s，稳定；hf-mirror 为公开镜像，无需 HF token。
# 健壮性：完整则跳过、不完整则断点续传(-C -)、单文件失败不连坐。
M=/home/deployuser/ai-stack/comfyui/models
mkdir -p "$M/diffusion_models" "$M/text_encoders" "$M/vae"
BASE="https://hf-mirror.com/Comfy-Org/Qwen-Image-2.1/resolve/main"

get_expected() {
  curl -sIL --noproxy "*" "$BASE/$1" 2>/dev/null | grep -i "content-length" | tail -1 | tr -dc '0-9'
}
dl() {
  local rel="$1" out="$2"
  local exp
  exp=$(get_expected "$rel")
  if [ -f "$out" ]; then
    local cur
    cur=$(stat -c%s "$out" 2>/dev/null || echo 0)
    if [ -n "$exp" ] && [ "$cur" -ge "$exp" ] 2>/dev/null; then
      echo ">> skip $rel (already complete: $cur/$exp)"; return 0
    fi
  fi
  echo ">> download $rel (expected ${exp:-?} bytes)"
  curl -L --noproxy "*" --retry 10 --retry-delay 5 --retry-all-errors -C - -o "$out" "$BASE/$rel" \
    || echo "WARN: $rel failed, will retry on next run"
}

dl "diffusion_models/qwen_image_2.1_int8_convrot.safetensors" "$M/diffusion_models/qwen_image_2.1_int8_convrot.safetensors" &
dl "text_encoders/qwen3vl_8b_int8_convrot.safetensors"        "$M/text_encoders/qwen3vl_8b_int8_convrot.safetensors" &
dl "text_encoders/qwen3.5_9b_qwen_image_2.1_pe_t2i.int8_convrot.safetensors" "$M/text_encoders/qwen3.5_9b_qwen_image_2.1_pe_t2i.int8_convrot.safetensors" &
dl "vae/qwen_image_2.1_vae_bf16.safetensors"                  "$M/vae/qwen_image_2.1_vae_bf16.safetensors" &
wait
echo "C_DOWNLOAD_DONE"
du -sh "$M"/*
