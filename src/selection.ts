interface FixtureTeam {
  teamId: number;
  nickName: string;
  score: number;
  theme?: { key?: string };
}

interface Fixture {
  matchCentreUrl: string;
  matchMode: "Pre" | "Live" | "Post";
  matchState: string;
  venue: string;
  venueCity: string;
  clock?: { kickOffTimeLong?: string };
  homeTeam: FixtureTeam;
  awayTeam: FixtureTeam;
}

interface Round {
  round: number;
  title: string;
  fixtures: Fixture[];
}

interface Draw {
  season: string;
  rounds: Round[];
}

let drawCache: Draw | null = null;

export async function renderSelection(container: HTMLElement): Promise<void> {
  container.innerHTML = `<div class="sel-loading">Loading draw…</div>`;
  if (!drawCache) {
    const res = await fetch("/draw.json");
    if (!res.ok) {
      container.innerHTML = `<div class="sel-error">Could not load draw.json — run <code>npm run fetch:draw</code>.</div>`;
      return;
    }
    drawCache = await res.json();
  }
  const draw = drawCache!;

  const initial = findInitialRound(draw);

  container.innerHTML = `
    <header class="sel-header">
      <div class="sel-title">NRL Play-by-Play</div>
      <div class="sel-sub">${draw.season} Telstra Premiership</div>
    </header>
    <div class="sel-rounds" id="sel-rounds"></div>
    <div class="sel-grid" id="sel-grid"></div>
    <div class="sel-foot">Data from nrl.com · replays reconstructed from the play-by-play timeline</div>
  `;

  const roundsEl = container.querySelector<HTMLDivElement>("#sel-rounds")!;
  const gridEl = container.querySelector<HTMLDivElement>("#sel-grid")!;

  for (const r of draw.rounds) {
    const btn = document.createElement("button");
    btn.className = "sel-round-btn";
    btn.textContent = `R${r.round}`;
    btn.addEventListener("click", () => {
      roundsEl.querySelectorAll(".sel-round-btn.active").forEach((el) =>
        el.classList.remove("active"),
      );
      btn.classList.add("active");
      renderFixtures(gridEl, r);
    });
    if (r.round === initial) btn.classList.add("active");
    roundsEl.appendChild(btn);
  }

  const current = draw.rounds.find((r) => r.round === initial) ?? draw.rounds[0];
  if (current) renderFixtures(gridEl, current);
}

function findInitialRound(draw: Draw): number {
  for (let i = draw.rounds.length - 1; i >= 0; i--) {
    const r = draw.rounds[i];
    if (r.fixtures.some((f) => f.matchMode === "Post")) return r.round;
  }
  return draw.rounds[0]?.round ?? 1;
}

function renderFixtures(gridEl: HTMLElement, round: Round) {
  gridEl.innerHTML = "";
  for (const f of round.fixtures) {
    gridEl.appendChild(renderFixtureCard(f, round.round));
  }
}

function renderFixtureCard(f: Fixture, roundNumber: number): HTMLElement {
  const card = document.createElement("div");
  card.className = `sel-card sel-card--${f.matchMode.toLowerCase()}`;

  const homeKey = f.homeTeam.theme?.key ?? "home";
  const awayKey = f.awayTeam.theme?.key ?? "away";
  const slug = f.matchCentreUrl.split("/").filter(Boolean).slice(-1)[0] ?? "";

  const showScores = f.matchMode !== "Pre";
  const canWatch = f.matchMode === "Post";

  const kickoff = f.clock?.kickOffTimeLong
    ? new Date(f.clock.kickOffTimeLong).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  card.innerHTML = `
    <div class="sel-card__meta">
      <span>${kickoff}</span>
      <span class="sel-card__venue">${escapeHtml(f.venue)}</span>
    </div>
    <div class="sel-card__match">
      <div class="sel-card__team sel-card__team--home">
        <span class="sel-card__team-name">${escapeHtml(f.homeTeam.nickName)}</span>
        <img class="sel-card__logo" src="/logos/${homeKey}.svg" alt="${escapeHtml(f.homeTeam.nickName)}" />
      </div>
      <div class="sel-card__score">
        ${
          showScores
            ? `<span>${f.homeTeam.score}</span><span class="sel-card__dash">−</span><span>${f.awayTeam.score}</span>`
            : `<span class="sel-card__vs">v</span>`
        }
      </div>
      <div class="sel-card__team sel-card__team--away">
        <img class="sel-card__logo" src="/logos/${awayKey}.svg" alt="${escapeHtml(f.awayTeam.nickName)}" />
        <span class="sel-card__team-name">${escapeHtml(f.awayTeam.nickName)}</span>
      </div>
    </div>
    <div class="sel-card__status sel-card__status--${f.matchMode.toLowerCase()}">${statusLabel(f)}</div>
    <button class="sel-card__btn" ${canWatch ? "" : "disabled"}>
      ${canWatch ? "Watch replay →" : f.matchMode === "Live" ? "Live — replay unavailable" : "Upcoming"}
    </button>
  `;

  if (canWatch) {
    const go = () => {
      location.hash = `#/match/round-${roundNumber}/${slug}`;
    };
    card.addEventListener("click", go);
    card.style.cursor = "pointer";
  }

  return card;
}

function statusLabel(f: Fixture): string {
  if (f.matchMode === "Post") return f.matchState.toUpperCase();
  if (f.matchMode === "Live") return "LIVE";
  return "UPCOMING";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
