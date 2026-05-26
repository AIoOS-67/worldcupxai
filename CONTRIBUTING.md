# Contributing to World Cup X AI

Thanks for your interest in contributing! World Cup X AI is built in the open for the [Google Cloud Rapid Agent Hackathon — Elastic Track](https://rapid-agent.devpost.com/details/elastic-resources). The repo is part of the **AIoOS** family of human-AI coexistence projects.

This guide describes how to propose changes, the local workflow, and the conventions the codebase follows.

---

## 1. Code of Conduct

Be kind, be technical, be specific. We follow the spirit of the Contributor Covenant. Harassment and discrimination of any kind are not tolerated.

---

## 2. Ways to Contribute

- 🐛 **Bug reports** — open an Issue with reproduction steps.
- 💡 **Feature ideas** — open a Discussion or an Issue tagged `enhancement`.
- 📚 **Docs** — small fixes welcome via direct PR.
- 🛠 **MCP tools / ES|QL** — see [`docs/mcp-tools.md`](./docs/mcp-tools.md) for tool authoring conventions.
- 🧪 **Demos & datasets** — synthetic data only; do not commit personal or scraped PII.

---

## 3. Local Workflow

```bash
git clone https://github.com/AIoOS-67/worldcupxai.git
cd worldcupxai
pnpm install
cp .env.example .env.local
pnpm dev
```

See [`docs/setup.md`](./docs/setup.md) for the full Elastic + Agent Builder setup.

---

## 4. Branch & Commit Conventions

- **Branches**: `feat/<area>-<short-name>`, `fix/<area>-<short-name>`, `docs/<topic>`.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) — `feat(agent): add plan_trip workflow`.
- **PRs**: small, focused, and described in plain English. Link the related Issue.

---

## 5. Testing

- `pnpm test` runs unit tests.
- `pnpm test:mcp` runs MCP tool smoke tests against a seeded Elastic project.
- All PRs must pass the GitHub Actions CI defined in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

---

## 6. Security & Secrets

Never commit credentials. Use `.env.local` (gitignored) and Google Secret Manager in production. Report vulnerabilities via [`SECURITY.md`](./SECURITY.md).

---

## 7. License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
