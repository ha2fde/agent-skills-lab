# Triage and follow-up

## Before submitting
1. Read the project's current security model, reporting policy, supported-version guidance, and the official sources in public-policy-sources.md.
2. Separate runtime results, static findings, prerequisites, and hypotheses. Identify the security expectation violated.
3. Search public advisories and current source, development/release branches, and open PRs. A latest-release reproduction alone does not establish novelty.
4. Inspect candidate patch contents rather than relying on titles, dates, CWE labels, or shared impact. Determine whether they address the same root cause and entry path.
5. Record the user's submission time and candidate patch public availability separately. Commit author/committer dates alone do not prove when code first became public. A private patch, public PR, merged commit, released fix, and published CVE are distinct.
6. If a public patch appears relevant, explain the overlap privately. Do not claim a bypass or an independent vulnerability without evidence that the reported path remains outside its coverage.
7. Keep historical comparisons in the private assessment by default; preserve the concise first-contact email format.

## Roles and authority
| Role | Practical responsibility | Interpretation boundary |
| --- | --- | --- |
| ASF Security Team | Foundation-wide intake, screening, coordination, project referral and CVE support | A receipt or referral is not project acceptance. Screening can include technical judgment and can end without referral. |
| Project PMC (Project Management Committee) | Governance and accountability for a specific project, including organizing investigation, remediation and releases | There is no single foundation-wide PMC deciding every project's reports. Do not infer a collective PMC decision from an individual's acknowledgment. |
| Project security team, where established | Day-to-day confidential vulnerability handling under the project's published arrangements | Membership and delegation vary; do not assume every project has the same organization. |
| Release manager or designated coordinator | Fix integration, release coordination and advisory scheduling | Release timing, technical validity and credit decisions are separate states. |

Identify the actual sender and their capacity from the current message, signature, recipients and project policy. Distinguish newly written text from quoted/forwarded messages. If needed verify current official membership, but membership alone does not establish authority for a particular decision or participation in a private case. Do not hard-code people's names, addresses, affiliations or response-speed rankings in this public skill. Keep all actual case correspondence and participant associations private.

## Interpret a reply
Extract:
- Decision-maker: ASF Security, project security team/PMC, individual reviewer, or automated assistant.
- Stage: acknowledgment, screening, referral, technical investigation, duplicate review, remediation, or disclosure.
- Decision: only what the reply actually says; distinguish rejected validity from declined referral, existing fix, or declined credit.
- Basis: source locations, patch references, reproduced results, policy statements, or generated summaries.
- Verification limits: what the reviewer expressly tested, what they only read, and what remains unknown.
- Next action: wait, supply a specific missing artifact, clarify patch coverage, review a fix, or request accurate credit.

Do not describe a forwarding contact as purely administrative: ASF screening can include technical judgment and stop referral. Conversely, do not infer full project review from an ASF reply. Concrete code references support the presence of technical reasoning, but do not reveal the reviewer's entire investigation.

Treat AI-generated summaries as attributed leads, not confirmed project decisions. Independently check cited public facts; let authorized project reviewers resolve private duplicates.

## Check duplicates and public fixes
Use a compact private evidence table: candidate / source / root cause / affected path / patch coverage / public timing evidence / unresolved points.

Distinguish:
- Same impact or vulnerability class: a search lead.
- Same root cause: may be the same vulnerability despite different payloads or environments.
- Independently verified patch coverage: stronger evidence than a matching title.
- No search result: not proof that a record, report, or patch does not exist.
- Unchanged vulnerable main: does not rule out a fix on another branch or an unmerged public PR.
- Missing official detail: does not prove an identifier is reserved, assigned, rejected, or unpublished.
- Private reference to a CVE: not independent confirmation of the identifier's validity, product association, or public state.

Never publicly query with private report titles, undisclosed identifiers, project-plus-finding combinations, payloads, test identities, or private reply text. For public lookup use already-public identifiers, official repository paths, or generic public terms. Do not submit private excerpts to public issue trackers or search endpoints.

## CVE and credit
- Explain that identifiers track vulnerabilities, while credits acknowledge contributions.
- Check current project guidance before applying the ASF default. Multiple independent reports may be merged under one identifier.
- ASF guidance permits crediting multiple independent reporters and says reporters arriving after a publicly committed fix need not be credited. This is discretion, not a promise or a universal prohibition.
- Do not substitute the CVE publication date or fixed-release date for the public-fix boundary. An existing private identifier alone is not the stated exclusion.
- Consider a publicly visible PR as relevant disclosure evidence; do not invent a universal rule equating all unmerged PRs with the published-commit criterion. Explain uncertainty when timing or patch sufficiency is disputed.
- Distinguish adding an independently accepted reporter from changing an earlier reporter's requested credit; honor the initial credit information and current policy.
- Do not infer that publication workflow stages impose an immutable credit lock. Record editability and willingness to recognize a contribution are different questions.
- Do not claim AI-assisted work is automatically eligible or ineligible. Validate evidence and consult current policy.
- If appropriate, draft a modest private request for independent-reporter or validation credit, using the user's approved identity and stating contributions accurately. Never claim first discovery without evidence.
- Do not promise either advisory credit, a particular credits role, inclusion in the structured CVE record, or a new CVE.

## Maintain private continuity
For each decision retain the actual source privately and separate:
1. Published policy, with URL and access date.
2. Team statement, attributed to author and process stage.
3. Independent verification, with scope and limitations.
4. Inference, explicitly labeled.
5. Pending questions and later updates.

Do not promote a single project's practice to an ASF-wide requirement. A page's last-update date does not prove when each clause was introduced. Preserve historical decisions when updating the current status. Do not include private case records in this public skill, its fixtures, history, branches, or metadata.
