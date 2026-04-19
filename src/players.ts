import * as THREE from "three";
import type { MatchData, Player, Side } from "./types";
import { FIELD } from "./field";

export interface PlayerToken {
  playerId: number;
  side: Side;
  player: Player;
  mesh: THREE.Mesh;
  homePosition: THREE.Vector3;
}

// Default formation slots by jersey number — rough starting positions so the
// scene has something sensible before real tracking data is wired in.
// side = -1 for home (left half), +1 for away (right half).
function formationSlot(number: number, side: number): THREE.Vector3 {
  const halfLen = FIELD.playLength / 2;
  const halfWid = FIELD.width / 2;
  // x positions (metres from halfway, own half) for each jersey number
  const table: Record<number, [number, number]> = {
    1: [-halfLen + 10, 0],          // Fullback
    2: [-halfLen + 35, -halfWid + 4], // Winger L
    3: [-halfLen + 35, -halfWid + 20], // Centre L
    4: [-halfLen + 35, halfWid - 20], // Centre R
    5: [-halfLen + 35, halfWid - 4],  // Winger R
    6: [-halfLen + 25, -6],          // Five-eighth
    7: [-halfLen + 25, 6],           // Halfback
    8: [-halfLen + 40, -6],          // Prop
    9: [-halfLen + 40, 0],           // Hooker
    10: [-halfLen + 40, 6],          // Prop
    11: [-halfLen + 40, -14],        // 2nd Row
    12: [-halfLen + 40, 14],         // 2nd Row
    13: [-halfLen + 40, 0],          // Lock
  };
  const [x, z] = table[number] ?? [-halfLen + 45, (number - 14) * 3];
  return new THREE.Vector3(side * x, 0.9, side === 1 ? -z : z);
}

export function spawnPlayers(
  scene: THREE.Scene,
  match: MatchData,
): Map<number, PlayerToken> {
  const tokens = new Map<number, PlayerToken>();
  const geom = new THREE.CapsuleGeometry(0.6, 1.2, 4, 8);

  const add = (player: Player, side: Side) => {
    const color = side === "home" ? 0x2546a6 : 0x8b1e3f;
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    const homePosition = formationSlot(player.number, side === "home" ? -1 : 1);
    mesh.position.copy(homePosition);
    mesh.visible = !!player.isOnField;
    scene.add(mesh);
    tokens.set(player.playerId, { playerId: player.playerId, side, player, mesh, homePosition });
  };

  for (const p of match.homeTeam.players) add(p, "home");
  for (const p of match.awayTeam.players) add(p, "away");
  return tokens;
}
