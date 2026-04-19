import * as THREE from "three";
import { buildField } from "./field";
import { spawnPlayers } from "./players";
import { createBall } from "./ball";
import { buildBenches } from "./bench";
import { Replay, formatClock } from "./replay";
import { EffectSystem } from "./effects";
import { renderSelection } from "./selection";
import type { MatchData } from "./types";

const selectionView = document.querySelector<HTMLDivElement>("#selection-view")!;
const replayView = document.querySelector<HTMLDivElement>("#replay-view")!;

function showView(which: "selection" | "replay") {
  selectionView.style.display = which === "selection" ? "block" : "none";
  replayView.style.display = which === "replay" ? "grid" : "none";
}

function matchStatus(t: number, totalSeconds: number, matchState: string): string {
  const HALF = 40 * 60;
  const FULL = 80 * 60;
  if (t < 3) return "KICK OFF";
  if (t < HALF) return "1ST HALF";
  if (t < HALF + 60) return "HALF TIME";
  if (t < FULL) return "2ND HALF";
  if (t >= totalSeconds - 5 && matchState === "FullTime") return "FULL TIME";
  return "FULL TIME";
}

function pulse(el: HTMLElement) {
  el.classList.remove("pulse");
  void el.offsetWidth;
  el.classList.add("pulse");
}

interface RunningReplay {
  dispose: () => void;
}

let currentReplay: RunningReplay | null = null;

async function startReplay(matchUrl: string): Promise<RunningReplay> {
  const res = await fetch(matchUrl);
  if (!res.ok) throw new Error(`Failed to load match (${res.status})`);
  const match: MatchData = await res.json();

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
  buildBenches(scene, match);
  const tokens = await spawnPlayers(scene, match);
  const ball = createBall(scene);

  const banner = document.querySelector<HTMLDivElement>("#event-banner-main")!;
  const effects = new EffectSystem(scene, banner);

  const homeKey = match.homeTeam.theme?.key ?? "home";
  const awayKey = match.awayTeam.theme?.key ?? "away";
  const homeNameEl = document.querySelector<HTMLSpanElement>("#sb-home-name")!;
  const awayNameEl = document.querySelector<HTMLSpanElement>("#sb-away-name")!;
  const homeLogoEl = document.querySelector<HTMLImageElement>("#sb-home-logo")!;
  const awayLogoEl = document.querySelector<HTMLImageElement>("#sb-away-logo")!;
  const homeScoreEl = document.querySelector<HTMLSpanElement>("#sb-home-score")!;
  const awayScoreEl = document.querySelector<HTMLSpanElement>("#sb-away-score")!;
  const homePossEl = document.querySelector<HTMLSpanElement>("#sb-home-poss")!;
  const awayPossEl = document.querySelector<HTMLSpanElement>("#sb-away-poss")!;
  const clockEl = document.querySelector<HTMLSpanElement>("#sb-clock")!;
  const statusEl = document.querySelector<HTMLSpanElement>("#sb-status")!;
  const slowMoEl = document.querySelector<HTMLDivElement>("#slowmo-indicator")!;

  homeNameEl.textContent = match.homeTeam.nickName;
  awayNameEl.textContent = match.awayTeam.nickName;
  homeLogoEl.src = `/logos/${homeKey}.svg`;
  homeLogoEl.alt = match.homeTeam.name;
  awayLogoEl.src = `/logos/${awayKey}.svg`;
  awayLogoEl.alt = match.awayTeam.name;

  const playBtn = document.querySelector<HTMLButtonElement>("#play")!;
  const scrubber = document.querySelector<HTMLInputElement>("#scrubber")!;
  const speedSelect = document.querySelector<HTMLSelectElement>("#speed")!;

  // Reset scrubber + scores on entering replay
  const replay = new Replay(match, tokens, ball, effects);
  scrubber.max = String(Math.floor(replay.totalSeconds));
  scrubber.value = "0";
  replay.seek(0);
  playBtn.textContent = "Play";
  homeScoreEl.textContent = "0";
  awayScoreEl.textContent = "0";

  let lastHome = -1;
  let lastAway = -1;

  const render = () => {
    if (replay.scoreHome !== lastHome) {
      homeScoreEl.textContent = String(replay.scoreHome);
      if (lastHome !== -1 && replay.scoreHome > lastHome) pulse(homeScoreEl);
      lastHome = replay.scoreHome;
    }
    if (replay.scoreAway !== lastAway) {
      awayScoreEl.textContent = String(replay.scoreAway);
      if (lastAway !== -1 && replay.scoreAway > lastAway) pulse(awayScoreEl);
      lastAway = replay.scoreAway;
    }
    clockEl.textContent = formatClock(replay.seconds);
    statusEl.textContent = matchStatus(replay.seconds, replay.totalSeconds, match.matchState);
    scrubber.value = String(Math.floor(replay.seconds));

    const poss = replay.currentSnap?.possession ?? null;
    homePossEl.classList.toggle("active", poss === "home");
    awayPossEl.classList.toggle("active", poss === "away");

    slowMoEl.classList.toggle("show", replay.slowMo && replay.isPlaying);
  };

  const onPlay = () => {
    if (replay.isPlaying) {
      replay.pause();
      playBtn.textContent = "Play";
    } else {
      replay.play();
      playBtn.textContent = "Pause";
    }
  };
  const onScrub = () => replay.seek(Number(scrubber.value));
  const onSpeed = () => replay.setTimeScale(Number(speedSelect.value));

  playBtn.addEventListener("click", onPlay);
  scrubber.addEventListener("input", onScrub);
  speedSelect.addEventListener("change", onSpeed);

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

  return {
    dispose: () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      playBtn.removeEventListener("click", onPlay);
      scrubber.removeEventListener("input", onScrub);
      speedSelect.removeEventListener("change", onSpeed);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.dispose();
        }
      });
      renderer.dispose();
      effects.reset();
    },
  };
}

async function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (currentReplay) {
    currentReplay.dispose();
    currentReplay = null;
  }
  if (hash.startsWith("match/")) {
    const slug = hash.slice("match/".length);
    showView("replay");
    try {
      currentReplay = await startReplay(`/nrl-api/draw/nrl-premiership/2026/${slug}/data`);
    } catch (err) {
      console.error(err);
      showView("selection");
      alert(`Failed to load match: ${(err as Error).message}\n\nMake sure the Vite dev server is running (it proxies /nrl-api to nrl.com).`);
      location.hash = "";
    }
  } else {
    showView("selection");
    await renderSelection(selectionView);
  }
}

document.querySelector<HTMLButtonElement>("#back-btn")?.addEventListener("click", () => {
  location.hash = "";
});

window.addEventListener("hashchange", route);
route();
