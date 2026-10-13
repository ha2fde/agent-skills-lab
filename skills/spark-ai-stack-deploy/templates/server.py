import os
import time
import uuid
import threading
import torch
from diffusers import QwenImage21Pipeline
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

HF_MODEL = "Qwen/Qwen-Image-2.1"
OUT_DIR = "/workspace/output"
os.makedirs(OUT_DIR, exist_ok=True)

app = FastAPI(title="Qwen-Image-2.1 API (Diffusers)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

state = {"status": "loading", "error": None, "loaded_at": None}
pipe = None


def _load():
    global pipe
    try:
        p = QwenImage21Pipeline.from_pretrained(
            HF_MODEL,
            local_files_only=True,
            torch_dtype=torch.bfloat16,
        ).to("cuda")
        pipe = p
        state["status"] = "ready"
        state["loaded_at"] = time.time()
    except Exception as e:  # noqa: BLE001
        state["status"] = "error"
        state["error"] = str(e)


threading.Thread(target=_load, daemon=True).start()


class ImageRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"   # "WxH"
    n: int = 1
    steps: int = 40
    seed: int = 42


def _gen(prompt: str, size: str, steps: int, seed: int) -> str:
    if pipe is None:
        raise HTTPException(status_code=503, detail="model still loading")
    try:
        w, h = (int(x) for x in size.lower().split("x"))
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="size must be WxH, e.g. 1024x1024")
    if not (256 <= w <= 2048 and 256 <= h <= 2048):
        raise HTTPException(status_code=400, detail="width/height must be 256..2048")
    steps = max(1, min(steps, 100))
    img = pipe(
        prompt=prompt,
        width=w,
        height=h,
        num_inference_steps=steps,
        generator=torch.Generator("cuda").manual_seed(seed),
    ).images[0]
    fn = f"{int(time.time())}_{uuid.uuid4().hex[:8]}.png"
    path = os.path.join(OUT_DIR, fn)
    img.save(path)
    return fn


@app.get("/health")
def health():
    return state


@app.post("/v1/images/generations")
def images_generations(req: ImageRequest):
    created = []
    for _ in range(max(1, min(req.n, 4))):
        fn = _gen(req.prompt, req.size, req.steps, req.seed)
        created.append({"url": f"/files/{fn}"})
    return {"created": int(time.time()), "data": created}


@app.post("/generate")
def generate(req: ImageRequest):
    fn = _gen(req.prompt, req.size, req.steps, req.seed)
    return {"url": f"/files/{fn}", "file": fn}


@app.get("/files/{name}")
def files(name: str):
    path = os.path.join(OUT_DIR, os.path.basename(name))
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(path)


INDEX_HTML = """<!doctype html>
<html lang="zh">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Qwen-Image-2.1 生图</title>
<style>
 body{font-family:system-ui,Segoe UI,Arial;max-width:880px;margin:24px auto;padding:0 16px;color:#1c1c1c}
 h1{font-size:20px;margin-bottom:4px}
 .sub{color:#666;font-size:13px;margin-bottom:16px}
 label{display:block;font-size:13px;margin:10px 0 4px;color:#333}
 textarea,input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #ccc;border-radius:8px;font-size:14px}
 textarea{height:80px;resize:vertical}
 .row{display:flex;gap:10px} .row>div{flex:1}
 button{margin-top:14px;padding:10px 18px;border:0;border-radius:8px;background:#185FA5;color:#fff;font-size:14px;cursor:pointer}
 button:disabled{opacity:.5}
 #status{margin-top:12px;font-size:13px;color:#666}
 #result{margin-top:16px} #result img{max-width:100%;border-radius:8px;border:1px solid #eee}
</style></head>
<body>
<h1>Qwen-Image-2.1 生图</h1>
<div class="sub">Diffusers 引擎 · OpenAI 兼容 /v1/images/generations</div>
<label>提示词 (prompt)</label>
<textarea id="prompt" placeholder="一只在樱花树下打盹的橘猫，吉卜力风格">一只在樱花树下打盹的橘猫，吉卜力风格</textarea>
<div class="row">
 <div><label>尺寸 WxH</label><input id="size" value="1024x1024"></div>
 <div><label>步数</label><input id="steps" type="number" value="40"></div>
 <div><label>随机种子</label><input id="seed" type="number" value="42"></div>
</div>
<button id="go" onclick="run()">生成</button>
<div id="status"></div>
<div id="result"></div>
<script>
const status=document.getElementById('status');
const result=document.getElementById('result');
const btn=document.getElementById('go');
async function run(){
 const prompt=document.getElementById('prompt').value;
 const size=document.getElementById('size').value;
 const steps=+document.getElementById('steps').value;
 const seed=+document.getElementById('seed').value;
 btn.disabled=true; result.innerHTML=''; status.textContent='请求中…';
 try{
  const r=await fetch('/v1/images/generations',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({prompt,size,n:1,steps,seed})});
  const j=await r.json();
  if(!r.ok){status.textContent='错误: '+(j.detail||r.status);return;}
  const url=j.data[0].url;
  status.textContent='完成';
  result.innerHTML='<img src="'+url+'?t='+Date.now()+'">';
 }catch(e){status.textContent='异常: '+e;}
 finally{btn.disabled=false;}
}
async function ping(){
 try{const r=await fetch('/health');const j=await r.json();
  if(j.status!=='ready'){status.textContent='模型状态: '+j.status+(j.error?(' 错误:'+j.error):'（首次加载约需 30-60 秒）');}
 }catch(e){}
}
setInterval(ping,4000); ping();
</script>
</body></html>"""


@app.get("/")
def index():
    return HTMLResponse(INDEX_HTML)
