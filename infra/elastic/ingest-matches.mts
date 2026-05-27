#!/usr/bin/env node
/**
 * Ingest 2026 FIFA World Cup matches into `wcx-matches` by calling
 * TheSportsDB `eventsseason.php?id=4429&s=2026` and mapping each event
 * to the mapping declared in `infra/elastic/mappings/wcx-matches.json`.
 *
 * Notes:
 *   - Free public test key ("3") returns ~15 events. The paid Business plan
 *     (120 req/min) returns the full schedule. Set THESPORTSDB_API_KEY.
 *   - Uses `intRound` to assign `stage`. 1–3 = group, then knockout rounds.
 *   - `city` is left blank here on purpose: it's joined from `wcx-places`
 *     via `venue` name at query time (or by a later enrichment pass).
 *
 * Run:
 *   pnpm run elastic:ingest:matches
 */

const ELASTIC_URL = process.env.ELASTIC_CLOUD_URL;
const ELASTIC_KEY = process.env.ELASTIC_API_KEY;
const SPORTS_KEY = process.env.THESPORTSDB_API_KEY || "3";

if (!ELASTIC_URL || !ELASTIC_KEY) {
  console.error("❌ Missing ELASTIC_CLOUD_URL or ELASTIC_API_KEY.");
  process.exit(1);
}

const SPORTS_BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTS_KEY}`;
const WC_2026_LEAGUE_ID = "4429";

interface SportsDbEvent {
  idEvent: string;
  idLeague?: string;
  strLeague?: string;
  strSeason?: string;
  strEvent?: string;
  strFilename?: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  intRound?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strTimestamp?: string;
  dateEvent?: string;
  strTime?: string;
  strVenue?: string;
  strCountry?: string;
  strStatus?: string;
}

interface WcxMatch {
  match_id: string;
  home: string;
  away: string;
  kickoff_at?: string;
  tz?: string;
  stage: string;
  group?: string;
  city?: string;
  venue?: string;
  country?: string;
  score?: {
    home?: number;
    away?: number;
  };
  summary?: string;
  created_at: string;
  updated_at: string;
}

function stageFromRound(intRound?: string): string {
  const n = Number(intRound ?? "0");
  if (n >= 1 && n <= 3) return "group";
  if (n === 125) return "round-of-32";
  if (n === 150) return "round-of-16";
  if (n === 200) return "quarterfinal";
  if (n === 500) return "semifinal";
  if (n === 1000) return "final";
  if (n === 2000) return "third-place";
  return "unknown";
}

function toMatch(e: SportsDbEvent): WcxMatch {
  const now = new Date().toISOString();
  const scoreH = e.intHomeScore != null ? Number(e.intHomeScore) : undefined;
  const scoreA = e.intAwayScore != null ? Number(e.intAwayScore) : undefined;
  const score =
    Number.isFinite(scoreH) || Number.isFinite(scoreA)
      ? { home: scoreH, away: scoreA }
      : undefined;
  return {
    match_id: e.idEvent,
    home: e.strHomeTeam,
    away: e.strAwayTeam,
    kickoff_at: e.strTimestamp ? new Date(`${e.strTimestamp}Z`).toISOString() : undefined,
    stage: stageFromRound(e.intRound),
    venue: e.strVenue,
    country: e.strCountry,
    score,
    summary: e.strFilename ?? e.strEvent,
    created_at: now,
    updated_at: now
  };
}

async function indexDoc(id: string, doc: WcxMatch): Promise<boolean> {
  const res = await fetch(`${ELASTIC_URL}/wcx-matches/_doc/${encodeURIComponent(id)}`, {
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
  console.log(`\n⚽ Ingesting WC2026 matches → wcx-matches`);
  console.log(`   Elastic:     ${ELASTIC_URL}`);
  console.log(`   TheSportsDB: key=${SPORTS_KEY === "3" ? "<public test key — limited results>" : "<paid>"}\n`);

  const res = await fetch(`${SPORTS_BASE}/eventsseason.php?id=${WC_2026_LEAGUE_ID}&s=2026`);
  if (!res.ok) {
    console.error(`❌ TheSportsDB HTTP ${res.status}`);
    process.exit(1);
  }
  const data = (await res.json()) as { events?: SportsDbEvent[] };
  const events = data.events ?? [];
  console.log(`📥 Pulled ${events.length} events from TheSportsDB\n`);

  let ok = 0;
  let failed = 0;

  for (const e of events) {
    const doc = toMatch(e);
    const kickoff = doc.kickoff_at?.slice(0, 10) ?? "?";
    process.stdout.write(`⚽ [${kickoff}] ${doc.home} vs ${doc.away} (${doc.stage}) ... `);
    const success = await indexDoc(doc.match_id, doc);
    if (success) {
      console.log("✅");
      ok++;
    } else {
      failed++;
    }
  }

  console.log(`\n🎉 Ingest complete — ok=${ok}, failed=${failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("💥 Unhandled error:", err);
  process.exit(1);
});
