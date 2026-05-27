#!/usr/bin/env node
/**
 * Normalize team & venue names across wcx-teams, wcx-places, and wcx-matches
 * to FIFA's official naming for the 2026 World Cup, while preserving the
 * TheSportsDB-derived names as `alt_names` so existing search hits still work.
 *
 * Why: TheSportsDB returns "South Korea" / "Czech Republic" / "Estadio Azteca",
 * but FIFA's official identifiers are "Korea Republic" / "Czechia" /
 * "Mexico City Stadium". Demos should use FIFA names; search must still hit
 * either spelling.
 *
 * Steps:
 *   1. Extend each index mapping with the new fields (alt_names, fifa_code,
 *      home_code, away_code, home_alt, away_alt, venue_alt).
 *   2. For each team in fifa-names.json: PUT to wcx-teams with name overwritten
 *      to the FIFA name, fifa_code set, and alt_names populated with the
 *      TheSportsDB name.
 *   3. Same for venues → wcx-places.
 *   4. Scan all wcx-matches docs and rewrite home/away/venue to FIFA names,
 *      stash original values under home_alt/away_alt/venue_alt, set
 *      home_code/away_code from the team map.
 *
 * Run:
 *   pnpm run elastic:normalize-names
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ELASTIC_URL = process.env.ELASTIC_CLOUD_URL;
const ELASTIC_KEY = process.env.ELASTIC_API_KEY;

if (!ELASTIC_URL || !ELASTIC_KEY) {
  console.error("❌ Missing ELASTIC_CLOUD_URL or ELASTIC_API_KEY.");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(here, "seed", "fifa-names.json");

interface FifaTeam {
  fifa_code: string;
  fifa_name: string;
  thesportsdb_name: string;
}

interface FifaVenue {
  fifa_name: string;
  city: string;
  thesportsdb_name: string;
}

interface FifaSeed {
  teams: FifaTeam[];
  venues: FifaVenue[];
}

const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as FifaSeed;

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `ApiKey ${ELASTIC_KEY}`
  };
}

async function putMapping(index: string, properties: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${ELASTIC_URL}/${index}/_mapping`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ properties })
  });
  if (res.status >= 200 && res.status < 300) {
    console.log(`   ✅ ${index} mapping extended`);
    return;
  }
  const body = await res.text();
  throw new Error(`PUT _mapping ${index} HTTP ${res.status}: ${body}`);
}

async function searchAll(index: string, source: string[]): Promise<Array<{ _id: string; _source: Record<string, unknown> }>> {
  const res = await fetch(`${ELASTIC_URL}/${index}/_search?size=200`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ _source: source, query: { match_all: {} } })
  });
  const data = (await res.json()) as { hits: { hits: Array<{ _id: string; _source: Record<string, unknown> }> } };
  return data.hits.hits;
}

async function updateDoc(index: string, id: string, doc: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${ELASTIC_URL}/${index}/_update/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ doc })
  });
  if (res.status >= 200 && res.status < 300) return true;
  const body = await res.text();
  console.error(`   ✗ _update ${index}/${id} HTTP ${res.status}: ${body.slice(0, 160)}`);
  return false;
}

async function main(): Promise<void> {
  console.log(`\n🎯 Normalizing names to FIFA official\n`);

  // ----- 1. Extend mappings on the live indices -----
  console.log("1️⃣  Extending index mappings…");
  await putMapping("wcx-teams", {
    fifa_code: { type: "keyword" },
    alt_names: { type: "keyword" }
  });
  await putMapping("wcx-places", {
    alt_names: { type: "keyword" }
  });
  await putMapping("wcx-matches", {
    home_code: { type: "keyword" },
    away_code: { type: "keyword" },
    home_alt:  { type: "keyword" },
    away_alt:  { type: "keyword" },
    venue_alt: { type: "keyword" }
  });

  // ----- 2. Update wcx-teams docs -----
  console.log("\n2️⃣  Updating wcx-teams (48 docs)…");
  const teamDocs = await searchAll("wcx-teams", ["team_id", "name"]);
  const teamByThesportsdb = new Map<string, FifaTeam>();
  for (const t of seed.teams) teamByThesportsdb.set(t.thesportsdb_name, t);
  let teamHits = 0;
  let teamMisses: string[] = [];
  for (const hit of teamDocs) {
    const currentName = hit._source.name as string;
    const fifa = teamByThesportsdb.get(currentName);
    if (!fifa) {
      teamMisses.push(currentName);
      continue;
    }
    const altNames: string[] = [];
    if (fifa.thesportsdb_name !== fifa.fifa_name) altNames.push(fifa.thesportsdb_name);
    const ok = await updateDoc("wcx-teams", hit._id, {
      name: fifa.fifa_name,
      fifa_code: fifa.fifa_code,
      alt_names: altNames,
      updated_at: new Date().toISOString()
    });
    if (ok) {
      teamHits++;
      if (fifa.thesportsdb_name !== fifa.fifa_name) {
        console.log(`   🔄 ${fifa.thesportsdb_name.padEnd(22)} → ${fifa.fifa_name.padEnd(22)} (${fifa.fifa_code})`);
      }
    }
  }
  console.log(`   ${teamHits}/${teamDocs.length} teams normalized`);
  if (teamMisses.length > 0) console.log(`   ⚠ Unmatched: ${teamMisses.join(", ")}`);

  // ----- 3. Update wcx-places docs (stadiums only) -----
  console.log("\n3️⃣  Updating wcx-places (16 stadium docs)…");
  const placeDocs = await searchAll("wcx-places", ["place_id", "name", "type"]);
  const venueByThesportsdb = new Map<string, FifaVenue>();
  for (const v of seed.venues) venueByThesportsdb.set(v.thesportsdb_name, v);
  let venueHits = 0;
  let venueMisses: string[] = [];
  for (const hit of placeDocs) {
    if ((hit._source.type as string) !== "stadium") continue;
    const currentName = hit._source.name as string;
    const fifa = venueByThesportsdb.get(currentName);
    if (!fifa) {
      venueMisses.push(currentName);
      continue;
    }
    const altNames: string[] = [];
    if (fifa.thesportsdb_name !== fifa.fifa_name) altNames.push(fifa.thesportsdb_name);
    const ok = await updateDoc("wcx-places", hit._id, {
      name: fifa.fifa_name,
      alt_names: altNames,
      updated_at: new Date().toISOString()
    });
    if (ok) {
      venueHits++;
      console.log(`   🔄 ${fifa.thesportsdb_name.padEnd(36)} → ${fifa.fifa_name}`);
    }
  }
  console.log(`   ${venueHits}/${placeDocs.filter((d) => (d._source.type as string) === "stadium").length} stadiums normalized`);
  if (venueMisses.length > 0) console.log(`   ⚠ Unmatched: ${venueMisses.join(", ")}`);

  // ----- 4. Update wcx-matches docs -----
  console.log("\n4️⃣  Updating wcx-matches (rewrite home/away/venue)…");
  const matchDocs = await searchAll("wcx-matches", ["match_id", "home", "away", "venue"]);
  let matchHits = 0;
  let matchMisses: string[] = [];
  for (const hit of matchDocs) {
    const home = hit._source.home as string;
    const away = hit._source.away as string;
    const venue = hit._source.venue as string | undefined;
    const homeFifa = teamByThesportsdb.get(home);
    const awayFifa = teamByThesportsdb.get(away);
    const venueFifa = venue ? venueByThesportsdb.get(venue) : undefined;
    if (!homeFifa || !awayFifa) {
      matchMisses.push(`${home} vs ${away}`);
      continue;
    }
    const patch: Record<string, unknown> = {
      home: homeFifa.fifa_name,
      away: awayFifa.fifa_name,
      home_code: homeFifa.fifa_code,
      away_code: awayFifa.fifa_code,
      home_alt: homeFifa.thesportsdb_name !== homeFifa.fifa_name ? homeFifa.thesportsdb_name : undefined,
      away_alt: awayFifa.thesportsdb_name !== awayFifa.fifa_name ? awayFifa.thesportsdb_name : undefined,
      updated_at: new Date().toISOString()
    };
    if (venueFifa) {
      patch.venue = venueFifa.fifa_name;
      patch.city = venueFifa.city;
      patch.venue_alt = venueFifa.thesportsdb_name !== venueFifa.fifa_name ? venueFifa.thesportsdb_name : undefined;
    }
    const ok = await updateDoc("wcx-matches", hit._id, patch);
    if (ok) matchHits++;
  }
  console.log(`   ${matchHits}/${matchDocs.length} matches normalized`);
  if (matchMisses.length > 0) console.log(`   ⚠ Unmatched: ${matchMisses.slice(0, 5).join(", ")}${matchMisses.length > 5 ? "…" : ""}`);

  console.log(`\n🎉 Normalization complete\n`);
}

main().catch((err) => {
  console.error("💥 Unhandled error:", err);
  process.exit(1);
});
