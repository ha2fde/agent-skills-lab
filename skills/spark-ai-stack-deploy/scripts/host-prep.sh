#!/bin/bash
# Runbook V2.1 - Host prep (approved minimal changes) + NGC image tag probe
# Writes everything to /tmp/host-prep.log on the Spark.
LOG=/tmp/host-prep.log
exec > "$LOG" 2>&1
TARGET_USER="${SUDO_USER:-${USER:-}}"
if [ -z "$TARGET_USER" ] || [ "$TARGET_USER" = root ]; then
  echo "Run with sudo from the target non-root account."; exit 2
fi
TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)
if [ -z "$TARGET_HOME" ]; then echo "Cannot resolve target home"; exit 2; fi

echo "=== 1. add deployuser to docker group (approved Host change) ==="
sudo usermod -aG docker "$TARGET_USER"
echo "usermod_rc=$?"
id "$TARGET_USER"
echo ""

echo "=== 2. create ~/ai-stack persistent dirs ==="
mkdir -p "$TARGET_HOME/ai-stack/bin" \
         "$TARGET_HOME/ai-stack/hf-cache" \
         "$TARGET_HOME/ai-stack/models" \
         "$TARGET_HOME/ai-stack/logs" \
         "$TARGET_HOME/ai-stack/input" \
         "$TARGET_HOME/ai-stack/output" \
         "$TARGET_HOME/ai-stack/compose/qwen38-vllm" \
         "$TARGET_HOME/ai-stack/compose/qwen-image21"
echo "mkdir_rc=$?"
sudo chown -R "$TARGET_USER:$(id -gn "$TARGET_USER")" "$TARGET_HOME/ai-stack"
ls -la "$TARGET_HOME/ai-stack"
echo ""

echo "=== 3. probe NGC vllm tags (manifest inspect only, no layer download) ==="
for T in 26.09-py3 26.08-py3 26.07-py3 26.06-py3 26.05-py3 26.04-py3 26.03-py3 26.02-py3; do
  echo "----- vllm TAG $T -----"
  sudo docker manifest inspect "nvcr.io/nvidia/vllm:$T" > /tmp/m.json 2>/tmp/m.err
  rc=$?
  echo "rc=$rc"
  if [ $rc -eq 0 ] && [ -s /tmp/m.json ]; then
    echo "STATUS=EXISTS"
    grep -o '"architecture"[[:space:]]*:[[:space:]]*"[a-z0-9]*"' /tmp/m.json | sort -u
    grep -o '"os"[[:space:]]*:[[:space:]]*"[a-z0-9]*"' /tmp/m.json | sort -u
  else
    echo "STATUS=MISSING_OR_ERR"
    head -c 300 /tmp/m.err
  fi
  echo ""
done

echo "=== 4. probe NGC pytorch tags ==="
for T in 26.09-py3 26.04-py3 25.12-py3 25.09-py3; do
  echo "----- pytorch TAG $T -----"
  sudo docker manifest inspect "nvcr.io/nvidia/pytorch:$T" > /tmp/m.json 2>/tmp/m.err
  rc=$?
  echo "rc=$rc"
  if [ $rc -eq 0 ] && [ -s /tmp/m.json ]; then
    echo "STATUS=EXISTS"
    grep -o '"architecture"[[:space:]]*:[[:space:]]*"[a-z0-9]*"' /tmp/m.json | sort -u
    grep -o '"os"[[:space:]]*:[[:space:]]*"[a-z0-9]*"' /tmp/m.json | sort -u
  else
    echo "STATUS=MISSING_OR_ERR"
    head -c 300 /tmp/m.err
  fi
  echo ""
done

echo "HOST_PREP_DONE"
