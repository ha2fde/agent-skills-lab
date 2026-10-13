#!/usr/bin/env bash
# 收集 AI Stack 环境真实状态，用于生成 README / 交接文档
set -u

AIS=/home/deployuser/ai-stack
OUT=/tmp/readme-info-$(date +%Y%m%d-%H%M%S).txt

{
echo "########## SNAPSHOT_TIME ##########"
date "+%Y-%m-%d %H:%M:%S %Z"
echo
echo "########## HOST ##########"
echo "hostname: $(hostname)"
echo "user: $(whoami)"
echo "home: $HOME"
echo "os: $(. /etc/os-release 2>/dev/null; echo "$PRETTY_NAME")"
echo "kernel: $(uname -r)"
echo "arch: $(uname -m)"
echo "uptime: $(uptime -p 2>/dev/null)"
echo
echo "########## GPU / DRIVER ##########"
nvidia-smi -L 2>/dev/null | head -4
echo "driver_version: $(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)"
echo "cuda_version_host: $(nvcc --version 2>/dev/null | grep -oE 'release [0-9.]+' | head -1)"
echo "gpu_mem: $(nvidia-smi --query-gpu=memory.total --format=csv,noheader 2>/dev/null | head -1)"
echo
echo "########## MEMORY / DISK ##########"
free -h 2>/dev/null | head -2
echo "--- disk ---"
df -h /home/deployuser 2>/dev/null | tail -1
echo
echo "########## DOCKER ##########"
docker --version 2>/dev/null
echo "compose: $(docker compose version --short 2>/dev/null)"
echo "ctk: $(nvidia-ctk --version 2>/dev/null | head -1)"
echo "--- images ---"
docker images --format "{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}" 2>/dev/null | grep -iE "vllm|pytorch|qwen-image21|comfyui"
echo
echo "########## CONTAINERS ##########"
docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}" 2>/dev/null
echo
echo "########## AI-STACK TREE ##########"
find "$AIS" -maxdepth 2 -not -path "*/hf-cache/*" -not -path "*/output/*" -not -path "*/input/*" 2>/dev/null | sort | head -60
echo
echo "########## COMPOSE PROJECTS ##########"
for d in "$AIS"/compose/*/; do
  n=$(basename "$d")
  echo "=== $n ==="
  if [ -f "$d/compose.yaml" ]; then
    grep -vE "^\s*#" "$d/compose.yaml" | grep -E "container_name|image:|ports:|- \"[0-9]+:|command:|restart:" | head -10
  fi
  echo
done
echo "########## COMFYUI MODELS ##########"
du -h "$AIS"/comfyui/models/*/*.safetensors 2>/dev/null
echo "total: $(du -sh "$AIS"/comfyui/models 2>/dev/null | cut -f1)"
echo
echo "########## HF CACHE (DIFFUSERS FORMAT) ##########"
du -sh "$AIS"/hf-cache/hub/* 2>/dev/null
echo "snapshots:"
ls "$AIS"/hf-cache/hub/models--nvidia--Qwen3.8-27B-NVFP4/snapshots/ 2>/dev/null | sed 's/^/  llm=/'
ls "$AIS"/hf-cache/hub/models--Qwen--Qwen-Image-2.1/snapshots/ 2>/dev/null | sed 's/^/  img=/'
echo
echo "########## AI.SH INTERFACE ##########"
grep -nE "usage\(|Commands:|ai\.sh (use|\*)" "$AIS"/bin/ai.sh 2>/dev/null | head -60
echo
echo "########## NETWORK / PROXY ##########"
ip -4 addr show scope global 2>/dev/null | grep -E "inet|^[0-9]" | head -6
echo "--- docker daemon proxy (from docker info) ---"
docker info 2>/dev/null | grep -iE "^\s*(HTTP|HTTPS|No) Proxy" | head -3
echo "--- /etc/profile.d proxy file ---"
ls /etc/profile.d/ 2>/dev/null | grep -i proxy
echo
echo "########## FINGERPRINT ##########"
cat "$AIS"/deployment-fingerprint.json 2>/dev/null
echo
echo "########## RECENT OUTPUTS ##########"
ls -lat "$AIS"/output/ 2>/dev/null | head -8
} > "$OUT" 2>&1

rm -f /tmp/readme-info.txt
cp "$OUT" /tmp/readme-info.txt
echo "WROTE=$OUT"
wc -l /tmp/readme-info.txt
