# Agent Skills Lab

**Turn solved problems into reusable Agent Skills.**

A practical collection of Agent Skills for infrastructure, security, development, productivity, and publishing.

Maintained by [@ha2fde](https://github.com/ha2fde). Skills follow the `SKILL.md` convention and are intended for compatible agents such as Claude Code, Codex, Cursor, and OpenCode. Availability of an installation method does not mean every workflow has been tested in every client.

## Skills

| Category | Skill | Purpose | Validation |
|---|---|---|---|
| Security | [apache-security-reporting](skills/apache-security-reporting/SKILL.md) | Confidential ASF vulnerability reporting, technical review, concise email drafting, and manual sending | Compared with sent-email formats; cross-agent execution not tested |
| Publishing | [wechat-publisher](skills/wechat-publisher/SKILL.md) | WeChat article creation, covers, mobile formatting, image uploads, and draft verification | Cover upload and draft readback tested; mobile preview requires manual review |
| AI infrastructure | [spark-ai-stack-deploy](skills/spark-ai-stack-deploy/SKILL.md) | DGX Spark workload deployment, operations, and validation | Archived deployment records; not independently retested |
| Operations | [tailscale-macos](skills/tailscale-macos/SKILL.md) | Tailscale setup, SSH access, and troubleshooting on macOS | Structure checked; hardware not retested |
| Operations | [macos-remote-power](skills/macos-remote-power/SKILL.md) | Mac wakefulness, remote access, and rollback | Structure checked; hardware not retested |
| Development | [synology-gitea](skills/synology-gitea/SKILL.md) | Synology Gitea deployment and multi-remote Git backups | Structure checked; deployment not retested |
| Productivity | [workbuddy-daily-checkin](skills/workbuddy-daily-checkin/SKILL.md) | WorkBuddy daily check-in automation | Structure checked; live campaign not retested |

## MCP Plugins

| Plugin | Purpose | Deployment |
|---|---|---|
| [WeChat Draft Assistant](plugins/wechat-draft-assistant/README.md) | Read, create, and update WeChat drafts; upload covers and article images | Self-hosted Node.js / Docker; configure your own account; stdio or Bearer HTTP |

Plugins live under `plugins/` and are **not** installed through `npx skills add`. See each plugin's README for setup, compatibility, and validation scope.

## Installation

List the available skills:

```bash
npx skills add ha2fde/agent-skills-lab --list
```

Install an individual skill for a compatible agent (examples):

```bash
npx skills add ha2fde/agent-skills-lab --skill apache-security-reporting -g -a codex
npx skills add ha2fde/agent-skills-lab --skill wechat-publisher -g -a codex
npx skills add ha2fde/agent-skills-lab --skill spark-ai-stack-deploy -g -a codex
npx skills add ha2fde/agent-skills-lab --skill tailscale-macos -g -a claude-code
npx skills add ha2fde/agent-skills-lab --skill macos-remote-power -g -a codex
npx skills add ha2fde/agent-skills-lab --skill synology-gitea -g -a cursor
npx skills add ha2fde/agent-skills-lab --skill workbuddy-daily-checkin -g -a claude-code
```

If you previously cloned skills directly into `~/.claude/skills`, read the [migration guide](docs/migration.md) before changing your installation.

## Roadmap

| Area | Planned topics |
|---|---|
| AI infrastructure | Local model deployment, benchmarking, and performance |
| Security | Code auditing, agentic vulnerability research, fuzzing, vulnerability verification, and supply-chain security |
| Operations | Operating systems, remote access, and service maintenance |
| Development | Git, development environments, build tooling, and automation |
| Productivity | Documents, data processing, and reusable workflows |

Planned topics are not advertised as working skills until implemented and validated.

## Repository conventions

- Published skills live under `skills/<skill-name>/` and are indexed in [catalog.json](catalog.json).
- Each skill includes the scripts, references, and assets needed for its workflow.
- Starter templates live under `templates/` to avoid being mistaken for installed skills.
- Skill names use lowercase letters and hyphens.
- Validation labels distinguish structural checks from actual runtime tests.
- **Security confidentiality:** Public skill files, paths, commit messages, and changelogs must never disclose embargoed vulnerability findings or private report content.

See the [skill design guide](docs/skill-design-guide.md), [contribution guide](CONTRIBUTING.md), [publishing guide](docs/publishing.md), and [roadmap](docs/roadmap.md).

References: [Agent Skills specification](https://agentskills.io/specification) · [skills CLI](https://github.com/vercel-labs/skills)

## Licensing

Check the target platform and parameters before running installation or operational scripts. Archived scripts are retained but have not all been rerun during migration.

The WorkBuddy Daily Check-in skill retains its MIT license. The `plugins/wechat-draft-assistant/` directory is separately licensed under MIT. Other content does not currently have a repository-wide open-source license; public visibility alone does not grant redistribution rights.
