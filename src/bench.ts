import * as THREE from "three";
import type { MatchData, Side } from "./types";
import { palette } from "./teamColors";

const BENCH_Z = -44; // just outside the -34 sideline
const HOME_CENTRE_X = -22;
const AWAY_CENTRE_X = 22;

// Returns where a bench player (jersey 14+) should stand while off the field.
export function benchPosition(side: Side, number: number): { x: number; z: number } {
  const slotIdx = Math.max(0, number - 14); // 14→0, 15→1, …
  const centreX = side === "home" ? HOME_CENTRE_X : AWAY_CENTRE_X;
  const x = centreX + (slotIdx - 2.5) * 2.3;
  return { x, z: BENCH_Z + 0.9 };
}

// Two dugout-style team benches along the front sideline — seat, backrest in
// team colour, roof canopy held up by posts. Each holds the jerseys 14+ for
// that team plus any starter who gets interchanged off.
export function buildBenches(scene: THREE.Scene, match: MatchData): void {
  const homeKey = match.homeTeam.theme?.key ?? "home";
  const awayKey = match.awayTeam.theme?.key ?? "away";
  buildOneBench(scene, HOME_CENTRE_X, palette(homeKey).primary);
  buildOneBench(scene, AWAY_CENTRE_X, palette(awayKey).primary);
}

function buildOneBench(scene: THREE.Scene, centreX: number, teamColor: string) {
  const width = 16;
  const depth = 3.5;

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 });
  const backMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor) });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x242836, roughness: 0.7 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), floorMat);
  floor.position.set(centreX, 0.1, BENCH_Z);
  floor.receiveShadow = true;
  scene.add(floor);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(width - 1, 0.4, 0.7), seatMat);
  seat.position.set(centreX, 0.42, BENCH_Z + 0.9);
  seat.castShadow = true;
  seat.receiveShadow = true;
  scene.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(width - 1, 1.4, 0.25), backMat);
  back.position.set(centreX, 1.0, BENCH_Z + 0.45);
  back.castShadow = true;
  back.receiveShadow = true;
  scene.add(back);

  const postGeom = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
  for (const sx of [-width / 2 + 0.3, width / 2 - 0.3]) {
    const front = new THREE.Mesh(postGeom, postMat);
    front.position.set(centreX + sx, 1.5, BENCH_Z + depth / 2 - 0.2);
    front.castShadow = true;
    scene.add(front);
    const rear = new THREE.Mesh(postGeom, postMat);
    rear.position.set(centreX + sx, 1.5, BENCH_Z - depth / 2 + 0.2);
    rear.castShadow = true;
    scene.add(rear);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.12, depth + 0.6), roofMat);
  roof.position.set(centreX, 3.0, BENCH_Z);
  roof.castShadow = true;
  scene.add(roof);

  // Thin team-colour trim along the roof front
  const trim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.18, 0.1), backMat);
  trim.position.set(centreX, 2.95, BENCH_Z + depth / 2 + 0.1);
  scene.add(trim);
}
