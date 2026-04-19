import * as THREE from "three";
import { buildField } from "./field";
import { spawnPlayers } from "./players";
import { createBall } from "./ball";
import { Replay, formatClock } from "./replay";
import { EffectSystem } from "./effects";
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.set(0, 65, 90);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(40, 120, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 300;
  scene.add(sun);

  buildField(scene);
  const tokens = await spawnPlayers(scene, match);
  const ball = createBall(scene);

  const bannerLayer = document.querySelector<HTMLDivElement>("#event-banners")!;
  const effects = new EffectSystem(scene, bannerLayer);

  const scoreboard = document.querySelector<HTMLDivElement>("#scoreboard")!;
  const clockEl = document.querySelector<HTMLSpanElement>("#clock")!;
  const playBtn = document.querySelector<HTMLButtonElement>("#play")!;
  const scrubber = document.querySelector<HTMLInputElement>("#scrubber")!;
  const speedSelect = document.querySelector<HTMLSelectElement>("#speed")!;

  const replay = new Replay(match, tokens, ball, effects);
  scrubber.max = String(Math.floor(replay.totalSeconds));
  replay.seek(0);

  const render = () => {
    scoreboard.textContent =
      `${match.homeTeam.nickName} ${replay.scoreHome} — ${replay.scoreAway} ${match.awayTeam.nickName}`;
    clockEl.textContent = formatClock(replay.seconds);
    scrubber.value = String(Math.floor(replay.seconds));
  };

  playBtn.addEventListener("click", () => {
    if (replay.isPlaying) {
      replay.pause();
      playBtn.textContent = "Play";
    } else {
      replay.play();
      playBtn.textContent = "Pause";
    }
  });
  scrubber.addEventListener("input", () => replay.seek(Number(scrubber.value)));
  speedSelect.addEventListener("change", () => replay.setTimeScale(Number(speedSelect.value)));

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  let prev = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = (now - prev) / 1000;
    prev = now;
    replay.tick(now, dt);
    render();
    renderer.render(scene, camera);
  });
}

main().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
