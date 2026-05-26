# Elastic Index Mappings — World Cup X AI

> **Stub** — full JSON mappings live under [`infra/elastic/mappings/`](../infra/elastic/mappings/). This page is the human-readable index of what each index is for, the key fields, and the enrichments applied.

---

## Index Map

| Index | Purpose | Key Fields | Enrichment |
| --- | --- | --- | --- |
| `wcx-matches` | Fixtures, line-ups, injuries | `match_id`, `teams`, `venue`, `kickoff_at`, `summary_vector` | summary embedding |
| `wcx-places` | Cities, venues, hotels, fan zones | `place_id`, `name`, `location` (geo_point), `type` | ELSER on `description` |
| `wcx-reviews` | Multilingual reviews | `place_id`, `text`, `lang`, `sentiment`, `elser_tokens` | ELSER `semantic_text` |
| `wcx-news` | News & public social posts | `source`, `headline`, `body`, `published_at`, `entities` | NER + embedding |
| `wcx-memory` | Agent memory | `user_id`, `session_id`, `kind`, `summary`, `embedding` | ELSER + embedding |
| `wcx-fantasy` | Fantasy decisions & line-ups | `user_id`, `gameweek`, `squad`, `rationale` | embedding on rationale |

---

## Conventions

- **Naming**: `wcx-<domain>` for all indices; aliases per environment (`-dev`, `-prod`).
- **IDs**: deterministic where possible (`match_id`, `place_id`) to allow upsert.
- **Time**: store ISO-8601 in `*_at` fields and a `tz` sibling field.
- **Semantic fields**: use `semantic_text` with hosted ELSER for cheap multilingual recall.
- **Vectors**: `dense_vector` (768 dims) for cross-encoder rerank or rich summary recall.
- **Geo**: every place has `location: geo_point` for distance queries.

---

## Lifecycle

- **Bootstrap**: `pnpm run elastic:bootstrap` creates all indices and ingest pipelines.
- **Backfill**: `pnpm run elastic:seed` loads fixture and place demo data.
- **Retention**: `wcx-news` rolls over weekly; `wcx-memory` is retained indefinitely with TTL on session-scoped docs.

---

## Roadmap

- [ ] Land `infra/elastic/mappings/*.json` for every index
- [ ] Add ingest pipelines for ELSER enrichment & language detection
- [ ] Add ILM policies for rolling indices
- [ ] Add example queries cross-referenced in [`docs/mcp-tools.md`](./mcp-tools.md)
