import * as THREE from "three";
import { buildField, FIELD } from "./field";
import { spawnPlayers } from "./players";
import { Replay, formatClock } from "./replay";
import type { MatchData } from "./types";

async function loadMatch(): Promise<MatchData> {
  const res = await fetch("/match.json");
  if (!res.ok) throw new Error(`Failed to load match.json: ${res.status}`);
  return res.json();
}

async function main() {
  const match = await loadMatch();

  const canvas = document.querySelector<HTMLCanvasElement>("#field")!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.set(0, 80, 90);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(60, 100, 40);
  scene.add(sun);

  buildField(scene);
  const tokens = spawnPlayers(scene, match);

  // HUD elements
  const scoreboard = document.querySelector<HTMLDivElement>("#scoreboard")!;
  const eventLog = document.querySelector<HTMLDivElement>("#event-log")!;
  const clockEl = document.querySelector<HTMLSpanElement>("#clock")!;
  const playBtn = document.querySelector<HTMLButtonElement>("#play")!;
  const scrubber = document.querySelector<HTMLInputElement>("#scrubber")!;

  const render = () => {
    scoreboard.textContent =
      `${match.homeTeam.nickName} ${replay.scoreHome} — ${replay.scoreAway} ${match.awayTeam.nickName}`;
    clockEl.textContent = formatClock(replay.seconds);
    scrubber.value = String(Math.floor(replay.seconds));
  };

  const replay = new Replay(match, tokens, (e, clock) => {
    eventLog.textContent = `[${clock}] ${e.type} — ${e.title}`;
  });

  scrubber.max = String(Math.floor(replay.totalSeconds));

  playBtn.addEventListener("click", () => {
    if (replay.isPlaying) {
      replay.pause();
      playBtn.textContent = "Play";
    } else {
      replay.play();
      playBtn.textContent = "Pause";
    }
  });

  scrubber.addEventListener("input", () => {
    replay.seek(Number(scrubber.value));
  });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  renderer.setAnimationLoop((now) => {
    replay.tick(now);
    render();
    renderer.render(scene, camera);
  });

  // Silence unused warning — FIELD is re-exported for consumers extending the scene.
  void FIELD;
}

main().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
