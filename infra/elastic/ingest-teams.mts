#!/usr/bin/env node
/**
 * Ingest the 48 national teams competing in the 2026 FIFA World Cup into
 * `wcx-teams`. Team IDs are discovered by scanning the already-ingested
 * `wcx-matches` index for unique idHomeTeam / idAwayTeam values, then each
 * team's full record is fetched from TheSportsDB.
 *
 * Confederation is inferred from a country → confederation lookup (FIFA's
 * six confederations).
 *
 * Run:
 *   pnpm run elastic:ingest:teams
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

const CONFEDERATION: Record<string, string> = {
  // UEFA
  France: "UEFA", Germany: "UEFA", England: "UEFA", Spain: "UEFA",
  Italy: "UEFA", Portugal: "UEFA", Netherlands: "UEFA", Belgium: "UEFA",
  Croatia: "UEFA", Switzerland: "UEFA", Denmark: "UEFA", Austria: "UEFA",
  Sweden: "UEFA", Norway: "UEFA", Poland: "UEFA", Ukraine: "UEFA",
  "Czech Republic": "UEFA", Scotland: "UEFA", Turkey: "UEFA",
  "Bosnia-Herzegovina": "UEFA", "Bosnia and Herzegovina": "UEFA",
  Serbia: "UEFA", Hungary: "UEFA", Greece: "UEFA", Romania: "UEFA",
  // CONMEBOL
  Brazil: "CONMEBOL", Argentina: "CONMEBOL", Uruguay: "CONMEBOL",
  Colombia: "CONMEBOL", Paraguay: "CONMEBOL", Ecuador: "CONMEBOL",
  Peru: "CONMEBOL", Chile: "CONMEBOL", Bolivia: "CONMEBOL", Venezuela: "CONMEBOL",
  // CONCACAF
  USA: "CONCACAF", "United States": "CONCACAF",
  Mexico: "CONCACAF", Canada: "CONCACAF", "Costa Rica": "CONCACAF",
  Panama: "CONCACAF", Honduras: "CONCACAF", Jamaica: "CONCACAF",
  Haiti: "CONCACAF", "Curaçao": "CONCACAF", Curacao: "CONCACAF",
  // CAF
  Morocco: "CAF", Egypt: "CAF", Senegal: "CAF", Nigeria: "CAF",
  Cameroon: "CAF", Ghana: "CAF", Algeria: "CAF", Tunisia: "CAF",
  "Ivory Coast": "CAF", "Cote d'Ivoire": "CAF", "South Africa": "CAF",
  "Cape Verde": "CAF", "DR Congo": "CAF", "Democratic Republic of the Congo": "CAF",
  // AFC
  Japan: "AFC", "South Korea": "AFC", Korea: "AFC", Australia: "AFC",
  Iran: "AFC", "Saudi Arabia": "AFC", Qatar: "AFC", Iraq: "AFC",
  Jordan: "AFC", Uzbekistan: "AFC",
  // OFC
  "New Zealand": "OFC"
};

interface SportsDbEvent {
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
}

interface SportsDbTeam {
  idTeam: string;
  strTeam: string;
  strTeamAlternate?: string;
  strTeamShort?: string;
  strCountry?: string;
  strManager?: string;
  strStadium?: string;
  idVenue?: string;
  intStadiumCapacity?: string;
  intFormedYear?: string;
  strColour1?: string;
  strColour2?: string;
  strBadge?: string;
  strFanart1?: string;
  strDescriptionEN?: string;
  strWebsite?: string;
  strLocation?: string;
}

interface WcxTeam {
  team_id: string;
  name: string;
  short_name?: string;
  country: string;
  confederation?: string;
  manager?: string;
  home_venue?: string;
  home_place_id?: string;
  stadium_capacity?: number;
  formed_year?: number;
  primary_color?: string;
  secondary_color?: string;
  badge_url?: string;
  fanart_url?: string;
  description: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

async function fetchTeamIdsFromMatches(): Promise<Set<string>> {
  const ids = new Set<string>();
  const res = await fetch(`${SPORTS_BASE}/eventsseason.php?id=${WC_2026_LEAGUE_ID}&s=2026`);
  const data = (await res.json()) as { events?: SportsDbEvent[] };
  for (const e of data.events ?? []) {
    if (e.idHomeTeam) ids.add(e.idHomeTeam);
    if (e.idAwayTeam) ids.add(e.idAwayTeam);
  }
  return ids;
}

async function lookupTeam(idTeam: string): Promise<SportsDbTeam | null> {
  const res = await fetch(`${SPORTS_BASE}/lookupteam.php?id=${idTeam}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { teams?: SportsDbTeam[] };
  return data.teams?.[0] ?? null;
}

function toTeam(t: SportsDbTeam): WcxTeam {
  const now = new Date().toISOString();
  const country = t.strCountry ?? t.strTeam;
  return {
    team_id: t.idTeam,
    name: t.strTeam,
    short_name: t.strTeamShort || undefined,
    country,
    confederation: CONFEDERATION[country] ?? CONFEDERATION[t.strTeam] ?? undefined,
    manager: t.strManager || undefined,
    home_venue: t.strStadium || undefined,
    home_place_id: t.idVenue ? `wc2026-venue-${t.idVenue}` : undefined,
    stadium_capacity: t.intStadiumCapacity ? Number(t.intStadiumCapacity) : undefined,
    formed_year: t.intFormedYear ? Number(t.intFormedYear) : undefined,
    primary_color: t.strColour1 || undefined,
    secondary_color: t.strColour2 || undefined,
    badge_url: t.strBadge || undefined,
    fanart_url: t.strFanart1 || undefined,
    description: t.strDescriptionEN ?? `${t.strTeam} national football team — 2026 FIFA World Cup participant.`,
    website: t.strWebsite ? (t.strWebsite.startsWith("http") ? t.strWebsite : `https://${t.strWebsite}`) : undefined,
    created_at: now,
    updated_at: now
  };
}

async function indexDoc(id: string, doc: WcxTeam): Promise<boolean> {
  const res = await fetch(`${ELASTIC_URL}/wcx-teams/_doc/${encodeURIComponent(id)}`, {
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
  console.log(`\n🏳️  Ingesting WC2026 national teams → wcx-teams`);
  console.log(`   Elastic:     ${ELASTIC_URL}`);
  console.log(`   TheSportsDB: key=${SPORTS_KEY === "3" ? "<public test>" : "<paid>"}\n`);

  console.log("🔎 Scanning wcx-matches season feed for unique team IDs…");
  const teamIds = await fetchTeamIdsFromMatches();
  console.log(`   Found ${teamIds.size} unique teams\n`);

  let ok = 0;
  let failed = 0;
  const unknownConfed: string[] = [];

  for (const id of teamIds) {
    process.stdout.write(`🏳️  team_id=${id.padEnd(7)} ... `);
    const sdb = await lookupTeam(id);
    if (!sdb) {
      console.log("skipped (no data)");
      failed++;
      continue;
    }
    const doc = toTeam(sdb);
    if (!doc.confederation) unknownConfed.push(doc.name);
    const success = await indexDoc(doc.team_id, doc);
    if (success) {
      console.log(`✅ ${doc.name.padEnd(22)} (${doc.confederation ?? "?"})`);
      ok++;
    } else {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n🎉 Ingest complete — ok=${ok}, failed=${failed}`);
  if (unknownConfed.length > 0) {
    console.log(`⚠ Confederation unknown for: ${unknownConfed.join(", ")}\n   Add them to the CONFEDERATION map.`);
  }
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("💥 Unhandled error:", err);
  process.exit(1);
});
