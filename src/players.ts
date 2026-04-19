import * as THREE from "three";
import type { MatchData, Player, Side } from "./types";
import { FIELD } from "./field";
import { palette } from "./teamColors";
import { buildJerseyTexture } from "./jersey";

export interface PlayerToken {
  playerId: number;
  side: Side;
  teamId: number;
  player: Player;
  sprite: THREE.Sprite;
  highlight: THREE.Mesh;
  homePosition: THREE.Vector3;
}

// side = -1 for home (left half), +1 for away (right half).
function formationSlot(number: number, side: number): THREE.Vector3 {
  const halfLen = FIELD.playLength / 2;
  const halfWid = FIELD.width / 2;
  const table: Record<number, [number, number]> = {
    1: [-halfLen + 10, 0],
    2: [-halfLen + 35, -halfWid + 4],
    3: [-halfLen + 35, -halfWid + 20],
    4: [-halfLen + 35, halfWid - 20],
    5: [-halfLen + 35, halfWid - 4],
    6: [-halfLen + 25, -6],
    7: [-halfLen + 25, 6],
    8: [-halfLen + 40, -6],
    9: [-halfLen + 40, 0],
    10: [-halfLen + 40, 6],
    11: [-halfLen + 40, -14],
    12: [-halfLen + 40, 14],
    13: [-halfLen + 40, 0],
  };
  const [x, z] = table[number] ?? [-halfLen + 45, (number - 14) * 3];
  return new THREE.Vector3(side * x, 1.2, side === 1 ? -z : z);
}

export async function spawnPlayers(
  scene: THREE.Scene,
  match: MatchData,
): Promise<Map<number, PlayerToken>> {
  const tokens = new Map<number, PlayerToken>();

  const build = async (player: Player, side: Side, teamId: number, themeKey: string) => {
    const pal = palette(themeKey);
    const badgeUrl = `/logos/${themeKey}.svg`;
    const tex = await buildJerseyTexture(pal, player.number, badgeUrl);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true }),
    );
    sprite.scale.set(3, 3, 1);
    const home = formationSlot(player.number, side === "home" ? -1 : 1);
    sprite.position.copy(home);
    sprite.visible = !!player.isOnField;

    // Highlight ring beneath the token (hidden by default, used by effects)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.8, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(home.x, 0.02, home.z);
    ring.visible = false;

    scene.add(sprite);
    scene.add(ring);

    tokens.set(player.playerId, {
      playerId: player.playerId,
      side,
      teamId,
      player,
      sprite,
      highlight: ring,
      homePosition: home,
    });
  };

  const homeKey = match.homeTeam.theme?.key ?? "home";
  const awayKey = match.awayTeam.theme?.key ?? "away";
  await Promise.all([
    ...match.homeTeam.players.map((p) => build(p, "home", match.homeTeam.teamId, homeKey)),
    ...match.awayTeam.players.map((p) => build(p, "away", match.awayTeam.teamId, awayKey)),
  ]);
  return tokens;
}
