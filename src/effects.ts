import * as THREE from "three";
import type { TimelineEvent } from "./types";
import type { PlayerToken } from "./players";
import { FIELD } from "./field";

// Overlay effects tied to timeline events. Player motion + ball are simulator
// owned; this handles the "tell" layer: a single centred banner beneath the
// field, a highlight ring pulse on the involved player, and a try-line flash.
export class EffectSystem {
  private effects: Effect[] = [];
  private bannerTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(private scene: THREE.Scene, private banner: HTMLDivElement) {}

  fire(event: TimelineEvent, tokens: Map<number, PlayerToken>) {
    const meta = EVENT_META[event.type] ?? DEFAULT_META;
    const token = event.playerId ? tokens.get(event.playerId) : undefined;

    this.showBanner(event, meta, token, tokens);
    if (token && token.onField) this.pulseRing(token, meta.color);
    if (event.type === "Try" && token) this.tryLineFlash(token, meta.color);
  }

  update(dt: number) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const eff = this.effects[i];
      eff.age += dt;
      if (eff.age >= eff.life) {
        eff.dispose();
        this.effects.splice(i, 1);
      } else {
        eff.tick(eff.age);
      }
    }
  }

  reset() {
    for (const e of this.effects) e.dispose();
    this.effects = [];
    this.banner.classList.remove("show");
    this.banner.innerHTML = "";
    clearTimeout(this.bannerTimeout);
  }

  private showBanner(
    event: TimelineEvent,
    meta: EventMeta,
    token: PlayerToken | undefined,
    _tokens: Map<number, PlayerToken>,
  ) {
    const mins = Math.floor(event.gameSeconds / 60).toString().padStart(2, "0");
    const secs = (event.gameSeconds % 60).toString().padStart(2, "0");

    const playerName = token
      ? `${token.player.firstName} ${token.player.lastName}`
      : "";
    const team = token?.player ? "" : ""; // team shown via colour

    this.banner.style.background = meta.color;
    this.banner.innerHTML = `
      <span class="event-banner__clock">${mins}:${secs}</span>
      <span class="event-banner__icon">${meta.icon}</span>
      <div class="event-banner__body">
        <div class="event-banner__title">${meta.label}</div>
        <div class="event-banner__desc">${playerName ? `${playerName} · ` : ""}${event.title}${team}</div>
      </div>
    `;

    this.banner.classList.remove("show");
    void this.banner.offsetWidth; // re-trigger CSS entry animation
    this.banner.classList.add("show");

    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      this.banner.classList.remove("show");
    }, 4500);
  }

  private pulseRing(token: PlayerToken, hex: string) {
    const mat = token.highlight.material as THREE.MeshBasicMaterial;
    mat.color.set(hex);
    mat.opacity = 0.85;
    token.highlight.visible = true;
    const life = 2.8;
    this.effects.push({
      age: 0,
      life,
      tick: (age) => {
        mat.opacity = 0.85 * (1 - age / life);
      },
      dispose: () => {
        mat.opacity = 0;
        token.highlight.visible = false;
      },
    });
  }

  private tryLineFlash(token: PlayerToken, hex: string) {
    const tryLineX = token.side === "home" ? FIELD.playLength / 2 : -FIELD.playLength / 2;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD.inGoal, FIELD.width),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    const inGoalCentre = tryLineX + (token.side === "home" ? FIELD.inGoal / 2 : -FIELD.inGoal / 2);
    plane.position.set(inGoalCentre, 0.03, 0);
    this.scene.add(plane);

    const life = 2.0;
    this.effects.push({
      age: 0,
      life,
      tick: (age) => {
        const t = age / life;
        (plane.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
      },
      dispose: () => {
        this.scene.remove(plane);
        plane.geometry.dispose();
        (plane.material as THREE.Material).dispose();
      },
    });
  }
}

interface Effect {
  age: number;
  life: number;
  tick: (age: number) => void;
  dispose: () => void;
}

export interface EventMeta {
  label: string;
  color: string;
  icon: string;
}

const DEFAULT_META: EventMeta = { label: "EVENT", color: "#4b5bc4", icon: "•" };

export const EVENT_META: Record<string, EventMeta> = {
  Try:                     { label: "TRY",              color: "#1b9e4b", icon: "★" },
  Goal:                    { label: "CONVERSION",       color: "#1b9e4b", icon: "⤴" },
  GoalMissed:              { label: "MISSED",           color: "#8a8f9e", icon: "⤴" },
  PenaltyShot:             { label: "PENALTY GOAL",     color: "#1b9e4b", icon: "⤴" },
  Penalty:                 { label: "PENALTY",          color: "#d94e2f", icon: "✋" },
  Error:                   { label: "ERROR",            color: "#b8323a", icon: "✖" },
  Interchange:             { label: "INTERCHANGE",      color: "#2e7dd1", icon: "↔" },
  LineBreak:               { label: "LINE BREAK",       color: "#f2a93b", icon: "»" },
  RuckInfringement:        { label: "RUCK INFRINGEMENT",color: "#d94e2f", icon: "✋" },
  SetRestart:              { label: "SET RESTART (6)",  color: "#f2a93b", icon: "↻" },
  KickBomb:                { label: "KICK",             color: "#8b6fd4", icon: "⤴" },
  LineDropout:             { label: "LINE DROPOUT",     color: "#8b6fd4", icon: "⤴" },
  OffsideWithinTenMetres:  { label: "10M OFFSIDE",      color: "#d94e2f", icon: "✋" },
  CaptainsChallenge:       { label: "CAPTAIN'S CHALLENGE", color: "#6a9bd8", icon: "⏯" },
  GameTime:                { label: "GAME TIME",        color: "#3949ab", icon: "⏱" },
};
