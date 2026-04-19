import type { MatchData, TimelineEvent } from "./types";
import type { PlayerToken } from "./players";
import type { EffectSystem } from "./effects";

// Drives the scene forward in simulated game-seconds. Each tick, any events
// whose gameSeconds have passed are fired into the effect system. Seeking
// backwards rewinds: it resets the state and silently replays events so the
// scoreboard and on-field rosters are consistent with the new clock position.
export class Replay {
  private currentSeconds = 0;
  private cursor = 0;
  private playing = false;
  private lastFrame = 0;
  private timeScale = 30;

  scoreHome = 0;
  scoreAway = 0;

  constructor(
    private match: MatchData,
    private tokens: Map<number, PlayerToken>,
    private effects: EffectSystem,
  ) {}

  get seconds() { return this.currentSeconds; }
  get isPlaying() { return this.playing; }
  get totalSeconds() {
    const last = this.match.timeline.at(-1);
    return last ? last.gameSeconds + 10 : 4800;
  }

  setTimeScale(n: number) { this.timeScale = n; }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.lastFrame = performance.now();
  }

  pause() { this.playing = false; }

  seek(seconds: number) {
    this.currentSeconds = Math.max(0, Math.min(seconds, this.totalSeconds));
    this.cursor = 0;
    this.scoreHome = 0;
    this.scoreAway = 0;
    this.effects.reset();
    for (const t of this.tokens.values()) {
      t.sprite.visible = !!t.player.isOnField;
      t.sprite.position.copy(t.homePosition);
      t.highlight.visible = false;
    }
    while (
      this.cursor < this.match.timeline.length &&
      this.match.timeline[this.cursor].gameSeconds <= this.currentSeconds
    ) {
      this.apply(this.match.timeline[this.cursor], true);
      this.cursor++;
    }
  }

  tick(now: number, dt: number) {
    if (this.playing) {
      const elapsed = (now - this.lastFrame) / 1000;
      this.lastFrame = now;
      this.currentSeconds = Math.min(
        this.currentSeconds + elapsed * this.timeScale,
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
    this.effects.update(dt);
  }

  private apply(e: TimelineEvent, silent: boolean) {
    if (typeof e.homeScore === "number") this.scoreHome = e.homeScore;
    if (typeof e.awayScore === "number") this.scoreAway = e.awayScore;

    if (e.type === "Interchange") {
      if (e.playerId) {
        const on = this.tokens.get(e.playerId);
        if (on) on.sprite.visible = true;
      }
      if (e.offPlayerId) {
        const off = this.tokens.get(e.offPlayerId);
        if (off) off.sprite.visible = false;
      }
    }

    if (!silent) {
      this.effects.fire(e, this.tokens);
    }
  }
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
