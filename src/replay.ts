import * as THREE from "three";
import type { MatchData, TimelineEvent } from "./types";
import { animateToken, type PlayerToken } from "./players";
import type { EffectSystem } from "./effects";
import { Simulator, type Snapshot } from "./simulation";
import { playerTarget } from "./formations";
import { benchPosition } from "./bench";
import { StatsTracker } from "./stats";

const KEY_EVENTS = new Set(["Try", "Goal", "PenaltyShot", "LineBreak", "KickBomb", "LineDropout"]);
const SLOW_MO_MS = 2500;
const SLOW_MO_SCALE = 3;

// When one of these fires, the referenced player is "with the ball" — their
// target overrides the formation slot to sit on the ball's position for a
// few game-seconds, so tries, breaks, errors, and kicks visually converge
// on the correct player.
const HOLD_EVENTS = new Set([
  "Try", "Goal", "GoalMissed", "PenaltyShot",
  "LineBreak", "Error", "KickBomb", "LineDropout",
]);
const HOLD_SECONDS = 3;

export class Replay {
  private currentSeconds = 0;
  private cursor = 0;
  private playing = false;
  private lastFrame = 0;
  private timeScale = 30;
  private sim: Simulator;
  private slowMoUntil = 0;
  private lastSnap: Snapshot | null = null;
  private lastSnapGameSeconds = 0;
  private activePlayerId: number | null = null;
  private activePos: { x: number; z: number } | null = null;
  private activeUntilGameSeconds = 0;

  scoreHome = 0;
  scoreAway = 0;
  stats: StatsTracker;

  constructor(
    private match: MatchData,
    private tokens: Map<number, PlayerToken>,
    private ball: THREE.Mesh,
    private effects: EffectSystem,
  ) {
    this.sim = new Simulator(match);
    this.stats = new StatsTracker(match.homeTeam.teamId);
  }

  get seconds() { return this.currentSeconds; }
  get isPlaying() { return this.playing; }
  get currentSnap() { return this.lastSnap; }
  get slowMo() { return performance.now() < this.slowMoUntil; }
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
    this.slowMoUntil = 0;
    this.activePlayerId = null;
    this.activePos = null;
    this.activeUntilGameSeconds = 0;
    this.stats.reset();
    this.effects.reset();

    for (const t of this.tokens.values()) {
      t.onField = t.player.number <= 13;
      t.highlight.visible = false;
    }

    this.accumulatePossession(this.currentSeconds);

    while (
      this.cursor < this.match.timeline.length &&
      this.match.timeline[this.cursor].gameSeconds <= this.currentSeconds
    ) {
      this.apply(this.match.timeline[this.cursor], true);
      this.cursor++;
    }
    this.expireActiveIfNeeded();

    const snap = this.sim.sample(this.currentSeconds);
    this.lastSnap = snap;
    this.lastSnapGameSeconds = this.currentSeconds;
    this.ball.position.set(snap.ballX, snap.ballY + 0.3, snap.ballZ);
    for (const t of this.tokens.values()) {
      const target = this.targetFor(t, snap);
      t.root.position.set(target.x, 0, target.z);
      t.lastX = target.x;
      t.lastZ = target.z;
    }
  }

  private targetFor(t: PlayerToken, snap: Snapshot): { x: number; z: number } {
    if (!t.onField) return benchPosition(t.side, t.player.number);
    if (t.playerId === this.activePlayerId && this.activePos) return this.activePos;
    return playerTarget(t.player.number, t.side, snap);
  }

  private expireActiveIfNeeded() {
    if (this.currentSeconds >= this.activeUntilGameSeconds) {
      this.activePlayerId = null;
      this.activePos = null;
    }
  }

  // Walk simulator snapshots and add up possession time in each bracket so
  // possession % is correct after a scrub rather than drifting from zero.
  private accumulatePossession(untilSeconds: number) {
    const snaps = this.sim.snapshots;
    for (let i = 0; i < snaps.length - 1; i++) {
      const a = snaps[i];
      const b = snaps[i + 1];
      const end = Math.min(b.gameSeconds, untilSeconds);
      const span = end - a.gameSeconds;
      if (span <= 0) break;
      this.stats.tickPossession(span, a.possession);
      if (b.gameSeconds > untilSeconds) break;
    }
  }

  tick(now: number, dt: number) {
    if (this.playing) {
      const elapsed = (now - this.lastFrame) / 1000;
      this.lastFrame = now;
      const scale = now < this.slowMoUntil ? Math.min(this.timeScale, SLOW_MO_SCALE) : this.timeScale;
      this.currentSeconds = Math.min(
        this.currentSeconds + elapsed * scale,
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

    this.expireActiveIfNeeded();

    const snap = this.sim.sample(this.currentSeconds);
    if (this.lastSnap) {
      const gameDt = this.currentSeconds - this.lastSnapGameSeconds;
      if (gameDt > 0) this.stats.tickPossession(gameDt, this.lastSnap.possession);
    }
    this.lastSnap = snap;
    this.lastSnapGameSeconds = this.currentSeconds;
    this.ball.position.set(snap.ballX, snap.ballY + 0.3, snap.ballZ);

    const follow = 1 - Math.exp(-dt * 3.5);
    for (const t of this.tokens.values()) {
      const target = this.targetFor(t, snap);
      const pos = t.root.position;
      pos.x += (target.x - pos.x) * follow;
      pos.z += (target.z - pos.z) * follow;
      const faceX = t.onField ? snap.ballX : pos.x;
      const faceZ = t.onField ? snap.ballZ : 0;
      animateToken(t, dt, faceX, faceZ);
    }

    this.effects.update(dt);
  }

  private apply(e: TimelineEvent, silent: boolean) {
    if (typeof e.homeScore === "number") this.scoreHome = e.homeScore;
    if (typeof e.awayScore === "number") this.scoreAway = e.awayScore;

    this.stats.applyEvent(e);

    if (e.type === "Interchange") {
      if (e.playerId) {
        const on = this.tokens.get(e.playerId);
        if (on) on.onField = true;
      }
      if (e.offPlayerId) {
        const off = this.tokens.get(e.offPlayerId);
        if (off) off.onField = false;
      }
    }

    if (e.playerId && HOLD_EVENTS.has(e.type)) {
      const atEvent = this.sim.sample(e.gameSeconds);
      this.activePlayerId = e.playerId;
      this.activePos = { x: atEvent.ballX, z: atEvent.ballZ };
      this.activeUntilGameSeconds = e.gameSeconds + HOLD_SECONDS;
    }

    if (!silent) {
      this.effects.fire(e, this.tokens);
      if (KEY_EVENTS.has(e.type)) {
        this.slowMoUntil = performance.now() + SLOW_MO_MS;
      }
    }
  }
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
