#!/usr/bin/env node
/**
 * Ingest people (players + coaches) into `wcx-people` for all national teams
 * already indexed in `wcx-teams`. One `role` keyword distinguishes
 * `player`, `head_coach`, and `assistant_coach`.
 *
 * Note on timing:
 *   FIFA's official 23-man rosters are released 2026-05-30. Running before
 *   that date will pull whatever TheSportsDB has (mostly head coaches + an
 *   incomplete mix for big federations). Rerun after 05-30 for the full
 *   squads — the script is idempotent (PUT by person_id).
 *
 * Run:
 *   pnpm run elastic:ingest:people
 */

const ELASTIC_URL = process.env.ELASTIC_CLOUD_URL;
const ELASTIC_KEY = process.env.ELASTIC_API_KEY;
const SPORTS_KEY = process.env.THESPORTSDB_API_KEY || "3";

if (!ELASTIC_URL || !ELASTIC_KEY) {
  console.error("❌ Missing ELASTIC_CLOUD_URL or ELASTIC_API_KEY.");
  process.exit(1);
}

const SPORTS_BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTS_KEY}`;

interface SportsDbPlayer {
  idPlayer: string;
  idTeam?: string;
  idWikidata?: string;
  strPlayer: string;
  strPlayerAlternate?: string;
  strTeam?: string;
  strNationality?: string;
  strPosition?: string;
  strNumber?: string;
  strSide?: string;
  dateBorn?: string;
  strBirthLocation?: string;
  strHeight?: string;
  strWeight?: string;
  strDescriptionEN?: string;
  strThumb?: string;
  strCutout?: string;
  strStatus?: string;
  strSigning?: string;
}

interface WcxPerson {
  person_id: string;
  name: string;
  alt_name?: string;
  role: string;
  team_id?: string;
  team_name?: string;
  position?: string;
  shirt_no?: number;
  side?: string;
  nationality?: string;
  birth_date?: string;
  birth_location?: string;
  height_cm?: number;
  weight_kg?: number;
  current_club?: string;
  bio?: string;
  photo_url?: string;
  cutout_url?: string;
  status?: string;
  wikidata_id?: string;
  created_at: string;
  updated_at: string;
}

function deriveRole(p: SportsDbPlayer): string {
  const pos = (p.strPosition ?? "").toLowerCase();
  const status = (p.strStatus ?? "").toLowerCase();
  if (pos === "manager" || status === "coaching") return "head_coach";
  if (pos.includes("coach")) return "assistant_coach";
  return "player";
}

function parseHeightCm(s?: string): number | undefined {
  if (!s) return undefined;
  // Formats seen: "1.73 m (5 ft 8 in)" / "183 cm" / "6 ft 1 in"
  const m = s.match(/(\d+(?:\.\d+)?)\s*m\b/i);
  if (m) return Math.round(parseFloat(m[1]) * 100);
  const cm = s.match(/(\d+)\s*cm/i);
  if (cm) return Number(cm[1]);
  const ftIn = s.match(/(\d+)\s*ft\s*(\d+)?/i);
  if (ftIn) {
    const ft = Number(ftIn[1]);
    const inch = ftIn[2] ? Number(ftIn[2]) : 0;
    return Math.round((ft * 12 + inch) * 2.54);
  }
  return undefined;
}

function parseWeightKg(s?: string): number | undefined {
  if (!s) return undefined;
  const kg = s.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kg) return Math.round(parseFloat(kg[1]));
  const lb = s.match(/(\d+(?:\.\d+)?)\s*lb/i);
  if (lb) return Math.round(parseFloat(lb[1]) * 0.453592);
  return undefined;
}

function parseBirthDate(s?: string): string | undefined {
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return undefined;
}

async function getTeamIds(): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${ELASTIC_URL}/wcx-teams/_search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `ApiKey ${ELASTIC_KEY}` },
    body: JSON.stringify({
      size: 100,
      _source: ["team_id", "name"],
      query: { match_all: {} }
    })
  });
  const data = (await res.json()) as { hits: { hits: Array<{ _source: { team_id: string; name: string } }> } };
  return data.hits.hits.map((h) => ({ id: h._source.team_id, name: h._source.name }));
}

async function fetchTeamRoster(idTeam: string): Promise<SportsDbPlayer[]> {
  const res = await fetch(`${SPORTS_BASE}/lookup_all_players.php?id=${idTeam}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { player?: SportsDbPlayer[] | null };
  return data.player ?? [];
}

function toPerson(p: SportsDbPlayer, teamName: string): WcxPerson {
  const now = new Date().toISOString();
  return {
    person_id: p.idPlayer,
    name: p.strPlayer,
    alt_name: p.strPlayerAlternate || undefined,
    role: deriveRole(p),
    team_id: p.idTeam,
    team_name: p.strTeam ?? teamName,
    position: p.strPosition || undefined,
    shirt_no: p.strNumber ? Number(p.strNumber) : undefined,
    side: p.strSide || undefined,
    nationality: p.strNationality || undefined,
    birth_date: parseBirthDate(p.dateBorn),
    birth_location: p.strBirthLocation || undefined,
    height_cm: parseHeightCm(p.strHeight),
    weight_kg: parseWeightKg(p.strWeight),
    current_club: p.strSigning || undefined,
    bio: p.strDescriptionEN || undefined,
    photo_url: p.strThumb || undefined,
    cutout_url: p.strCutout || undefined,
    status: p.strStatus || undefined,
    wikidata_id: p.idWikidata || undefined,
    created_at: now,
    updated_at: now
  };
}

async function indexDoc(id: string, doc: WcxPerson): Promise<boolean> {
  const res = await fetch(`${ELASTIC_URL}/wcx-people/_doc/${encodeURIComponent(id)}`, {
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
  console.log(`\n👥 Ingesting WC2026 people (players + coaches) → wcx-people`);
  console.log(`   Elastic:     ${ELASTIC_URL}`);
  console.log(`   TheSportsDB: key=${SPORTS_KEY === "3" ? "<public test>" : "<paid>"}`);
  console.log(`   ⚠ Official 23-man squads release 2026-05-30. Rerun after that date for full rosters.\n`);

  const teams = await getTeamIds();
  console.log(`🔎 Found ${teams.length} teams in wcx-teams to pull rosters for\n`);

  let totalOk = 0;
  let totalFailed = 0;
  let roleCounts = { player: 0, head_coach: 0, assistant_coach: 0 };

  for (const team of teams) {
    const roster = await fetchTeamRoster(team.id);
    if (roster.length === 0) {
      console.log(`👥 ${team.name.padEnd(22)} (id=${team.id}) ... empty roster`);
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    let teamOk = 0;
    for (const p of roster) {
      const doc = toPerson(p, team.name);
      const success = await indexDoc(doc.person_id, doc);
      if (success) {
        teamOk++;
        totalOk++;
        roleCounts[doc.role as keyof typeof roleCounts] = (roleCounts[doc.role as keyof typeof roleCounts] ?? 0) + 1;
      } else {
        totalFailed++;
      }
    }
    console.log(`👥 ${team.name.padEnd(22)} (id=${team.id}) ... ${teamOk}/${roster.length} ✅`);
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n🎉 Ingest complete — ok=${totalOk}, failed=${totalFailed}`);
  console.log(`   By role: player=${roleCounts.player}, head_coach=${roleCounts.head_coach}, assistant_coach=${roleCounts.assistant_coach}\n`);
  if (totalFailed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("💥 Unhandled error:", err);
  process.exit(1);
});
