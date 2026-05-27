#!/usr/bin/env node
/**
 * Ingest the 16 World Cup 2026 host stadiums into `wcx-places` by looking up
 * each `idVenue` against TheSportsDB and mapping the response to the index
 * mapping declared in `infra/elastic/mappings/wcx-places.json`.
 *
 * The `description` field is `semantic_text` so the cluster will embed it via
 * the bound `.jina-embeddings-v5-text-small` inference endpoint at index time.
 *
 * Run:
 *   pnpm run elastic:ingest:venues
 *
 * Requires env vars (loaded from `apps/web/.env.local` via Node --env-file):
 *   - ELASTIC_CLOUD_URL
 *   - ELASTIC_API_KEY
 *   - THESPORTSDB_API_KEY   (use "3" for the public test key; paid Business
 *                            key gives 120 req/min and full data)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ELASTIC_URL = process.env.ELASTIC_CLOUD_URL;
const ELASTIC_KEY = process.env.ELASTIC_API_KEY;
const SPORTS_KEY = process.env.THESPORTSDB_API_KEY || "3";

if (!ELASTIC_URL || !ELASTIC_KEY) {
  console.error("❌ Missing ELASTIC_CLOUD_URL or ELASTIC_API_KEY.");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(here, "seed", "wc2026-venues.json");
const SPORTS_BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTS_KEY}`;

interface SeedVenue {
  idVenue: string;
  code: string;
  city: string;
  country: string;
  match_count: number;
  phases: string[];
}

interface SportsDbVenue {
  idVenue: string;
  strVenue: string;
  strVenueAlternate?: string;
  strDescriptionEN?: string;
  intCapacity?: string;
  strArchitect?: string;
  strLocation?: string;
  strCountry?: string;
  strTimezone?: string;
  intFormedYear?: string;
  strMap?: string;
  strWebsite?: string;
  strThumb?: string;
  strLogo?: string;
}

interface WcxPlace {
  place_id: string;
  name: string;
  type: string;
  location: { lat: number; lon: number } | null;
  city: string;
  country: string;
  description: string;
  tags: string[];
  languages: string[];
  url?: string;
  near_venue?: string;
  created_at: string;
  updated_at: string;
}

function parseMap(strMap?: string): { lat: number; lon: number } | null {
  if (!strMap) return null;
  const m = strMap.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (!m) return null;
  return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
}

async function fetchVenue(idVenue: string): Promise<SportsDbVenue | null> {
  const res = await fetch(`${SPORTS_BASE}/lookupvenue.php?id=${idVenue}`);
  if (!res.ok) {
    console.error(`   ✗ TheSportsDB HTTP ${res.status} for idVenue=${idVenue}`);
    return null;
  }
  const data = (await res.json()) as { venues?: SportsDbVenue[] };
  return data.venues?.[0] ?? null;
}

function toPlace(seed: SeedVenue, sdb: SportsDbVenue): WcxPlace {
  const now = new Date().toISOString();
  const tags = ["world-cup-2026", "stadium", "fifa", ...seed.phases.map((p) => p.toLowerCase().replace(/\s+/g, "-"))];
  return {
    place_id: `wc2026-venue-${seed.idVenue}`,
    name: sdb.strVenue,
    type: "stadium",
    location: parseMap(sdb.strMap),
    city: seed.city,
    country: seed.country,
    description: sdb.strDescriptionEN ?? `${sdb.strVenue} — host stadium for the 2026 FIFA World Cup in ${seed.city}, ${seed.country}.`,
    tags,
    languages: ["en"],
    url: sdb.strWebsite ? (sdb.strWebsite.startsWith("http") ? sdb.strWebsite : `https://${sdb.strWebsite}`) : undefined,
    near_venue: `wc2026-venue-${seed.idVenue}`,
    created_at: now,
    updated_at: now
  };
}

async function indexDoc(id: string, doc: WcxPlace): Promise<boolean> {
  const res = await fetch(`${ELASTIC_URL}/wcx-places/_doc/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `ApiKey ${ELASTIC_KEY}`
    },
    body: JSON.stringify(doc)
  });
  if (res.status >= 200 && res.status < 300) return true;
  const body = await res.text();
  console.error(`   ✗ Elastic HTTP ${res.status}: ${body.slice(0, 200)}`);
  return false;
}

async function main(): Promise<void> {
  console.log(`\n🌎 Ingesting WC2026 venues → wcx-places`);
  console.log(`   Elastic:     ${ELASTIC_URL}`);
  console.log(`   TheSportsDB: key=${SPORTS_KEY === "3" ? "<public test key>" : "<paid>"}\n`);

  const seedDoc = JSON.parse(readFileSync(SEED_PATH, "utf8")) as { venues: SeedVenue[] };
  const seeds = seedDoc.venues;

  let ok = 0;
  let failed = 0;

  for (const seed of seeds) {
    process.stdout.write(`📍 ${seed.code.padEnd(16)} (idVenue=${seed.idVenue}) ... `);
    const sdb = await fetchVenue(seed.idVenue);
    if (!sdb) {
      console.log("skipped (no data)");
      failed++;
      continue;
    }
    const doc = toPlace(seed, sdb);
    const success = await indexDoc(doc.place_id, doc);
    if (success) {
      console.log(`✅ ${doc.name}`);
      ok++;
    } else {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n🎉 Ingest complete — ok=${ok}, failed=${failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("💥 Unhandled error:", err);
  process.exit(1);
});
