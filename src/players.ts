import * as THREE from "three";
import type { MatchData, Player, Side } from "./types";
import { palette, type TeamPalette } from "./teamColors";
import { buildJerseyTexture } from "./jersey";

export interface PlayerToken {
  playerId: number;
  side: Side;
  teamId: number;
  player: Player;
  root: THREE.Group;
  torsoMaterial: THREE.MeshStandardMaterial;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  highlight: THREE.Mesh;
  walkPhase: number;
  lastX: number;
  lastZ: number;
}

// Shared geometry — each player shares these to keep GPU cost low (~26 players
// on field × several primitives each).
const GEOM = {
  head: new THREE.SphereGeometry(0.16, 16, 12),
  torso: new THREE.BoxGeometry(0.65, 0.75, 0.35),
  shorts: new THREE.BoxGeometry(0.6, 0.3, 0.4),
  upperArm: new THREE.CylinderGeometry(0.07, 0.06, 0.45, 10),
  forearm: new THREE.CylinderGeometry(0.06, 0.05, 0.4, 10),
  thigh: new THREE.CylinderGeometry(0.1, 0.09, 0.5, 10),
  shin: new THREE.CylinderGeometry(0.08, 0.07, 0.5, 10),
  boot: new THREE.BoxGeometry(0.2, 0.1, 0.32),
  highlightRing: new THREE.RingGeometry(0.7, 1.05, 32),
};

const SKIN_MAT = new THREE.MeshStandardMaterial({ color: 0xc89b7b });
const BOOT_MAT = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });

function buildHumanoid(jerseyTex: THREE.CanvasTexture, pal: TeamPalette) {
  const group = new THREE.Group();

  const torsoMat = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    color: 0xffffff,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(pal.secondary),
  });

  // Torso + head (fixed)
  const torso = new THREE.Mesh(GEOM.torso, torsoMat);
  torso.position.y = 1.3;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(GEOM.head, SKIN_MAT);
  head.position.y = 1.82;
  head.castShadow = true;
  group.add(head);

  const shorts = new THREE.Mesh(GEOM.shorts, shortsMat);
  shorts.position.y = 0.78;
  shorts.castShadow = true;
  group.add(shorts);

  // Arm = group pivoting at shoulder, with upper arm + forearm as children
  const makeArm = (sideX: number) => {
    const arm = new THREE.Group();
    arm.position.set(sideX, 1.58, 0);

    const upper = new THREE.Mesh(GEOM.upperArm, torsoMat);
    upper.position.y = -0.22;
    arm.add(upper);

    const fore = new THREE.Mesh(GEOM.forearm, SKIN_MAT);
    fore.position.y = -0.65;
    arm.add(fore);

    return arm;
  };
  const leftArm = makeArm(-0.4);
  const rightArm = makeArm(0.4);
  group.add(leftArm, rightArm);

  // Leg = group pivoting at hip
  const makeLeg = (sideX: number) => {
    const leg = new THREE.Group();
    leg.position.set(sideX, 1.05, 0);

    const thigh = new THREE.Mesh(GEOM.thigh, shortsMat);
    thigh.position.y = -0.25;
    leg.add(thigh);

    const shin = new THREE.Mesh(GEOM.shin, SKIN_MAT);
    shin.position.y = -0.75;
    leg.add(shin);

    const boot = new THREE.Mesh(GEOM.boot, BOOT_MAT);
    boot.position.set(0, -1.03, 0.06);
    leg.add(boot);

    return leg;
  };
  const leftLeg = makeLeg(-0.15);
  const rightLeg = makeLeg(0.15);
  group.add(leftLeg, rightLeg);

  return { group, torsoMat, leftArm, rightArm, leftLeg, rightLeg };
}

export async function spawnPlayers(
  scene: THREE.Scene,
  match: MatchData,
): Promise<Map<number, PlayerToken>> {
  const tokens = new Map<number, PlayerToken>();

  const make = async (player: Player, side: Side, teamId: number, themeKey: string) => {
    const pal = palette(themeKey);
    const jerseyTex = await buildJerseyTexture(pal, player.number, `/logos/${themeKey}.svg`);
    const { group, torsoMat, leftArm, rightArm, leftLeg, rightLeg } = buildHumanoid(jerseyTex, pal);

    group.visible = !!player.isOnField;
    scene.add(group);

    const ring = new THREE.Mesh(
      GEOM.highlightRing,
      new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);

    tokens.set(player.playerId, {
      playerId: player.playerId,
      side,
      teamId,
      player,
      root: group,
      torsoMaterial: torsoMat,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      highlight: ring,
      walkPhase: 0,
      lastX: 0,
      lastZ: 0,
    });
  };

  const homeKey = match.homeTeam.theme?.key ?? "home";
  const awayKey = match.awayTeam.theme?.key ?? "away";
  await Promise.all([
    ...match.homeTeam.players.map((p) =>
      make(p, "home", match.homeTeam.teamId, homeKey),
    ),
    ...match.awayTeam.players.map((p) =>
      make(p, "away", match.awayTeam.teamId, awayKey),
    ),
  ]);
  return tokens;
}

// Apply a walk animation phase + orient the player to face ball.
export function animateToken(token: PlayerToken, dt: number, ballX: number, ballZ: number) {
  const pos = token.root.position;
  const dx = pos.x - token.lastX;
  const dz = pos.z - token.lastZ;
  const speed = Math.sqrt(dx * dx + dz * dz) / Math.max(dt, 0.001);
  token.lastX = pos.x;
  token.lastZ = pos.z;

  // Face the ball
  const fx = ballX - pos.x;
  const fz = ballZ - pos.z;
  if (fx * fx + fz * fz > 0.01) {
    token.root.rotation.y = Math.atan2(fx, fz);
  }

  // Walk cycle — advance phase when moving
  const normalized = Math.min(speed / 8, 1.5);
  token.walkPhase += dt * (6 + normalized * 10);
  const swing = Math.sin(token.walkPhase) * 0.5 * normalized;
  const counter = Math.sin(token.walkPhase + Math.PI) * 0.5 * normalized;

  token.leftLeg.rotation.x = swing;
  token.rightLeg.rotation.x = counter;
  token.leftArm.rotation.x = counter * 0.7;
  token.rightArm.rotation.x = swing * 0.7;

  // Sync highlight ring under the player's feet
  token.highlight.position.set(pos.x, 0.02, pos.z);
}
