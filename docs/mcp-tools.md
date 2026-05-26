# MCP Tools — World Cup X AI

> **Stub** — this file documents the seven Model Context Protocol (MCP) tools that World Cup X AI exposes to Gemini 3 via Elastic Agent Builder.
> Full JSON Schemas and ES|QL bodies will land here during Sprint Week 1 (`feat/mcp-tools-v1`).

---

## Tool Catalog (v0)

| # | Tool | Type | Index | Status |
|---|------|------|-------|--------|
| 1 | `find_match` | ES\|QL | `wcx-matches` | 🟡 design |
| 2 | `nearby_fanzones` | ES\|QL + geo | `wcx-places` | 🟡 design |
| 3 | `semantic_review_search` | ELSER hybrid | `wcx-reviews` | 🟡 design |
| 4 | `sentiment_report` | ES\|QL STATS | `wcx-reviews` | 🟡 design |
| 5 | `recall_user_memory` | semantic_text | `wcx-memory` | 🟡 design |
| 6 | `save_insight` | bulk index | `wcx-memory` | 🟡 design |
| 7 | `fantasy_optimize` | ES\|QL + LLM rerank | `wcx-fantasy` | 🟡 design |

---

## Authoring Conventions

- **Schema**: every tool ships a strict JSON Schema for input + output.
- **Naming**: `snake_case`, verb-first (`find_*`, `recall_*`, `save_*`).
- **Idempotency**: read tools are idempotent; write tools accept an optional `idempotency_key`.
- **Errors**: return `{ ok: false, code, message }` rather than throwing.
- **Locale**: every tool accepts an optional `locale` (BCP-47); defaults to `en`.

---

## Roadmap

- [ ] Land detailed JSON Schemas for tools 1–7
- [ ] Land ES|QL bodies referenced by each tool
- [ ] Add request/response examples per tool
- [ ] Add load-testing notes and quotas
- [ ] Wire MCP smoke tests into CI

> See [`docs/architecture.md`](./architecture.md) for the surrounding system and [`docs/elastic-mappings.md`](./elastic-mappings.md) for the indices these tools query.
