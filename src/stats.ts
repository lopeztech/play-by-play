import type { Side, TimelineEvent } from "./types";

export interface TeamStats {
  tries: number;
  goals: number;          // conversions made
  goalsMissed: number;
  penalties: number;      // conceded
  errors: number;         // committed
  lineBreaks: number;
  kicks: number;          // kick bombs + line dropouts
  setRestarts: number;
  interchanges: number;
  possessionSeconds: number;
}

export interface LiveStats {
  home: TeamStats;
  away: TeamStats;
}

function emptyTeam(): TeamStats {
  return {
    tries: 0, goals: 0, goalsMissed: 0, penalties: 0, errors: 0,
    lineBreaks: 0, kicks: 0, setRestarts: 0, interchanges: 0,
    possessionSeconds: 0,
  };
}

// Accumulates per-team counts as events fire. Resets cleanly on seek so the
// same tracker can be replayed from t=0 for scrubbing.
export class StatsTracker {
  home = emptyTeam();
  away = emptyTeam();

  constructor(private homeTeamId: number) {}

  reset() {
    this.home = emptyTeam();
    this.away = emptyTeam();
  }

  tickPossession(gameDt: number, possession: Side | null) {
    if (gameDt <= 0) return;
    if (possession === "home") this.home.possessionSeconds += gameDt;
    else if (possession === "away") this.away.possessionSeconds += gameDt;
  }

  applyEvent(e: TimelineEvent) {
    const side: Side | null =
      !e.teamId || e.teamId === 0
        ? null
        : e.teamId === this.homeTeamId
        ? "home"
        : "away";
    if (!side) return;
    const s = side === "home" ? this.home : this.away;
    const other = side === "home" ? this.away : this.home;

    switch (e.type) {
      case "Try": s.tries++; break;
      case "Goal": s.goals++; break;
      case "GoalMissed": s.goalsMissed++; break;
      case "PenaltyShot": s.goals++; break;
      case "LineBreak": s.lineBreaks++; break;
      case "KickBomb":
      case "LineDropout":
        s.kicks++; break;
      case "SetRestart": s.setRestarts++; break;
      case "Interchange": s.interchanges++; break;
      // Offender = side → count against them, credit the other team below
      case "Error": s.errors++; break;
      case "Penalty":
      case "RuckInfringement":
      case "OffsideWithinTenMetres":
        s.penalties++; break;
    }

    // Silence unused-var warning (for future enrichment)
    void other;
  }

  possessionPct(): { home: number; away: number } {
    const total = this.home.possessionSeconds + this.away.possessionSeconds;
    if (total <= 0) return { home: 50, away: 50 };
    return {
      home: Math.round((this.home.possessionSeconds / total) * 100),
      away: Math.round((this.away.possessionSeconds / total) * 100),
    };
  }
}
