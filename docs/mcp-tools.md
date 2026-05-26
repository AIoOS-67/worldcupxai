# MCP Tools — World Cup X AI

> Detailed specification of the seven Model Context Protocol (MCP) tools that World Cup X AI exposes to Gemini 3 via **Elastic Agent Builder**.
> All tools follow Elastic Agent Builder authoring conventions and are discovered by Google Cloud Agent Builder over MCP at `/api/agent_builder/mcp`.

---

## Tool Catalog

| # | Tool | Category | Backed By | Writes? |
|---|------|----------|-----------|---------|
| 1 | [`find_match`](#1-find_match) | retrieval | ES\|QL on `wcx-matches` | no |
| 2 | [`nearby_fanzones`](#2-nearby_fanzones) | retrieval | ES\|QL + `geo_distance` on `wcx-places` | no |
| 3 | [`semantic_review_search`](#3-semantic_review_search) | retrieval | ELSER hybrid on `wcx-reviews` | no |
| 4 | [`sentiment_report`](#4-sentiment_report) | analytics | ES\|QL `STATS BY` on `wcx-reviews` | no |
| 5 | [`recall_user_memory`](#5-recall_user_memory) | memory | semantic_text on `wcx-memory` | no |
| 6 | [`save_insight`](#6-save_insight) | memory | bulk index on `wcx-memory` | yes |
| 7 | [`fantasy_optimize`](#7-fantasy_optimize) | workflow | ES\|QL + LLM rerank on `wcx-fantasy` | yes |

---

## Cross-Tool Conventions

- **Naming**: `snake_case`, verb-first.
- **IDs**: every response includes `request_id` (ULID) for tracing.
- **Locales**: every tool accepts optional `locale` (BCP-47, default `en`).
- **Pagination**: list tools accept `limit` (default 10, max 50) and `cursor`.
- **Errors**: tools return `{ ok: false, code, message }`. Codes:
  `BAD_INPUT`, `NOT_FOUND`, `UPSTREAM`, `RATE_LIMITED`, `INTERNAL`.
- **Idempotency**: write tools accept optional `idempotency_key`.
- **PII**: never log raw user prompts; `wcx-memory` stores summaries only.

---

## 1. `find_match`

Look up World Cup fixtures by team, city, date range, or stage.

### Input Schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "team":   { "type": "string", "description": "FIFA team code or name, e.g. ARG" },
    "city":   { "type": "string", "description": "Host city, e.g. Dallas" },
    "stage":  { "type": "string", "enum": ["group","r16","qf","sf","final"] },
    "from":   { "type": "string", "format": "date-time" },
    "to":     { "type": "string", "format": "date-time" },
    "limit":  { "type": "integer", "minimum": 1, "maximum": 50, "default": 10 },
    "locale": { "type": "string", "default": "en" }
  }
}
```

### Output Schema

```json
{
  "type": "object",
  "required": ["ok","matches","request_id"],
  "properties": {
    "ok": { "type": "boolean" },
    "matches": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["match_id","kickoff_at","home","away","city","venue"],
        "properties": {
          "match_id":   { "type": "string" },
          "kickoff_at": { "type": "string", "format": "date-time" },
          "home":       { "type": "string" },
          "away":       { "type": "string" },
          "stage":      { "type": "string" },
          "city":       { "type": "string" },
          "venue":      { "type": "string" },
          "summary":    { "type": "string" }
        }
      }
    },
    "request_id": { "type": "string" }
  }
}
```

### ES|QL Draft

```sql
FROM wcx-matches
| WHERE (team IS NULL OR home == ?team OR away == ?team)
  AND   (city IS NULL OR city == ?city)
  AND   (stage IS NULL OR stage == ?stage)
  AND   (from  IS NULL OR kickoff_at >= ?from)
  AND   (to    IS NULL OR kickoff_at <= ?to)
| KEEP match_id, kickoff_at, home, away, stage, city, venue, summary
| SORT kickoff_at ASC
| LIMIT ?limit
```

### Example Call

```json
{ "team": "ARG", "from": "2026-06-10T00:00:00Z", "limit": 5 }
```

---

## 2. `nearby_fanzones`

Return the top-N fan zones / bars / restaurants near a point.

### Input Schema

```json
{
  "type": "object",
  "required": ["location"],
  "properties": {
    "location": {
      "type": "object",
      "required": ["lat","lon"],
      "properties": {
        "lat": { "type": "number" },
        "lon": { "type": "number" }
      }
    },
    "radius_km": { "type": "number", "minimum": 0.1, "maximum": 50, "default": 5 },
    "type":      { "type": "string", "enum": ["fan_zone","bar","restaurant","hotel"] },
    "limit":     { "type": "integer", "minimum": 1, "maximum": 50, "default": 10 }
  }
}
```

### Output Schema

```json
{
  "type": "object",
  "required": ["ok","places","request_id"],
  "properties": {
    "ok": { "type": "boolean" },
    "places": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["place_id","name","type","location","distance_km"],
        "properties": {
          "place_id":    { "type": "string" },
          "name":        { "type": "string" },
          "type":        { "type": "string" },
          "location":    { "type": "object" },
          "distance_km": { "type": "number" },
          "rating":      { "type": "number" }
        }
      }
    },
    "request_id": { "type": "string" }
  }
}
```

### ES|QL Draft

```sql
FROM wcx-places
| WHERE (type IS NULL OR type == ?type)
| EVAL distance_km = ST_DISTANCE(location, TO_GEOPOINT(?lat, ?lon)) / 1000
| WHERE distance_km <= ?radius_km
| KEEP place_id, name, type, location, rating, distance_km
| SORT distance_km ASC
| LIMIT ?limit
```

### Example Call

```json
{ "location": { "lat": 32.7767, "lon": -96.7970 }, "type": "fan_zone", "radius_km": 3 }
```

---

## 3. `semantic_review_search`

Hybrid (ELSER + BM25) search across multilingual reviews.

### Input Schema

```json
{
  "type": "object",
  "required": ["query"],
  "properties": {
    "query":      { "type": "string", "minLength": 2 },
    "place_id":   { "type": "string" },
    "lang":       { "type": "string", "description": "Optional ISO-639-1 filter" },
    "min_score":  { "type": "number", "default": 0.0 },
    "limit":      { "type": "integer", "minimum": 1, "maximum": 50, "default": 10 }
  }
}
```

### Output Schema

```json
{
  "type": "object",
  "required": ["ok","reviews","request_id"],
  "properties": {
    "ok": { "type": "boolean" },
    "reviews": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["review_id","place_id","text","lang","score"],
        "properties": {
          "review_id": { "type": "string" },
          "place_id":  { "type": "string" },
          "text":      { "type": "string" },
          "lang":      { "type": "string" },
          "score":     { "type": "number" },
          "sentiment": { "type": "string", "enum": ["pos","neu","neg"] }
        }
      }
    },
    "request_id": { "type": "string" }
  }
}
```

### Query Draft (Elasticsearch DSL)

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "place_id": "{{place_id}}" } },
        { "term": { "lang": "{{lang}}" } }
      ],
      "should": [
        {
          "semantic": {
            "field": "text_elser",
            "query": "{{query}}"
          }
        },
        {
          "match": { "text": "{{query}}" }
        }
      ]
    }
  },
  "size": "{{limit}}"
}
```

### Example Call

```json
{ "query": "best vegan tacos near stadium", "place_id": "mx-mexico-city", "limit": 5 }
```

---

## 4. `sentiment_report`

Aggregate review sentiment for a place over a time window.

### Input Schema

```json
{
  "type": "object",
  "required": ["place_id"],
  "properties": {
    "place_id": { "type": "string" },
    "from":     { "type": "string", "format": "date-time" },
    "to":       { "type": "string", "format": "date-time" },
    "group_by": { "type": "string", "enum": ["lang","day","week"], "default": "lang" }
  }
}
```

### Output Schema

```json
{
  "type": "object",
  "required": ["ok","summary","buckets","request_id"],
  "properties": {
    "ok": { "type": "boolean" },
    "summary": {
      "type": "object",
      "properties": {
        "total":    { "type": "integer" },
        "pos":      { "type": "integer" },
        "neu":      { "type": "integer" },
        "neg":      { "type": "integer" },
        "score":    { "type": "number", "description": "(pos - neg) / total" }
      }
    },
    "buckets": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["key","pos","neu","neg"],
        "properties": {
          "key": { "type": "string" },
          "pos": { "type": "integer" },
          "neu": { "type": "integer" },
          "neg": { "type": "integer" }
        }
      }
    },
    "request_id": { "type": "string" }
  }
}
```

### ES|QL Draft

```sql
FROM wcx-reviews
| WHERE place_id == ?place_id
  AND   created_at >= ?from
  AND   created_at <= ?to
| STATS pos = COUNT_IF(sentiment == "pos"),
        neu = COUNT_IF(sentiment == "neu"),
        neg = COUNT_IF(sentiment == "neg")
  BY ?group_by
| SORT ?group_by ASC
```

### Example Call

```json
{ "place_id": "us-dallas-001", "from": "2026-06-01T00:00:00Z", "to": "2026-06-30T00:00:00Z", "group_by": "lang" }
```

---

## 5. `recall_user_memory`

Retrieve relevant memory entries (preferences, decisions, prior insights) for a user.

### Input Schema

```json
{
  "type": "object",
  "required": ["user_id","query"],
  "properties": {
    "user_id": { "type": "string" },
    "query":   { "type": "string", "description": "Free-text intent or topic" },
    "kinds":   {
      "type": "array",
      "items": { "type": "string", "enum": ["preference","decision","insight"] }
    },
    "limit":   { "type": "integer", "minimum": 1, "maximum": 20, "default": 5 }
  }
}
```

### Output Schema

```json
{
  "type": "object",
  "required": ["ok","memories","request_id"],
  "properties": {
    "ok": { "type": "boolean" },
    "memories": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["memory_id","user_id","kind","summary","created_at"],
        "properties": {
          "memory_id":  { "type": "string" },
          "user_id":    { "type": "string" },
          "kind":       { "type": "string" },
          "summary":    { "type": "string" },
          "score":      { "type": "number" },
          "created_at": { "type": "string", "format": "date-time" }
        }
      }
    },
    "request_id": { "type": "string" }
  }
}
```

### Query Draft

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "user_id": "{{user_id}}" } },
        { "terms": { "kind":   {{kinds}} } }
      ],
      "must": [
        { "semantic": { "field": "summary_elser", "query": "{{query}}" } }
      ]
    }
  },
  "size": "{{limit}}"
}
```

### Example Call

```json
{ "user_id": "u_123", "query": "trip plan and supported team", "kinds": ["preference","decision"], "limit": 5 }
```

---

## 6. `save_insight`

Persist a generated insight into the agent memory layer. **Write tool.**

### Input Schema

```json
{
  "type": "object",
  "required": ["user_id","kind","summary"],
  "properties": {
    "user_id":         { "type": "string" },
    "session_id":      { "type": "string" },
    "kind":            { "type": "string", "enum": ["preference","decision","insight"] },
    "summary":         { "type": "string", "minLength": 4, "maxLength": 1000 },
    "context":         {
      "type": "object",
      "properties": {
        "city":   { "type": "string" },
        "team":   { "type": "string" },
        "budget": { "type": "number" }
      }
    },
    "idempotency_key": { "type": "string" }
  }
}
```

### Output Schema

```json
{
  "type": "object",
  "required": ["ok","memory_id","request_id"],
  "properties": {
    "ok":         { "type": "boolean" },
    "memory_id":  { "type": "string" },
    "created":    { "type": "boolean", "description": "false if deduplicated by idempotency_key" },
    "request_id": { "type": "string" }
  }
}
```

### Indexing Sketch

```http
POST /wcx-memory/_doc
{
  "user_id":    "{{user_id}}",
  "session_id": "{{session_id}}",
  "kind":       "{{kind}}",
  "summary":    "{{summary}}",
  "context":    {{context}},
  "created_at": "{{now}}"
}
```

### Example Call

```json
{
  "user_id": "u_123",
  "kind": "decision",
  "summary": "Booked hotel in Dallas for Argentina group stage match on 2026-06-18.",
  "context": { "city": "Dallas", "team": "ARG", "budget": 3000 },
  "idempotency_key": "u_123:trip:2026-06-18"
}
```

---

## 7. `fantasy_optimize`

Suggest line-up changes for a user's fantasy squad based on fixtures, injuries, and form.
Backed by an Elastic **Workflow** that orchestrates retrieval + LLM rerank.

### Input Schema

```json
{
  "type": "object",
  "required": ["user_id","gameweek"],
  "properties": {
    "user_id":   { "type": "string" },
    "gameweek":  { "type": "integer", "minimum": 1 },
    "budget":    { "type": "number", "minimum": 0 },
    "risk":      { "type": "string", "enum": ["low","medium","high"], "default": "medium" }
  }
}
```

### Output Schema

```json
{
  "type": "object",
  "required": ["ok","suggestions","rationale","request_id"],
  "properties": {
    "ok": { "type": "boolean" },
    "suggestions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["action","player_in","player_out","delta_points"],
        "properties": {
          "action":       { "type": "string", "enum": ["transfer","captain","bench"] },
          "player_in":    { "type": "string" },
          "player_out":   { "type": "string" },
          "delta_points": { "type": "number" }
        }
      }
    },
    "rationale":  { "type": "string" },
    "request_id": { "type": "string" }
  }
}
```

### Workflow Sketch

```
fantasy_optimize:
  steps:
    - id: pull_squad
      tool: recall_user_memory     # squad + history
    - id: pull_fixtures
      tool: find_match             # next gameweek
    - id: pull_injuries
      type: esql                   # FROM wcx-matches | WHERE injuries ...
    - id: rerank
      type: llm
      model: gemini-3-pro
      prompt: ./prompts/fantasy_optimize.md
    - id: persist
      tool: save_insight
```

### Example Call

```json
{ "user_id": "u_123", "gameweek": 3, "budget": 100, "risk": "medium" }
```

---

## Smoke Tests (CI)

```bash
pnpm test:mcp -- find_match
pnpm test:mcp -- nearby_fanzones
pnpm test:mcp -- semantic_review_search
pnpm test:mcp -- sentiment_report
pnpm test:mcp -- recall_user_memory
pnpm test:mcp -- save_insight
pnpm test:mcp -- fantasy_optimize
```

Each test seeds Elastic with a fixture document, calls the MCP tool through the Agent Builder dev endpoint, and asserts schema conformance + at least one result for retrieval tools.

---

## Related Docs

- [`docs/architecture.md`](./architecture.md) — system context and data flow
- [`docs/elastic-mappings.md`](./elastic-mappings.md) — index field definitions
- [`docs/setup.md`](./setup.md) — how to register these tools with Agent Builder
