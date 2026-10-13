# 路线图

## 已整理

- tailscale-macos：operations
- macos-remote-power：operations
- synology-gitea：development
- workbuddy-daily-checkin：productivity，保留 MIT 许可证

- spark-ai-stack-deploy：ai-infra，2026-10-13 从上传部署记录归档；包含 20 个源文件及归档适配说明。本次只做结构与语法检查，原作者实测与本次验证分开记录。

## 下一批

已有 spark-ai-stack-deploy 覆盖 DGX Spark 部署流程，暂不重复创建 dgx-spark-local-llm；后续根据复测结果完善参数化、依赖锁定及验收覆盖。
范围：环境检查、引擎选择、部署、启停/status/help、API 初验、吞吐与延迟、质量验收、故障恢复。
完成实际机器验证后才进入 skills/；当前不创建空壳技能。

后续按真实需求增加 security、development、productivity 等技能，不预先生成大量未验证技能。

## 发布准备

仓库正式命名已完成。完成客户端安装验证、完整历史检查和许可证选择后，准备公共发布。
