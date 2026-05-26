# Setup Guide — World Cup X AI

> End-to-end setup for running the World Cup X AI agent locally and wiring it to Elastic Cloud Serverless + Google Cloud Agent Builder.

---

## 1. Prerequisites

- **Node 20+** and **pnpm 9+**
- **Google Cloud project** with Vertex AI + Agent Builder enabled
- **Elastic Cloud account** (free Serverless trial is fine): https://cloud.elastic.co
- A modern shell with `gcloud` and `curl` installed

---

## 2. Provision Elastic Cloud Serverless

1. Sign in at https://cloud.elastic.co and create a **Serverless Elasticsearch** project in your preferred Google Cloud region.
2. Open **Kibana → Agent Builder** and enable it. Copy the **MCP endpoint** URL.
3. Create an **API key** with read/write on the `wcx-*` index pattern.

---

## 3. Configure Google Cloud Agent Builder

1. In the Google Cloud console, open **Agent Builder** and create a new agent (model = Gemini 3).
2. Add an **MCP tool source** pointing at the Elastic MCP endpoint from step 2.
3. Authenticate with the Elasticsearch API key.
4. Gemini 3 will now discover the tools defined in this repo.

---

## 4. Clone & Configure

```bash
git clone https://github.com/AIoOS-67/worldcupxai.git
cd worldcupxai
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`:

```env
ELASTIC_CLOUD_URL=...
ELASTIC_API_KEY=...
GCP_PROJECT_ID=...
GEMINI_MODEL=gemini-3-pro
MCP_ENDPOINT=https://<your-elastic>/api/agent_builder/mcp
```

---

## 5. Bootstrap Indices & Tools

```bash
# Create all 6 indices, pipelines, and ILM policies
pnpm run elastic:bootstrap

# Register MCP tools (find_match, plan_trip, ...) with Agent Builder
pnpm run agent:register

# Seed demo data so the agent has something to talk about
pnpm run elastic:seed
```

---

## 6. Run

```bash
pnpm dev
# → http://localhost:3000
```

You should be able to type *"I support Argentina, $3K budget, flying from Shanghai"* and watch the agent plan a multi-city trip.

---

## 7. Deploy

- **Frontend**: Vercel project pointing at `apps/web` (domain: `worldcupxai.com`).
- **Background jobs**: Cloud Run + Cloud Scheduler for cron-style ingest.
- **Secrets**: store all keys in Google Secret Manager; never commit `.env.local`.

---

## 8. Troubleshooting

- **Tool not visible in Gemini** → re-run `pnpm run agent:register` and refresh the Agent Builder UI.
- **`ELSER` model 404** → enable the model from Kibana → ML → Trained models.
- **Geo queries empty** → ensure `wcx-places` mapping has `location: geo_point` and reseed.

> For deeper dives see [`docs/architecture.md`](./architecture.md), [`docs/mcp-tools.md`](./mcp-tools.md), and [`docs/elastic-mappings.md`](./elastic-mappings.md).
