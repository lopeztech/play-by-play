import type { MatchData, TimelineEvent } from "./types";
import type { PlayerToken } from "./players";

// Replay drives the scene forward in simulated game-seconds. It fires any
// timeline event whose gameSeconds <= current clock since the last tick, and
// maintains a running scoreboard.
export class Replay {
  private currentSeconds = 0;
  private cursor = 0;
  private playing = false;
  private lastFrame = 0;

  scoreHome = 0;
  scoreAway = 0;

  constructor(
    private match: MatchData,
    private tokens: Map<number, PlayerToken>,
    private onEvent: (e: TimelineEvent, clock: string) => void,
  ) {}

  get seconds() { return this.currentSeconds; }
  get isPlaying() { return this.playing; }
  get totalSeconds() {
    const last = this.match.timeline.at(-1);
    return last ? last.gameSeconds + 10 : 4800;
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.lastFrame = performance.now();
  }

  pause() { this.playing = false; }

  seek(seconds: number) {
    this.currentSeconds = Math.max(0, Math.min(seconds, this.totalSeconds));
    // Rewind cursor and replay silently to recompute state
    this.cursor = 0;
    this.scoreHome = 0;
    this.scoreAway = 0;
    for (const t of this.tokens.values()) {
      t.mesh.visible = !!t.player.isOnField;
      t.mesh.position.copy(t.homePosition);
    }
    while (
      this.cursor < this.match.timeline.length &&
      this.match.timeline[this.cursor].gameSeconds <= this.currentSeconds
    ) {
      this.apply(this.match.timeline[this.cursor], true);
      this.cursor++;
    }
  }

  tick(now: number) {
    if (this.playing) {
      const dt = (now - this.lastFrame) / 1000;
      this.lastFrame = now;
      this.currentSeconds = Math.min(
        this.currentSeconds + dt * 30, // 30x realtime
        this.totalSeconds,
      );
    }
    while (
      this.cursor < this.match.timeline.length &&
      this.match.timeline[this.cursor].gameSeconds <= this.currentSeconds
    ) {
      this.apply(this.match.timeline[this.cursor], false);
      this.cursor++;
    }
  }

  private apply(e: TimelineEvent, silent: boolean) {
    if (typeof e.homeScore === "number") this.scoreHome = e.homeScore;
    if (typeof e.awayScore === "number") this.scoreAway = e.awayScore;

    if (e.type === "Interchange") {
      if (e.playerId) {
        const on = this.tokens.get(e.playerId);
        if (on) on.mesh.visible = true;
      }
      if (e.offPlayerId) {
        const off = this.tokens.get(e.offPlayerId);
        if (off) off.mesh.visible = false;
      }
    }

    if (!silent) {
      const mins = Math.floor(e.gameSeconds / 60).toString().padStart(2, "0");
      const secs = (e.gameSeconds % 60).toString().padStart(2, "0");
      this.onEvent(e, `${mins}:${secs}`);
    }
  }
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
