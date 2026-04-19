import * as THREE from "three";
import type { TimelineEvent } from "./types";
import type { PlayerToken } from "./players";
import { FIELD } from "./field";

// Overlay effects tied to timeline events. Player motion and ball flight are
// owned by the Simulator; this file handles the "tell" layer only — banners,
// a highlight ring under the involved player, and a try-line flash.
export class EffectSystem {
  private effects: Effect[] = [];

  constructor(private scene: THREE.Scene, private bannerLayer: HTMLDivElement) {}

  fire(event: TimelineEvent, tokens: Map<number, PlayerToken>) {
    const meta = EVENT_META[event.type] ?? DEFAULT_META;
    const token = event.playerId ? tokens.get(event.playerId) : undefined;

    this.showBanner(event, meta);
    if (token) this.pulseRing(token, meta.color);
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
    this.bannerLayer.innerHTML = "";
  }

  private showBanner(event: TimelineEvent, meta: EventMeta) {
    const banner = document.createElement("div");
    banner.className = "event-banner";
    banner.style.background = meta.color;
    const mins = Math.floor(event.gameSeconds / 60).toString().padStart(2, "0");
    const secs = (event.gameSeconds % 60).toString().padStart(2, "0");
    banner.innerHTML = `
      <span class="event-banner__clock">${mins}:${secs}</span>
      <span class="event-banner__icon">${meta.icon}</span>
      <span class="event-banner__title">${meta.label}</span>
      <span class="event-banner__desc">${event.title}</span>
    `;
    this.bannerLayer.prepend(banner);
    while (this.bannerLayer.children.length > 6) {
      this.bannerLayer.lastElementChild?.remove();
    }
    setTimeout(() => banner.classList.add("fade"), 50);
    setTimeout(() => banner.remove(), 5000);
  }

  private pulseRing(token: PlayerToken, hex: string) {
    const mat = token.highlight.material as THREE.MeshBasicMaterial;
    mat.color.set(hex);
    mat.opacity = 0.8;
    token.highlight.visible = true;
    const life = 2.5;
    this.effects.push({
      age: 0,
      life,
      tick: (age) => {
        mat.opacity = 0.8 * (1 - age / life);
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

const DEFAULT_META: EventMeta = { label: "Event", color: "#4b5bc4", icon: "•" };

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
