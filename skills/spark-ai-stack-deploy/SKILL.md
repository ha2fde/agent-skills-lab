---
name: spark-ai-stack-deploy
description: 在 NVIDIA DGX Spark（或任何 aarch64 / GB10 Grace Blackwell、128GB 统一内存的 Ubuntu 机器）上部署一套干净、隔离、可复现的四 workload AI Stack：vLLM 编码模型 + Diffusers 无头生图引擎 + 同一引擎的 Web/API 服务 + ComfyUI 节点式生图。当用户要"在 Spark 上装模型 / 部署 LLM / 部署 Qwen-Image / 部署 ComfyUI / 再来一台照着装"时使用。覆盖全流程：只读探测、GPU smoke、主机准备、镜像选型与构建、权重下载通道选型、四套 compose、一键运维脚本、验收与部署指纹。含本环境踩过的全部硬坑（torchao 版本错配、local_files_only 导致重启 hang、ssh 断开杀死构建、hf-mirror 直连最优）与锁定可工作的版本组合。前置出网请先用 spark-clash-egress skill。
---

> **归档说明（2026-10-13）**：此版本根据上传的部署记录归档。文中的硬件实测为原作者报告，本次仅检查文件结构与语法，未连接目标机器复测。用户名 `deployuser` 和地址 `192.0.2.10` / `192.0.2.20` 为公开示例，必须替换；已移除脚本中的硬编码 sudo 密码。执行前阅读 [归档与适配说明](references/archive-notes.md)。


# DGX Spark AI Stack 一键部署手册

> **本手册来源**：真实在 DGX Spark（aarch64 / GB10 / 128GB 统一内存 / Ubuntu 24.04）上完整部署成功过的记录，
> 不是理论推演。所有版本号、体积、耗时、报错现象均为实测值。
> **读法**：按章节顺序执行；第 5 章（九条硬约束）建议**动手前先通读一遍**，能省掉绝大多数返工。

---

## 1. 目标产物

四套**互相独立**的 compose 项目，各自独立容器、独立端口、独立 Python 环境：

| 代号 | 用途 | 引擎 | 容器 | 端口 | 模型 |
|---|---|---|---|---|---|
| **LLM** | 编码 / 对话 | vLLM 0.29.0 | `qwen38-vllm` | **8000** | `nvidia/Qwen3.8-27B-NVFP4`（NVFP4, 19G） |
| **A** | 生图（无头） | Diffusers `QwenImage21Pipeline` | `qwen-image21` | 无 | `Qwen/Qwen-Image-2.1`（BF16, 30G） |
| **B** | 生图（网页+API）★推荐 | 复用 A 的引擎 + FastAPI 薄层 | `qwen-image21-api` | **7860** | 与 A 共享权重，**不新增** |
| **C** | 生图（节点工作流） | ComfyUI **v0.39.2**（独立引擎） | `comfyui` | **8188** | `Comfy-Org/Qwen-Image-2.1`（INT8, 25G） |

> ✅ **C 引擎本地/离线出图已跑通（2026-10-12 实测修正）**：把 ComfyUI 从 0.38.0 升到 **v0.39.2** 后，
> 用**核心原生节点 + 通用 loader**即可用本地 24.9G INT8 权重离线出图，**不需要任何第三方插件包、不需要重下权重**。
> 关键点有两个（0.38.0 缺的是「本地 loader 路径」的意识，不是节点本身）：
> 1. 图像文本编码器用 **`qwen3vl_8b_int8_convrot.safetensors`**（`CLIPLoader` type=`qwen_image`）。
>    ⚠️ **不要**用 `qwen3.5_9b_qwen_image_2.1_pe_t2i.int8_convrot.safetensors` —— 那是**提示词增强 LLM**
>    （配 `TextGenerate` 用），拿它做图像编码会得到**纯噪声**。
> 2. 采样器的 `latent_image` 用标准 **`EmptyLatentImage`(1024×1024)**，**不是** `TextEncodeQwenImage21` 的 latent 输出。
>
> 采样参数照抄官方模板：`steps=25, cfg=1.0, sampler=euler, scheduler=simple, denoise=1.0`（**无** ModelSampling 节点）。
> 实测 ~46s 出一张 1024² PNG。完整 API 格式工作流见 `templates/comfyui-local-t2i-api.json`，配方详见 §5.8。

**三条铁律**（下一台同样适用）：
1. **四套 workload 互斥**，不要同时跑 —— 128GB 统一内存 + 单份 GPU 显存，必须按需切换。靠 `ai.sh use <name>` 保证。
2. **Host 软件栈是保护区**：不改驱动 / CUDA / 内核 / GRUB / `LD_LIBRARY_PATH`，不在宿主 `apt install` / `pip install` 任何 ML 包。全部东西在容器里。
3. **A/B 与 C 是两套不同的图像引擎**，权重格式与组织互不通用（见 §6.3）。

---

## 2. 前置条件

| 项 | 要求 | 检查方法 |
|---|---|---|
| 架构 | aarch64（`uname -m`） | ⚠️ 拉镜像必须 `--platform linux/arm64` |
| 驱动 / CUDA | ≥ 580（本环境 580.178.04 / CUDA 13.0） | `nvidia-smi` |
| 容器栈 | Docker ≥ 29 + NVIDIA Container Toolkit | `docker run --rm --gpus all <img> nvidia-smi` |
| 磁盘 | **≥ 150GB 空闲**（权重 ~74G + 镜像 ~130G） | `df -h $HOME` |
| 网络 | 已能出网 | **先执行 `spark-clash-egress` skill** 打通代理 |

> 磁盘预算明细：LLM 权重 19G + Image BF16 30G + Comfy INT8 25G = **74G 权重**；
> 镜像 `vllm:26.09-py3` 25.7G + `pytorch:26.09-py3` 25.3G + `qwen-image21-diffusers:v1` 25.5G
> + `qwen-image21-api:v1` 25.5G + `comfyui:v1` 26.3G ≈ **128G 镜像**（B 复用 A 的层，实际增量很小）。

---

## 3. 执行流程

### Phase 0 — 只读探测（不改任何东西）

```bash
scp scripts/probe.sh <host>:/tmp/ && ssh <host> 'bash /tmp/probe.sh'
```

确认：架构、驱动、Docker、CTK、GPU 是否可见。**先把安全基线打印出来存档**（`references/gpu-smoke-sample.txt` 是当时的样本）。

### Phase 1 — GPU smoke（必须先过）

```bash
docker run --rm --gpus all <候选底座镜像> python -c "import torch;print(torch.__version__, torch.cuda.is_available())"
```

**这一条不过，后面全部白做。** 它是唯一能在花时间拉模型之前证明 GPU 直通可用的手段。

### Phase 2 — 主机准备

```bash
scp scripts/host-prep.sh <host>:/tmp/ && ssh <host> 'sudo bash /tmp/host-prep.sh'
```

只做两件事：把当前用户加入 `docker` 组（免 `sudo`）、创建目录骨架。
**不装任何 ML 包、不改驱动**——保持"保护区"洁净。

```bash
mkdir -p ~/ai-stack/{bin,compose,logs,input,output,models,hf-cache}
mkdir -p ~/ai-stack/comfyui/models/{diffusion_models,text_encoders,vae}
```

### Phase 3 — 镜像选型（两个 NGC arm64 底座）

```bash
docker pull nvcr.io/nvidia/vllm:26.09-py3        # LLM 用，**官方预编译，不要自己 build**
docker pull nvcr.io/nvidia/pytorch:26.09-py3     # A / C 的构建底座
```

**为什么是 NGC 而不是 vLLM 官方仓库**：vLLM 项目组发布的镜像只有 amd64；NGC 的 `nvcr.io/nvidia/vllm` 提供 **arm64** 且对口 GB10（内含为了 Blackwell 优化的 CUDA/torch 版本）。用 `scripts/ngc-tags2.sh` 可查询可用 tag。

> ⚠️ 用 `pytorch:25.09-py3`（torch 2.9 + torchao 0.13）会踩 §5.2 的坑。

### Phase 4 — 构建三个自建镜像

```bash
# A：Diffusers 无头引擎
cd ~/ai-stack/compose/qwen-image21      && docker compose build
# B：网页 + API（基于 A 的镜像增量，很快）
cd ~/ai-stack/compose/qwen-image21-api  && docker compose build
# C：ComfyUI
cd ~/ai-stack/compose/comfyui           && docker compose build
```

> 🚨 **构建必须用 `setsid` 从 ssh 会话剥离**，否则 ssh 断连会杀掉构建进程（见 §5.4）：
> `setsid bash -c 'cd <dir> && docker compose build > /tmp/build.log 2>&1; echo RC=$? >> /tmp/build.log' &`

模板文件：见 `templates/`（4 个 compose + 3 个 Dockerfile + `generate.py` + `server.py`）。
**注意把 compose 里的 `$HOME` 替换成绝对路径**（如 `/home/deployuser/ai-stack/...`），systemd/ssh 下 `$HOME` 可能为空。

### Phase 5 — 下载权重（★通道选型决定成败）

**在下权重之前先测速**，选错通道会卡死几个小时。

```bash
# 三条通道都测一遍（落下 ~300MB 片段）
curl -s -L --noproxy "*" -r 0-314572799 -o /tmp/sp.bin "<hf-mirror resolve 链接>"
curl -s -L -x http://<win-ip>:7897 -r 0-314572799 -o /tmp/sp2.bin "<hf-mirror resolve 链接>"
curl -s -o /dev/null -w "%{http_code}" --noproxy "*" https://huggingface.co
```

**实测结论（照抄即可，不用再测）**：

| 通道 | 结果 | 用途 |
|---|---|---|
| **hf-mirror.com 直连**（`--noproxy "*"`） | ✅ **~10.5 MB/s，稳定** | **下权重唯一推荐** |
| huggingface.co 直连 | ❌ 超时（MAC 未白名单） | 不可用 |
| 任何地址走 Clash 代理 | ❌ 大文件超时卡死 | 只适合小流量（apt/pip/pull） |

用 `scripts/download-comfyui.sh`（Comfy INT8 套），它已内建：
**hf-mirror 直连 + 多文件并行 + 完整则跳过 + 断点续传 + 单文件失败不连坐**。24.9GB 约 **30–40 分钟**。

LLM 与 Image BF16 用 huggingface CLI 从 `hf-cache/` 拉取（同样建议 `--disable-xet`）：

```bash
export HF_HUB_DISABLE_XET=1
export HF_HOME=$HOME/ai-stack/hf-cache
hf download nvidia/Qwen3.8-27B-NVFP4 \
  --local-dir $HF_HOME/hub/models--nvidia--Qwen3.8-27B-NVFP4
hf download Qwen/Qwen-Image-2.1 \
  --local-dir $HF_HOME/hub/models--Qwen--Qwen-Image-2.1
```

> ⚠️ HF 新缓存布局是 `$HF_HOME/hub/models--<组织>--<模型名>/`（注意用的是 `--` 而非斜杠）。路径写错会让容器找不到权重、又悄悄联网。

> 不要对这些 gated 仓库做 token 依赖判断 —— 本环境的两个仓库都**不需要 token**。

### Phase 6 — 逐个验证（对应 V0–V8）

**每套 workload 都必须验证「重启后还能用」**，否则会埋一个「只有重启才炸」的雷。

```bash
ai.sh use llm         # 起 LLM + 等 API ready
ai.sh llm test        # curl /v1/models + 真实一轮对话
ai.sh use image       # 起 A
ai.sh image test      # generate.py 出一张（1024²/40步 ≈ 52秒）
# 重启恢复测试（等价 V8，必做）
docker compose down && docker compose up -d && 再出一张
ai.sh use image-api   # 起 B → 等 /health ready → POST /v1/images/generations
ai.sh use comfyui     # 起 C → curl :8188/system_stats 能通（离线也能起）
# 本地出图：POST templates/comfyui-local-t2i-api.json 到 :8188/prompt（离线 OK，~46s/张；配方见 §5.8）
# ⚠️ 不要点 Templates 里的 QwenImageTextToImageApi —— 那是云端 API 节点，需 Comfy 登录 + 联网。
```

### Phase 7 — 交付运维脚本与交接文档

```bash
cp scripts/ai.sh ~/ai-stack/bin/ai.sh && chmod +x ~/ai-stack/bin/ai.sh
```

⚠️ `ai.sh` 依赖 `$HOME` 解析根目录，**非交互 ssh 下必须显式给**：
`HOME=/home/deployuser /home/deployuser/ai-stack/bin/ai.sh status`
建议加 alias：`alias ai="HOME=/home/deployuser /home/deployuser/ai-stack/bin/ai.sh"`

最后写两份东西：
- **`~/README.md`** —— 环境交接文档。`scripts/collect-readme-info.sh` 能一次性采集全部真实数据（主机/GPU/镜像/容器/权重/端口），基于它写就不会编故事。
- **`~/ai-stack/deployment-fingerprint.json`** —— 部署指纹（镜像 ID / 版本 / 权重哈希 / 验收结论），回滚核对用。样例见 `references/deployment-fingerprint-sample.json`。

---

## 4. 锁定版本（★不要随便升级）

这是花了大量时间试错才钉死的组合，**除非明确知道后果，否则不要动**：

| 组件 | 版本 | 说明 |
|---|---|---|
| vLLM 镜像 | `nvcr.io/nvidia/vllm:26.09-py3` | 内含 vLLM 0.29.0 |
| PyTorch 底座 | `nvcr.io/nvidia/pytorch:26.09-py3` | torch `2.14.0a0+nv26.09` |
| **torchao** | **0.18.0** | ⚠️ 见 §5.2，**这是个雷** |
| transformers | 5.17.0 | |
| diffusers | `0.41.0.dev0`（git `031b2798`） | ⚠️ 必须源码装，`QwenImage21Pipeline` 未进 release |
| ComfyUI | **v0.39.2** | ⚠️ tag 必须 pin；**必须 ≥ v0.39.x**，0.38.0 看不到本地 Qwen-Image-2.1 的 loader 路径 |

---

## 5. 九条硬约束（动手前必读）

### 5.1 `from_pretrained` 必须带 `local_files_only=True`

否则容器重启后会去 HF Hub 联网校验 snapshot，在内网/代理下 **CPU 100% 空转永久 hang**（GPU 完全不动，症状极具迷惑性：看起来像在加载，实际卡死）。
**任何新增的加载代码都要照做。**

### 5.2 torchao 版本错配 → Diffusers pipeline 整模块崩

现象：`cannot import name 'FqnToConfig' from 'torchao.quantization'`。
根因：Diffusers 主线 `QwenImage21Pipeline` 会 import `FqnToConfig`，而旧底座自带的 torchao 0.13 没有这个符号；
**而官方 README 的依赖清单里压根没提 torchao**（这是官方的遗漏）。
解法：底座必须是 `pytorch:26.09-py3`（torch 2.14），再 `pip install torchao==0.18.0`。
日志里后续出现的 `Unable to import torchao Tensor objects` 是**无害警告**，不影响出图，别再去折腾它。

### 5.3 aarch64 无处不在

- 拉镜像/构建必须 `--platform linux/arm64`。
- **ComfyUI 官方 Docker 镜像只有 x86_64**，不能直接用；必须从 `pytorch:26.09-py3` 自建 arm64 镜像（本手册的 `Dockerfile-comfyui` 就是）。
- ComfyUI 的 `requirements.txt` 里 `sageattention/trampoline/kornia_rs/xformers/cupy` 等原生包在 arm64 可能装不上 —— 模板已做「先全装，失败则排除这些包再装」的回退；**注意力会退化为 torch SDPA 实现，不影响出图**。

### 5.4 长任务必须 `setsid` 剥离 ssh 会话

**这是本环境最阴的坑**：`docker compose build` / `docker pull` 作为 ssh 会话的子进程，**ssh 一断就被杀**，
表现为日志停在半截进度条、**连 `BUILD_RC` 都没写出来**（看起来像构建失败，其实是进程被杀）。
解法：`setsid bash -c '...' >/dev/null 2>&1 &`，之后再单独读日志。

### 5.5 `pkill -f <pattern>` 会自匹配自杀

pattern 出现在自己的命令行里就会把自己杀掉（表现为命令无任何输出）。
写成字符类：`pkill -f "download-comfyui[.]sh"`。

### 5.6 `nvidia-smi --query-gpu=memory.*` 返回 `[N/A]`

GB10 上这些字段拿不到。直接跑 `nvidia-smi` 看默认表格，**不要用它写判断脚本**（会把「拿不到数据」误判成「GPU 坏了」）。

### 5.7 判读假象：`BUILD_RC=True`

日志里出现这是**进度条 `\r` 残留在同一行**造成的视觉假象，不是真实返回值。
用 `grep -aoE "BUILD_RC=[0-9]+"` 精确取数字，或直接看镜像是否存在：`docker inspect --format "{{.Id}}" <img>`。

### 5.8 ComfyUI 官方模板从磁盘直接取 + 本地出图配方

后端 `/api/templates` 可能返回 **404**，但**官方模板 JSON 就装在容器的 pip 包里**，可直接读，不必靠前端点击：

```bash
docker exec comfyui cat \
  /usr/local/lib/python3.12/dist-packages/comfyui_workflow_templates_json/templates/image_qwen_image_2_1_t2i.json
```

它是**前端 graph 格式**（`nodes`/`links` + `definitions.subgraphs`），真正干活的模型链在
`definitions.subgraphs[0]`（名为 `Text to Image (Qwen Image 2.1)`）里；外层只有 `ResolutionSelector`
+ `SaveImageAdvanced` + 几个 `MarkdownNote` 文档节点。要从 API 批量出图，需把它**手工转成 API 格式**
（每个节点 `{class_type, inputs}`）。

> ✅ **本地/离线出图正确配方（2026-10-12 实测跑通，~46s/张 1024²）**：
> ComfyUI **v0.39.2** 下**不需要第三方插件、不需要云端**，用**核心原生节点 + 通用 loader**即可驱动本地 24.9G INT8 权重：
>
> | # | 节点 | 关键参数 |
> |---|---|---|
> | 1 | `UNETLoader` | `qwen_image_2.1_int8_convrot.safetensors` / `default` |
> | 2 | `CLIPLoader` | **`qwen3vl_8b_int8_convrot.safetensors`** / type=**`qwen_image`** |
> | 3 | `VAELoader` | `qwen_image_2.1_vae_bf16.safetensors` |
> | 4 | `QwenImage21Cache`（可选，官方模板有） | `device=auto, dtype=default` |
> | 5 | `EmptyLatentImage` | `1024×1024×1` |
> | 6 | `TextEncodeQwenImage21` | clip=步骤2，`prompt`，`negative_prompt=""`，`resolution=1024`，`images=[]` → `positive`/`negative` |
> | 7 | `KSampler` | model=步骤4，**`steps=25, cfg=1.0, euler, simple, denoise=1.0`**，`latent_image`=步骤5，positive/negative=步骤6 |
> | 8 | `VAEDecode` → `SaveImage` | vae=步骤3，`filename_prefix` 自定 |
>
> ⚠️ **两个会静默出「纯噪声」的坑**（不报错、exit success，最容易误判成"本地不能出图"）：
> 1. **文本编码器别选错**：`qwen3.5_9b_qwen_image_2.1_pe_t2i.int8_convrot.safetensors` 是**提示词增强 LLM**
>    （官方模板配 `TextGenerate` 用它改写 prompt），**不是图像文本编码器**；拿它喂 `TextEncodeQwenImage21`
>    会得到噪点。图像编码器是 **`qwen3vl_8b_int8_convrot.safetensors`**。
> 2. **latent 用标准 `EmptyLatentImage`**，别接 `TextEncodeQwenImage21` 的 `latent` 输出（那是给 layered 变体用的）。
>
> 完整、可直接 `POST /prompt` 的 API 格式工作流：`templates/comfyui-local-t2i-api.json`。
> 通用 loader 支持哪些权重，直接问 API：`curl :8188/object_info` 看 `UNETLoader` / `CLIPLoader` / `VAELoader` 的选项。
>
> （可选）复刻官方那套「提示词增强」：再加 `CLIPLoader`(pe_t2i 文件, type=`stable_diffusion`) + `TextGenerate`
> + `ComfySwitchNode`，把增强后的字符串接到 `TextEncodeQwenImage21.prompt`。全本地权重，纯离线也能跑。
>
> ℹ️ 别点 Templates 里的 `QwenImageTextToImageApi` —— 那是 **cloud API 节点**（`api_node=true`），
> 需 Comfy 组织登录 + 联网，离线跑 `/prompt` 会报 `Unauthorized: Please login first to use this node.`。

### 5.9 看到 `Exited (0)` 的容器别慌

这是按需互斥切换的正常结果（`restart: unless-stopped` 只是异常时拉起，手动 stop 不会再自启）。
**不要删容器对象** —— 会让 `ai.sh` 的状态判断与实际脱节。

---

## 6. 几个容易搞混的概念

### 6.1 PyTorch / Diffusers / QwenImage21Pipeline / vLLM 不是同一种东西

- **PyTorch**：底层张量计算库。
- **Diffusers**：HuggingFace 的扩散模型库；`QwenImage21Pipeline` 是它里面针对本模型的**管道类**（还没进 release，所以要源码装）。
- **vLLM**：LLM 推理 / 服务引擎，**只管文本**，与生图无关。

### 6.2 Diffusers 为什么没有官方 UI

HF 一贯只发**库**不发**应用**（transformers/datasets 同理），UI 留给生态；ComfyUI 赢在**节点图**（可视化编程），不是因为引擎更强。所以"给 Diffusers 加个 UI"（本手册的 **B**）是合理的补位方案，**不需要引入第二个引擎、不需要重新下权重**。

### 6.3 两套图像权重不可混用

| | A / B（Diffusers） | C（ComfyUI） |
|---|---|---|
| 来源仓 | `Qwen/Qwen-Image-2.1` | `Comfy-Org/Qwen-Image-2.1` |
| 目录 | `~/ai-stack/hf-cache/hub/models--Qwen--Qwen-Image-2.1/` | `~/ai-stack/comfyui/models/{diffusion_models,text_encoders,vae}/` |
| 布局 | HF hub 缓存（blobs + snapshots 软链） | ComfyUI 扁平三件套 |
| 精度 | BF16 30G | INT8 三件套 25G |

**ComfyUI 不会自动下载模型**，必须手动把权重放到它认识的三个子目录里。

---

## 7. 自带文件清单

```
scripts/
  probe.sh                  Phase 0 只读探测
  host-prep.sh              Phase 2 主机准备（不碰保护区）
  ngc-tags2.sh              NGC 镜像 tag 查询（挑 arm64 可用版本）
  ai.sh                     ★ 成品运维脚本：use/status/health/info/start/stop/restart/logs/test
  download-comfyui.sh       Comfy INT8 权重下载（hf-mirror 直连 + 续传 + 容错）
  verify.sh                 V0–V8 验收
  collect-readme-info.sh    交接 README 的数据采集（免手抄）
templates/
  compose-vllm.yaml          LLM（直接用官方镜像，无 Dockerfile）
  compose-image21.yaml       A
  compose-image21-api.yaml   B
  compose-comfyui.yaml       C
  Dockerfile-image21         A（含 torchao 0.18.0 修复）
  Dockerfile-image21-api     B（只加 fastapi + uvicorn）
  Dockerfile-comfyui         C（**pin v0.39.2** + arm 回退）
  comfyui-local-t2i-api.json ★ C 本地/离线出图工作流（API 格式，直接 POST /prompt）
  generate.py                A 的出图脚本（含 local_files_only 修复）
  server.py                  B 的 FastAPI 服务（含内置 Web UI + OpenAI 兼容接口）
references/
  gpu-smoke-sample.txt                       GPU smoke 通过时的样本输出
  deployment-fingerprint-sample.json         部署指纹样例（照此格式生成）
```

---

## 8. 排障速查

| 症状 | 根因 | 解法 |
|---|---|---|
| `cannot import name 'FqnToConfig'` | torchao 版本/底座错 | §5.2：换 26.09 底座 + torchao 0.18.0 |
| 重启后 CPU 100% 但 GPU 不动、永久卡住 | 未设 `local_files_only` | §5.1 |
| 构建日志停在半截进度条、无 RC | ssh 断开杀死子进程 | §5.4 `setsid` |
| `pkill` 后整条命令无输出 | pkill 自匹配 | §5.5 字符类写法 |
| `nvidia-smi --query-gpu` 返回 N/A | GB10 字段不可用 | §5.6 用默认表格 |
| 下载卡在 0%、雷打不动 | 走了 Clash 代理拉大文件 | 见 Phase 5：改 hf-mirror 直连 |
| ComfyUI 起来但不知道怎么出图 | 后端 `/api/templates` 可能 404 | §5.8 直接从容器 pip 包读模板 JSON + 本地出图配方 |
| ComfyUI 离线跑 `/prompt` 报 `Unauthorized: Please login first to use this node.` | 误用了 Templates 里的 cloud API 节点 `QwenImageTextToImageApi` | §5.8：改用本地节点工作流 `templates/comfyui-local-t2i-api.json`，无需登录/联网 |
| ComfyUI `/prompt` 成功但图是**纯噪声**（不报错） | 文本编码器选错（用了 pe_t2i 增强 LLM）或 latent 接错 | §5.8：CLIP 用 `qwen3vl_8b_int8_convrot`，latent 用 `EmptyLatentImage` |
| `/health` 一直空、uvicorn 没监听 | `from_pretrained` 参数顺序语法错（关键字参数后跟位置参数） | 把模型名放第一个位置参数 |

---

## 9. 经验：动手前先做的三件事

1. **先跑 GPU smoke** —— 花 1 分钟证明 GPU 直通可用，避免后面拉完 20G 才发现跑不了。
2. **先测网络三条通道的速度** —— 选错下载通道会浪费几十分钟到几小时。
3. **Host 软件栈别动** —— 这台机器后续还要复用到别的项目，保护区一旦污染很难恢复原样。

---

## 10. 安装完成后离线化（可选，强烈推荐固定部署）

**现象**：权重全部下到本地（hf-cache / comfyui/models）后，服务其实能离线跑；但 `transformers` /
`diffusers` / `vLLM` 在 `from_pretrained` 时会默认去 HuggingFace Hub 做**版本校验**调用（不是下载）。
断网时它会重试超时、再回退本地缓存，白卡好几分钟；网络在但慢时也会拖慢启动。

**根因**：那次校验对"固定版本、不再更新"的部署毫无用处，纯属开销。`HF_HUB_OFFLINE=1`
（图像管线再加 `TRANSFORMERS_OFFLINE=1`）就是告诉 HF 库"永远别联网，只用本地缓存"。

**做法**：在 4 个 compose 的 `environment:` 块、紧跟 `HF_ENDPOINT` 行之后追加两行：

```yaml
      - HF_HUB_OFFLINE=1
      - TRANSFORMERS_OFFLINE=1
```

改完 `docker compose -f ... config -q` 校验，再 `ai.sh use <目标>` 重建容器即可。
实测：vLLM / image-api 离线冷启动均正常、出图/出码 OK、日志 0 条 `Network is unreachable`。
换网络/换 IP 彻底不用再动配置。

> ✅ **§10 的离线结论覆盖 A / B / LLM / C 全部四套**（2026-10-12 修正）：
> `HF_HUB_OFFLINE` / `TRANSFORMERS_OFFLINE` 只管 HF 库的联网校验。**A（Diffusers 无头）** 与
> **B（image-api）** 代码里 `local_files_only=True`，实测断网出图 0 网络错误；**C（ComfyUI）** 在 v0.39.2 +
> 本地节点工作流（§5.8）下也**完全离线出图**（实测纯内网/断网 46s 出一张，不依赖任何登录或云节点）。
> 即：**四套 workload 在权重下齐后都能彻底离线运行**。给 C 的 compose 加这两行环境变量，
> 只是让它别去联网做无谓的 Hub 校验。

⚠️ **不要在模板里预先写死这两行**：首次部署仍需 `huggingface-cli download` 从 hf-mirror 拉权重，
离线模式会让下载直接失败。正确顺序：**模板保留 `HF_ENDPOINT=hf-mirror`（供下载）→ 权重下完验证后 → 再加 HF_HUB_OFFLINE 离线化**。

