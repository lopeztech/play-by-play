// Usage: node scripts/fetch-match.mjs [roundNumber] [slug]
// Examples:
//   node scripts/fetch-match.mjs 7 cowboys-v-sea-eagles
//   node scripts/fetch-match.mjs           # defaults

import { writeFile, mkdir } from "node:fs/promises";

const round = process.argv[2] ?? "7";
const slug = process.argv[3] ?? "cowboys-v-sea-eagles";
const season = process.env.SEASON ?? "2026";
const url = `https://www.nrl.com/draw/nrl-premiership/${season}/round-${round}/${slug}/data`;

const res = await fetch(url, {
  headers: { "user-agent": "Mozilla/5.0 play-by-play dev" },
});
if (!res.ok) {
  console.error(`Failed ${res.status} for ${url}`);
  process.exit(1);
}
const json = await res.json();
await writeFile("public/match.json", JSON.stringify(json, null, 2));
console.log(
  `Saved public/match.json — ${json.homeTeam.nickName} ${json.homeTeam.score} vs ${json.awayTeam.score} ${json.awayTeam.nickName}`,
);

await mkdir("public/logos", { recursive: true });
for (const team of [json.homeTeam, json.awayTeam]) {
  const key = team?.theme?.key;
  if (!key) continue;
  const logoUrl = `https://www.nrl.com/.theme/${key}/badge.svg`;
  const r = await fetch(logoUrl, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) {
    console.warn(`Skipped logo for ${key}: ${r.status}`);
    continue;
  }
  const svg = await r.text();
  await writeFile(`public/logos/${key}.svg`, svg);
  console.log(`Saved public/logos/${key}.svg`);
}
