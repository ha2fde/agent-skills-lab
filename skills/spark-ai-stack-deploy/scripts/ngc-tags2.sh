#!/bin/bash
# Probe newer NGC vllm tags WITH explicit proxy (docker CLI does not use daemon proxy)
LOG=/tmp/ngc-tags2.log
exec > "$LOG" 2>&1

export HTTPS_PROXY=http://192.0.2.20:7897
export HTTP_PROXY=http://192.0.2.20:7897
export NO_PROXY=localhost,127.0.0.1,192.0.2.0/24

for T in 26.09-py3 26.08-py3 26.07-py3 26.06-py3 26.05-py3 26.04-py3; do
  printf "=== nvcr.io/nvidia/vllm:%s : " "$T"
  if docker manifest inspect "nvcr.io/nvidia/vllm:$T" >/tmp/x.json 2>/tmp/x.err; then
    python3 -c "
import json
d=json.load(open('/tmp/x.json'))
ms=d.get('manifests',[])
archs=sorted({m.get('platform',{}).get('architecture') for m in ms})
print('EXISTS  archs=' + ','.join(archs))
for m in ms:
    if m.get('platform',{}).get('architecture')=='arm64':
        print('    arm64_digest=' + m.get('digest',''))
"
  else
    echo "MISSING  ($(head -c 140 /tmp/x.err | tr -d '\n'))"
  fi
done

echo "----- pytorch tags -----"
for T in 25.12-py3 26.04-py3 26.09-py3; do
  printf "=== nvcr.io/nvidia/pytorch:%s : " "$T"
  if docker manifest inspect "nvcr.io/nvidia/pytorch:$T" >/tmp/x.json 2>/tmp/x.err; then
    python3 -c "
import json
d=json.load(open('/tmp/x.json'))
ms=d.get('manifests',[])
archs=sorted({m.get('platform',{}).get('architecture') for m in ms})
print('EXISTS  archs=' + ','.join(archs))
"
  else
    echo "MISSING  ($(head -c 140 /tmp/x.err | tr -d '\n'))"
  fi
done

echo "PROBE2_DONE"
