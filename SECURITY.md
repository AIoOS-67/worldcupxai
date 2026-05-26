# Security Policy — World Cup X AI

We take the security of World Cup X AI and the data flowing through it seriously. This document explains how to report a vulnerability and the practices we follow.

---

## Supported Versions

| Version | Supported |
| --- | --- |
| `main` (rolling) | ✅ |
| Hackathon submission tag | ✅ |
| Older feature branches | ❌ |

---

## Reporting a Vulnerability

Please **do not** open public Issues for security problems.

1. Email the maintainer through the GitHub profile contact on [@AIoOS-67](https://github.com/AIoOS-67).
2. Include:
   - A clear description of the issue
   - Reproduction steps or a proof of concept
   - Affected commit/branch, environment, and impact
3. We aim to acknowledge within **72 hours** and provide a remediation timeline within **7 days**.

---

## Scope

In scope:
- The code in this repository (`apps/web`, `apps/agent`, `infra/*`).
- Configuration that ships in the repository.
- Public deployments of `worldcupxai.com` operated by the maintainers.

Out of scope:
- Upstream services (Elastic Cloud, Google Cloud, Gemini, third-party APIs).
- Social-engineering, DoS, or physical attacks.

---

## Handling Practices

- **Secrets**: never committed; loaded from environment variables / Google Secret Manager.
- **Auth**: Elasticsearch API keys are scoped per environment with least privilege.
- **Data**: user memory entries are user-scoped and may be deleted on request.
- **Dependencies**: GitHub Dependabot alerts are reviewed weekly.
- **Reviews**: security-sensitive PRs require a second reviewer.

---

## Responsible Disclosure

We thank researchers who follow coordinated disclosure. With permission we will credit reporters in release notes once a fix has shipped.
