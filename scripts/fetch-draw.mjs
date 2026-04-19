// Fetches the full 2026 NRL draw (all rounds) and every team's badge SVG.
// Saves to public/draw.json and public/logos/*.svg so the selection page can
// render offline without hitting nrl.com at runtime.
//
// Usage:  node scripts/fetch-draw.mjs

import { writeFile, mkdir } from "node:fs/promises";

const season = process.env.SEASON ?? "2026";
const competition = process.env.COMPETITION ?? "111";
const maxRounds = Number(process.env.MAX_ROUNDS ?? 30);
const UA = { "user-agent": "Mozilla/5.0 play-by-play" };

const rounds = [];
for (let r = 1; r <= maxRounds; r++) {
  const url = `https://www.nrl.com/draw/data?competition=${competition}&season=${season}&round=${r}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) {
    console.warn(`round ${r}: ${res.status}`);
    continue;
  }
  const json = await res.json();
  const fixtures = (json.fixtures ?? []).filter((f) => f.type === "Match");
  if (!fixtures.length) continue;
  rounds.push({
    round: r,
    title: fixtures[0]?.roundTitle ?? `Round ${r}`,
    fixtures: fixtures.map((f) => ({
      matchCentreUrl: f.matchCentreUrl,
      matchMode: f.matchMode,
      matchState: f.matchState,
      venue: f.venue,
      venueCity: f.venueCity,
      clock: f.clock,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
    })),
  });
  console.log(`round ${r}: ${fixtures.length} fixtures`);
}

await mkdir("public", { recursive: true });
await writeFile(
  "public/draw.json",
  JSON.stringify({ season, competition, rounds }, null, 2),
);
console.log(`\nSaved public/draw.json (${rounds.length} rounds)`);

// Team logos — known NRL 2026 theme keys
const TEAM_KEYS = [
  "broncos", "bulldogs", "cowboys", "dolphins", "dragons", "eels",
  "knights", "panthers", "rabbitohs", "raiders", "roosters", "sea-eagles",
  "sharks", "storm", "titans", "warriors", "wests-tigers",
];

await mkdir("public/logos", { recursive: true });
let logoCount = 0;
for (const key of TEAM_KEYS) {
  const r = await fetch(`https://www.nrl.com/.theme/${key}/badge.svg`, { headers: UA });
  if (!r.ok) {
    console.warn(`logo ${key}: ${r.status}`);
    continue;
  }
  await writeFile(`public/logos/${key}.svg`, await r.text());
  logoCount++;
}
console.log(`Saved ${logoCount}/${TEAM_KEYS.length} team logos`);
