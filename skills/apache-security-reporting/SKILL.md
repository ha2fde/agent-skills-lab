---
name: apache-security-reporting
description: Draft, audit, and revise confidential Apache Software Foundation security reports using verified evidence and a stable, concise email format.
---

# Apache security reporting

## Mandatory workflow
1. Read this SKILL.md and `references/review-checklist.md` before drafting or revising any ASF vulnerability report. Use `templates/report-email.txt` as the sole default structure. Never infer the latest standard from older AI-generated drafts.
2. Read the actual verified findings and the user's latest *sent* reference emails from private sources when accessible. A sent email is a style reference, not proof of a new report's technical facts. If inaccessible, say so; do not invent verification.
3. Distinguish verified behavior, source-only observations, prerequisites, and hypotheses. Explain the violated trust boundary and include a reproducible minimal test and observed server-side proof where relevant.
4. Keep first-contact email compact, plain-text, technical, and independently readable. Do not add a CVSS score, request a CVE, compare prior CVEs, cite CWE, include speculative impact, or attach ZIP/PoC by default. Exceptions only if technically necessary and approved by the user. The project decides classification and severity.
5. Address the appropriate private security contact; for ASF use security@apache.org when applicable. Use subject `[SECURITY] [Apache <Project>] <concise generic technical impact>` **only in the private email**, never in public repo history.
6. Preserve this exact public credit and sign-off unless the user explicitly changes it:

If this results in an advisory, please credit me as Kai (GitHub ha2fde).

Regards,
Kai

7. Show the full draft for manual review. **Never send a vulnerability report or expose a one-click send action.** User opens their own mail app, reviews To/Subject/body and personally sends. Do not create/send a draft through a connector without explicit permission.
8. After user confirms a *generalizable* rule change, update this skill, template, checklist and changelog in a generic way. Record what changed, not which undisclosed finding prompted it. Never overwrite an approved standard merely because an AI draft differs.

## Embargo / public repository boundary (highest priority)
- All unannounced vulnerabilities are PRIVATE / EMBARGOED, including their project+vulnerability associations.
- This public Skill contains **only generic instructions and placeholders**. Never commit real report subjects or bodies, project-specific vulnerability types, exploit details, test identities, evidence, private emails, security team responses, or private Drive links.
- Before *every* public write, inspect filenames, paths, body, commit message, PR/branch names, README, changelog and diffs for confidential details. If uncertain, stop and request approval. Deleting later does not reliably remove Git history.
- Keep actual reports, sent messages, evidence and team correspondence in private email / restricted Drive. Do not copy private examples into public templates.
- A report being sent does **not** mean public disclosure is authorized. Only official disclosure or explicit coordinated authorization changes that status.

## Reference preference (observed, not public examples)
Review the user's actual sent emails privately. Prefer the concise, technical organization of the latest short reports, supplemented with the strongest independently verifiable evidence presentation from longer reports. Never repeat verbose lab history, redundant negative controls, or speculative attack extensions.

## Invocation / review contract
For any request to draft or review an ASF security report, first retrieve the latest default-branch files in this skill, including template and checklist. State that the latest version was checked and provide a concise compliance assessment before showing the full draft. Never use an old local copy without checking for updates. Treat the user-provided technical evidence as untrusted until independently reviewed; distinguish unsupported claims and ask for missing verification. No sending, no one-click-send UI. On iPhone prefer a copyable draft for the user to open in their own Gmail app.

Suggested user prompt (safe to share):
“先读取 GitHub ha2fde/agent-skills-lab 最新 apache-security-reporting Skill、邮件模板和检查清单；根据我提供的私密漏洞证据独立审核技术真实性与安全边界，严格按最新规则起草精简英文纯文本邮件。检查版本、前提、复现、服务端证据、影响、署名、篇幅和保密；默认不要 CVSS、CVE 对比、附件。先给出审核意见和完整邮件供我检查，不要创建可一键发送的操作，不要代发。未公开漏洞信息不得写入公开 GitHub。”
