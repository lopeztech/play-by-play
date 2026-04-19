import type { MatchData, Side, TimelineEvent } from "./types";

// Inferred game state at a specific gameSeconds: where the ball is and who
// has it. Built by walking the event timeline and applying possession +
// ball-position rules. Between snapshots we linearly interpolate, with a
// parabolic arc when the cause of the next snapshot is a kick.
export interface Snapshot {
  gameSeconds: number;
  ballX: number;
  ballZ: number;
  ballY: number;
  possession: Side | null;
  causeType?: string;
}

const FIELD_LIMIT = 55; // in-goal allowed
const CLAMP_IN_PLAY = 50; // try lines

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function flip(s: Side | null): Side | null {
  return s === "home" ? "away" : s === "away" ? "home" : null;
}

function attackDirOf(s: Side | null): number {
  return s === "home" ? 1 : s === "away" ? -1 : 0;
}

export class Simulator {
  readonly snapshots: Snapshot[];

  constructor(match: MatchData) {
    this.snapshots = Simulator.build(match);
  }

  private static build(match: MatchData): Snapshot[] {
    const homeId = match.homeTeam.teamId;
    let s: Snapshot = {
      gameSeconds: 0,
      ballX: 0,
      ballZ: 0,
      ballY: 0.5,
      possession: "home",
    };
    const out: Snapshot[] = [s];

    for (const ev of match.timeline) {
      s = applyEvent(s, ev, homeId);
      out.push(s);
    }
    return out;
  }

  sample(t: number): Snapshot {
    const snaps = this.snapshots;
    if (t <= snaps[0].gameSeconds) return snaps[0];
    if (t >= snaps[snaps.length - 1].gameSeconds) return snaps[snaps.length - 1];

    // Binary search for the first snapshot with gameSeconds > t
    let lo = 0;
    let hi = snaps.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (snaps[mid].gameSeconds <= t) lo = mid + 1;
      else hi = mid;
    }
    const b = snaps[lo];
    const a = snaps[lo - 1];

    const span = b.gameSeconds - a.gameSeconds;
    if (span <= 0) return b;
    const u = (t - a.gameSeconds) / span;

    let y = a.ballY + (b.ballY - a.ballY) * u;
    // Parabolic arc for kicks / attempts at goal
    if (
      b.causeType === "KickBomb" ||
      b.causeType === "LineDropout" ||
      b.causeType === "Goal" ||
      b.causeType === "GoalMissed" ||
      b.causeType === "PenaltyShot"
    ) {
      const peak = b.causeType === "KickBomb" ? 18 : 10;
      y = Math.sin(Math.PI * u) * peak + 0.5;
    }

    return {
      gameSeconds: t,
      ballX: a.ballX + (b.ballX - a.ballX) * u,
      ballZ: a.ballZ + (b.ballZ - a.ballZ) * u,
      ballY: y,
      possession: u < 0.5 ? a.possession : b.possession,
      causeType: b.causeType,
    };
  }
}

function applyEvent(prev: Snapshot, ev: TimelineEvent, homeTeamId: number): Snapshot {
  const side: Side | null =
    !ev.teamId || ev.teamId === 0 ? null : ev.teamId === homeTeamId ? "home" : "away";

  const next: Snapshot = {
    gameSeconds: ev.gameSeconds,
    ballX: prev.ballX,
    ballZ: prev.ballZ,
    ballY: 0.5,
    possession: prev.possession,
    causeType: ev.type,
  };

  switch (ev.type) {
    case "GameTime": {
      if (/KICK OFF|SECOND HALF|HALF TIME/i.test(ev.title)) {
        next.ballX = 0;
        next.ballZ = 0;
      }
      return next;
    }

    case "Try": {
      if (!side) return next;
      next.possession = side;
      next.ballX = attackDirOf(side) * (CLAMP_IN_PLAY + 3);
      // Slight sideline bias so tries aren't all at middle
      next.ballZ = ((ev.playerId ?? 0) % 5 - 2) * 8;
      return next;
    }

    case "Goal":
    case "GoalMissed":
    case "PenaltyShot": {
      if (!side) return next;
      next.possession = side;
      next.ballX = attackDirOf(side) * (CLAMP_IN_PLAY - 5);
      next.ballZ = 0;
      return next;
    }

    case "LineBreak": {
      if (!side) return next;
      next.possession = side;
      const dir = attackDirOf(side);
      next.ballX = clamp(prev.ballX + dir * 25, -CLAMP_IN_PLAY, CLAMP_IN_PLAY);
      return next;
    }

    case "Error": {
      // teamId is the offending team — possession flips to other
      if (!side) return next;
      next.possession = flip(side);
      return next;
    }

    case "Penalty":
    case "RuckInfringement":
    case "OffsideWithinTenMetres": {
      if (!side) return next;
      const receiver = flip(side);
      if (receiver) {
        next.possession = receiver;
        // Advance 10m toward receiver's attacking end
        const dir = attackDirOf(receiver);
        next.ballX = clamp(prev.ballX + dir * 10, -CLAMP_IN_PLAY, CLAMP_IN_PLAY);
      }
      return next;
    }

    case "SetRestart": {
      if (!side) return next;
      next.possession = side;
      return next;
    }

    case "KickBomb": {
      if (!side) return next;
      next.possession = side;
      const dir = attackDirOf(side);
      next.ballX = clamp(prev.ballX + dir * 35, -FIELD_LIMIT, FIELD_LIMIT);
      return next;
    }

    case "LineDropout": {
      // The kicking team (defenders of the previous play) restarts from their
      // own try line. teamId on this event is typically the kicking team.
      if (!side) return next;
      next.possession = side;
      const dir = attackDirOf(side);
      next.ballX = -dir * (CLAMP_IN_PLAY - 2); // at kicker's own try line
      next.ballZ = 0;
      return next;
    }

    case "Interchange":
    case "CaptainsChallenge":
    default:
      return next;
  }
}
