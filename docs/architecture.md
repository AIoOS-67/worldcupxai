# World Cup X AI — Architecture

> Detailed companion to the diagrams in [`README.md`](../README.md).
> Audience: hackathon judges, contributors, and integration partners.

---

## 1. Goals & Non-Goals

**Goals**
- Deliver a single conversational entry point that answers *and* acts on World-Cup-related tasks for fans, merchants, fantasy players, and journalists.
- Demonstrate **deep** integration with Elastic Agent Builder (hybrid retrieval, ES|QL tools, workflows, sub-agents, memory layer, MCP).
- Be reproducible in <30 minutes by a third party with an Elastic Cloud Serverless trial and a Google Cloud project.

**Non-Goals (Hackathon scope)**
- We are not building a ticketing marketplace; we surface and link.
- We are not training new models; we use Gemini 3 + Elastic-hosted ELSER.
- We do not store payment data; transactional handoffs go to partner sites.

---

## 2. Logical Architecture

```
              ┌──────────────────────────────┐
              │  Channels                    │
              │  Web · PWA · Telegram · WA   │
              └──────────────┬───────────────┘
                             │
              ┌──────────────▼───────────────┐
              │  Google Cloud Agent Builder  │
              │  (Gemini 3 — orchestrator)   │
              └──────────────┬───────────────┘
                             │ MCP
              ┌──────────────▼───────────────┐
              │  Elastic Agent Builder       │
              │  - MCP server                │
              │  - Tools (ES|QL + Workflows) │
              │  - Sub-agents                │
              │  - Hosted ELSER / embeddings │
              └─────┬─────────┬─────────┬────┘
                    │         │         │
            ┌───────▼──┐  ┌───▼────┐  ┌─▼─────────┐
            │ Domain   │  │ Memory │  │ External  │
            │ Indices  │  │ Index  │  │ APIs &    │
            │ (6 total)│  │        │  │ Connectors│
            └──────────┘  └────────┘  └───────────┘
```

---

## 3. Component Responsibilities

| Component | Responsibility |
| --- | --- |
| **Channels** | Render conversational UI; capture intent, locale, and auth context |
| **Agent Builder (Gemini 3)** | Reasoning, planning, tool selection, response synthesis |
| **Elastic MCP Server** | Expose every Elastic tool/workflow over MCP; enforce auth |
| **Domain Indices** | Authoritative retrieval surface (matches, places, reviews, news, fantasy) |
| **Memory Index** | Persistent user/agent state — preferences, decisions, insights |
| **Workflows** | Multi-step orchestrations with sub-agents and write-backs |
| **External APIs** | Source data and action endpoints (FIFA, Maps, flights, etc.) |

---

## 4. Data Flow — Plan a Multi-City Trip

1. User states intent: team, budget, origin.
2. Agent calls `recall_user_memory` to bring prior context.
3. Agent calls `find_match` to enumerate candidate fixtures.
4. Agent invokes the `plan_trip` workflow:
   - Sub-agent A: flight search
   - Sub-agent B: hotel + fan-zone search (geo)
   - Sub-agent C: visa / ESTA checks
5. Workflow runs **conflict detection** across legs.
6. Agent synthesizes itinerary, calls `save_insight` to persist outcome.
7. Response is rendered with calendar export and follow-up nudges.

---

## 5. Cross-Cutting Concerns

- **Multilingual**: ELSER + Gemini handle EN / ES / PT / ZH / AR. UI is English-first.
- **Latency budget**: <2s p95 for read tools; workflows stream partial answers.
- **Security**: Elastic API key per environment, OAuth for end-users, secrets in Google Secret Manager.
- **Observability**: structured logs to Google Cloud Logging; Elastic telemetry for index/tool usage.
- **Cost controls**: tool quotas per session, cached retrievals, ELSER for cheap semantic lift.

---

## 6. Open Questions / Future Work

- Add a merchant dashboard (Next.js) reading directly from `wcx-reviews` aggregations.
- Add A2A protocol bridge so other agents can subscribe to matchday briefs.
- Move conflict detection to a typed planner once Workflows expose function-level types.
