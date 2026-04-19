import * as THREE from "three";
import type { TimelineEvent } from "./types";
import type { PlayerToken } from "./players";
import { FIELD } from "./field";

// Visual overlay system. For each fired timeline event we spawn a short-lived
// effect (banner, highlight ring, try-line flash, ball arc) and tick it via
// update(). Anything past its lifespan is removed.
export class EffectSystem {
  private effects: Effect[] = [];
  private bannerLayer: HTMLDivElement;

  constructor(private scene: THREE.Scene, bannerLayer: HTMLDivElement) {
    this.bannerLayer = bannerLayer;
  }

  fire(event: TimelineEvent, tokens: Map<number, PlayerToken>) {
    const meta = EVENT_META[event.type] ?? DEFAULT_META;
    const token = event.playerId ? tokens.get(event.playerId) : undefined;

    this.showBanner(event, meta);

    if (token) {
      this.highlightToken(token, meta.color);
    }

    switch (event.type) {
      case "Try":
        if (token) this.tryFlash(token, meta.color);
        break;
      case "Goal":
      case "PenaltyShot":
        if (token) this.goalArc(token, true);
        break;
      case "GoalMissed":
        if (token) this.goalArc(token, false);
        break;
      case "KickBomb":
      case "LineDropout":
        if (token) this.kickArc(token);
        break;
    }
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
    // Keep last 6
    while (this.bannerLayer.children.length > 6) {
      this.bannerLayer.lastElementChild?.remove();
    }
    setTimeout(() => banner.classList.add("fade"), 50);
    setTimeout(() => banner.remove(), 5000);
  }

  private highlightToken(token: PlayerToken, hex: string) {
    const color = new THREE.Color(hex);
    const mat = token.highlight.material as THREE.MeshBasicMaterial;
    mat.color.copy(color);
    token.highlight.visible = true;
    token.highlight.position.set(token.sprite.position.x, 0.02, token.sprite.position.z);
    const life = 2.5;
    this.push({
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

  private tryFlash(token: PlayerToken, hex: string) {
    const tryLineX = token.side === "home" ? -FIELD.playLength / 2 : FIELD.playLength / 2;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD.inGoal, FIELD.width),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex),
        transparent: true,
        opacity: 0.6,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(tryLineX + (token.side === "home" ? -FIELD.inGoal / 2 : FIELD.inGoal / 2), 0.03, 0);
    this.scene.add(plane);

    // Move token toward the try line
    const target = new THREE.Vector3(tryLineX, token.sprite.position.y, token.sprite.position.z);
    const start = token.sprite.position.clone();

    const life = 2.0;
    this.push({
      age: 0,
      life,
      tick: (age) => {
        const t = Math.min(age / life, 1);
        token.sprite.position.lerpVectors(start, target, t);
        (plane.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
      },
      dispose: () => {
        this.scene.remove(plane);
        plane.geometry.dispose();
        (plane.material as THREE.Material).dispose();
      },
    });
  }

  private goalArc(token: PlayerToken, made: boolean) {
    const postX = token.side === "home" ? -FIELD.playLength / 2 : FIELD.playLength / 2;
    const start = new THREE.Vector3(token.sprite.position.x, 0.5, token.sprite.position.z);
    const end = new THREE.Vector3(postX, 3, made ? 0 : (token.side === "home" ? -5 : 5));
    this.ballArc(start, end, 12, 1.8);
  }

  private kickArc(token: PlayerToken) {
    const forward = token.side === "home" ? 1 : -1;
    const start = new THREE.Vector3(token.sprite.position.x, 0.5, token.sprite.position.z);
    const end = new THREE.Vector3(token.sprite.position.x + forward * 30, 0.5, token.sprite.position.z);
    this.ballArc(start, end, 18, 1.8);
  }

  private ballArc(start: THREE.Vector3, end: THREE.Vector3, peakY: number, life: number) {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xdfb46a }),
    );
    ball.position.copy(start);
    this.scene.add(ball);

    this.push({
      age: 0,
      life,
      tick: (age) => {
        const t = Math.min(age / life, 1);
        const x = THREE.MathUtils.lerp(start.x, end.x, t);
        const z = THREE.MathUtils.lerp(start.z, end.z, t);
        const y = THREE.MathUtils.lerp(start.y, end.y, t) + Math.sin(Math.PI * t) * peakY;
        ball.position.set(x, y, z);
      },
      dispose: () => {
        this.scene.remove(ball);
        ball.geometry.dispose();
        (ball.material as THREE.Material).dispose();
      },
    });
  }

  private push(eff: Effect) { this.effects.push(eff); }
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
