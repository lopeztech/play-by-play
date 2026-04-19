import * as THREE from "three";
import type { MatchData, TimelineEvent } from "./types";
import { animateToken, type PlayerToken } from "./players";
import type { EffectSystem } from "./effects";
import { Simulator } from "./simulation";
import { playerTarget } from "./formations";

// Drives the clock, fires timeline events into EffectSystem, and every frame
// samples the Simulator to place the ball and compute each on-field player's
// target position. Player motion is smoothed by an exponential follow.
export class Replay {
  private currentSeconds = 0;
  private cursor = 0;
  private playing = false;
  private lastFrame = 0;
  private timeScale = 30;
  private sim: Simulator;

  scoreHome = 0;
  scoreAway = 0;

  constructor(
    private match: MatchData,
    private tokens: Map<number, PlayerToken>,
    private ball: THREE.Mesh,
    private effects: EffectSystem,
  ) {
    this.sim = new Simulator(match);
  }

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

    // Rebuild interchange state and roster visibility
    for (const t of this.tokens.values()) {
      t.root.visible = !!t.player.isOnField;
      t.highlight.visible = false;
    }
    while (
      this.cursor < this.match.timeline.length &&
      this.match.timeline[this.cursor].gameSeconds <= this.currentSeconds
    ) {
      this.apply(this.match.timeline[this.cursor], true);
      this.cursor++;
    }

    // Snap player positions & ball to the simulated state immediately.
    const snap = this.sim.sample(this.currentSeconds);
    this.ball.position.set(snap.ballX, snap.ballY + 0.3, snap.ballZ);
    for (const t of this.tokens.values()) {
      if (!t.root.visible) continue;
      const target = playerTarget(t.player.number, t.side, snap);
      t.root.position.set(target.x, 0, target.z);
      t.lastX = target.x;
      t.lastZ = target.z;
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

    const snap = this.sim.sample(this.currentSeconds);
    this.ball.position.set(snap.ballX, snap.ballY + 0.3, snap.ballZ);

    // Smooth follow — exponential toward target. Feels natural at any time scale.
    const follow = 1 - Math.exp(-dt * 3.5);
    for (const t of this.tokens.values()) {
      if (!t.root.visible) continue;
      const target = playerTarget(t.player.number, t.side, snap);
      const pos = t.root.position;
      pos.x += (target.x - pos.x) * follow;
      pos.z += (target.z - pos.z) * follow;
      animateToken(t, dt, snap.ballX, snap.ballZ);
    }

    this.effects.update(dt);
  }

  private apply(e: TimelineEvent, silent: boolean) {
    if (typeof e.homeScore === "number") this.scoreHome = e.homeScore;
    if (typeof e.awayScore === "number") this.scoreAway = e.awayScore;

    if (e.type === "Interchange") {
      if (e.playerId) {
        const on = this.tokens.get(e.playerId);
        if (on) on.root.visible = true;
      }
      if (e.offPlayerId) {
        const off = this.tokens.get(e.offPlayerId);
        if (off) off.root.visible = false;
      }
    }

    if (!silent) this.effects.fire(e, this.tokens);
  }
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
