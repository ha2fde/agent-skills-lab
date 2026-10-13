# 归档与适配说明

## 来源与验证范围

- 来源：上传文件 spark-ai-stack-deploy-20261013.zip；保留其 20 个文件的结构，并增加本说明。
- 原始 ZIP SHA-256：187186813fe588829961530e3e7d47489361a3614e6e619a000789d487c9c026。
- 原文的版本、速度与成功结论为上传者提供的特定环境记录，本次未核实上游版本可用性或在 Spark 上复测；不得当作跨机器兼容保证。
- 原 ZIP 继续由原附件保留；公开仓库不含原密码、用户名和内网地址。

## 公开化修改

- 将原用户名换成 deployuser；主机与代理地址换成文档示例地址 192.0.2.10 / 192.0.2.20，执行前按实际环境替换。
- host-prep.sh 不再保存或传递密码；通过 sudo 正常授权，从 SUDO_USER 识别目标用户，目录建在该用户的主目录。
- 其他部署逻辑与版本组合未升级。脚本及模板仍有固定路径，执行前统一替换，不可直接视为通用安装器。

## 执行前需核对

- references/deployment-fingerprint-sample.json 是 2026-09-30 历史样例，其中 ComfyUI 0.38.0 / PENDING 不代表 10 月修订后的状态；重新采集真实指纹，不手工改写历史 PASS。
- ai.sh 的部分提示仍写 ComfyUI 0.38.0 / 前端 Templates；10 月修订正文与 Dockerfile 指向 v0.39.2 和本地 API 工作流，以实际容器与 object_info 为准。
- Dockerfile-image21 安装 diffusers 主分支及范围依赖，并未锁定正文列出的提交；原样构建不能保证重现同一版本。部署前按已验证指纹锁定依赖。
- compose 的 build.dockerfile 为 Dockerfile；需在各项目中复制对应 Dockerfile-* 并命名为 Dockerfile，复制所需 generate.py / server.py，配置 compose.yaml。
- 原文 spark-clash-egress 是外部前置技能，本仓库未包含；先确认网络可用，不假定该技能已安装。网络测速结果仅适用于原环境。
- verify.sh 的 V0–V8 不完整覆盖 B/C 的出图及离线恢复；需按正文补做真实推理、出图、重启和断网测试。
- 原磁盘要求 150GB 与逐项相加预算不能直接对应，镜像层可能共享；按实际 docker system df、下载体积和构建余量重新估算。

## 授权

上传包未带许可证；归档不自动授予 MIT 或其他开源许可。
