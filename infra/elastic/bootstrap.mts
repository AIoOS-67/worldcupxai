#!/usr/bin/env node
/**
 * Bootstrap Elastic Cloud Serverless indices for World Cup X AI.
 *
 * Reads every `*.json` file under `infra/elastic/mappings/`, creates the
 * corresponding index in the project pointed at by `ELASTIC_CLOUD_URL`,
 * authenticated with `ELASTIC_API_KEY`.
 *
 * Idempotent: indices that already exist are skipped, not overwritten.
 *
 * Run:
 *   pnpm run elastic:bootstrap
 *
 * Requires env vars (loaded from `apps/web/.env.local` via Node --env-file):
 *   - ELASTIC_CLOUD_URL    (e.g. https://<slug>.es.<region>.gcp.elastic.cloud)
 *   - ELASTIC_API_KEY      (base64 `id:secret` API key)
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ELASTIC_URL = process.env.ELASTIC_CLOUD_URL;
const API_KEY = process.env.ELASTIC_API_KEY;

if (!ELASTIC_URL || !API_KEY) {
  console.error(
    "❌ Missing ELASTIC_CLOUD_URL or ELASTIC_API_KEY. " +
      "Did you populate apps/web/.env.local?"
  );
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const MAPPINGS_DIR = path.join(here, "mappings");

type EsResponse = { acknowledged?: boolean; error?: { type: string; reason: string } };

async function request(method: string, pathSegment: string, body?: unknown): Promise<{ status: number; json: EsResponse }> {
  const res = await fetch(`${ELASTIC_URL}${pathSegment}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `ApiKey ${API_KEY}`
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json: EsResponse = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: { type: "parse_error", reason: text } };
  }
  return { status: res.status, json };
}

async function indexExists(name: string): Promise<boolean> {
  const res = await fetch(`${ELASTIC_URL}/${name}`, {
    method: "HEAD",
    headers: { Authorization: `ApiKey ${API_KEY}` }
  });
  return res.status === 200;
}

async function bootstrap(): Promise<void> {
  console.log(`\n🔌 Connecting to ${ELASTIC_URL}\n`);

  // Sanity check: read cluster info.
  const root = await request("GET", "/");
  if (root.status !== 200) {
    console.error(`❌ Auth or connectivity failed: HTTP ${root.status}`, root.json);
    process.exit(1);
  }
  console.log(`✅ Auth OK — Elasticsearch ${(root.json as { version?: { number?: string } }).version?.number ?? "?"}\n`);

  const files = readdirSync(MAPPINGS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    console.warn("⚠ No mapping files found under infra/elastic/mappings/");
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const indexName = file.replace(/\.json$/, "");
    const mappingPath = path.join(MAPPINGS_DIR, file);
    const mapping = JSON.parse(readFileSync(mappingPath, "utf8"));

    process.stdout.write(`📦 ${indexName} ... `);

    if (await indexExists(indexName)) {
      console.log("already exists, skipping");
      skipped++;
      continue;
    }

    const res = await request("PUT", `/${indexName}`, mapping);
    if (res.status >= 200 && res.status < 300 && res.json.acknowledged) {
      console.log("created ✅");
      created++;
    } else {
      console.log(`failed ❌ (HTTP ${res.status})`);
      console.error("   ", JSON.stringify(res.json));
      process.exit(1);
    }
  }

  console.log(`\n🎉 Bootstrap complete — created ${created}, skipped ${skipped}\n`);
}

bootstrap().catch((err) => {
  console.error("💥 Unhandled error:", err);
  process.exit(1);
});
