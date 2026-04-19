import * as THREE from "three";
import type { MatchData, Player, Side } from "./types";
import { palette, type TeamPalette } from "./teamColors";
import { buildJerseyTexture } from "./jersey";
import { buildNameplate } from "./nameplate";

export interface PlayerToken {
  playerId: number;
  side: Side;
  teamId: number;
  themeKey: string;
  teamName: string;
  player: Player;
  root: THREE.Group;
  torsoMaterial: THREE.MeshStandardMaterial;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  highlight: THREE.Mesh;
  nameplate: THREE.Sprite;
  walkPhase: number;
  lastX: number;
  lastZ: number;
  onField: boolean;
}

const PLAYER_SCALE = 2.0;

// Shared geometry. Capsule limbs give rounded joints instead of squared-off
// box ends; sphere caps at shoulders/elbows/knees/hands hide the seams.
const GEOM = {
  head: new THREE.SphereGeometry(0.14, 20, 14),
  neck: new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12),
  torso: new THREE.BoxGeometry(0.62, 0.58, 0.32),
  shoulder: new THREE.SphereGeometry(0.17, 16, 12),
  upperArm: new THREE.CapsuleGeometry(0.085, 0.28, 6, 12),
  forearm: new THREE.CapsuleGeometry(0.07, 0.22, 6, 12),
  elbow: new THREE.SphereGeometry(0.085, 12, 10),
  hand: new THREE.SphereGeometry(0.075, 12, 10),
  hip: new THREE.BoxGeometry(0.56, 0.3, 0.38),
  thigh: new THREE.CapsuleGeometry(0.115, 0.3, 6, 12),
  shin: new THREE.CapsuleGeometry(0.09, 0.28, 6, 12),
  knee: new THREE.SphereGeometry(0.1, 12, 10),
  sock: new THREE.CylinderGeometry(0.095, 0.095, 0.16, 12),
  boot: new THREE.BoxGeometry(0.22, 0.1, 0.36),
  highlightRing: new THREE.RingGeometry(0.7, 1.05, 32),
};

const SKIN_MAT = new THREE.MeshStandardMaterial({ color: 0xc89b7b, roughness: 0.75 });
const BOOT_MAT = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 });

function buildHumanoid(jerseyTex: THREE.CanvasTexture, pal: TeamPalette) {
  const group = new THREE.Group();
  group.scale.setScalar(PLAYER_SCALE);

  const jerseyMat = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    color: 0xffffff,
    roughness: 0.7,
  });
  const primaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(pal.primary),
    roughness: 0.65,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(pal.secondary),
    roughness: 0.7,
  });

  // Torso box face order: right, left, top, bottom, front, back.
  // Jersey texture wraps all four side faces so the number + badge are
  // readable regardless of which way the player is facing. Top + bottom stay
  // solid team colour.
  const torsoMats: THREE.MeshStandardMaterial[] = [
    jerseyMat, jerseyMat, primaryMat, primaryMat, jerseyMat, jerseyMat,
  ];
  const torso = new THREE.Mesh(GEOM.torso, torsoMats);
  torso.position.y = 1.35;
  torso.castShadow = true;
  group.add(torso);

  // Shoulder caps anchor the arm joint visually.
  for (const sx of [-0.32, 0.32]) {
    const shoulder = new THREE.Mesh(GEOM.shoulder, primaryMat);
    shoulder.position.set(sx, 1.56, 0);
    shoulder.castShadow = true;
    group.add(shoulder);
  }

  const neck = new THREE.Mesh(GEOM.neck, SKIN_MAT);
  neck.position.y = 1.7;
  group.add(neck);

  const head = new THREE.Mesh(GEOM.head, SKIN_MAT);
  head.position.y = 1.84;
  head.castShadow = true;
  group.add(head);

  // Hip band in shorts colour spans the waist
  const hip = new THREE.Mesh(GEOM.hip, shortsMat);
  hip.position.y = 0.9;
  hip.castShadow = true;
  group.add(hip);

  // Arm = group pivoting at shoulder, upper arm in jersey sleeve colour then
  // bare skin at the forearm (rugby jerseys are short-sleeved).
  const makeArm = (sx: number) => {
    const arm = new THREE.Group();
    arm.position.set(sx, 1.48, 0);

    const upper = new THREE.Mesh(GEOM.upperArm, primaryMat);
    upper.position.y = -0.19;
    upper.castShadow = true;
    arm.add(upper);

    const elbow = new THREE.Mesh(GEOM.elbow, SKIN_MAT);
    elbow.position.y = -0.37;
    arm.add(elbow);

    const forearm = new THREE.Mesh(GEOM.forearm, SKIN_MAT);
    forearm.position.y = -0.52;
    forearm.castShadow = true;
    arm.add(forearm);

    const hand = new THREE.Mesh(GEOM.hand, SKIN_MAT);
    hand.position.y = -0.7;
    arm.add(hand);

    return arm;
  };
  const leftArm = makeArm(-0.43);
  const rightArm = makeArm(0.43);
  group.add(leftArm, rightArm);

  // Leg = group pivoting at hip, with thigh (skin), knee, shin, sock (team
  // colour above the boot), boot.
  const makeLeg = (sx: number) => {
    const leg = new THREE.Group();
    leg.position.set(sx, 0.72, 0);

    const thigh = new THREE.Mesh(GEOM.thigh, SKIN_MAT);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    leg.add(thigh);

    const knee = new THREE.Mesh(GEOM.knee, SKIN_MAT);
    knee.position.y = -0.44;
    leg.add(knee);

    const shin = new THREE.Mesh(GEOM.shin, SKIN_MAT);
    shin.position.y = -0.6;
    shin.castShadow = true;
    leg.add(shin);

    const sock = new THREE.Mesh(GEOM.sock, primaryMat);
    sock.position.y = -0.78;
    leg.add(sock);

    const boot = new THREE.Mesh(GEOM.boot, BOOT_MAT);
    boot.position.set(0, -0.9, 0.06);
    boot.castShadow = true;
    leg.add(boot);

    return leg;
  };
  const leftLeg = makeLeg(-0.15);
  const rightLeg = makeLeg(0.15);
  group.add(leftLeg, rightLeg);

  return { group, torsoMat: jerseyMat, leftArm, rightArm, leftLeg, rightLeg };
}

export async function spawnPlayers(
  scene: THREE.Scene,
  match: MatchData,
): Promise<Map<number, PlayerToken>> {
  const tokens = new Map<number, PlayerToken>();

  const make = async (
    player: Player,
    side: Side,
    teamId: number,
    themeKey: string,
    teamName: string,
  ) => {
    const pal = palette(themeKey);
    const jerseyTex = await buildJerseyTexture(pal, player.number, `/logos/${themeKey}.svg`);
    const { group, torsoMat, leftArm, rightArm, leftLeg, rightLeg } = buildHumanoid(jerseyTex, pal);

    const nameplate = buildNameplate(player.number, player.firstName, player.lastName);
    group.add(nameplate);

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
      themeKey,
      teamName,
      player,
      root: group,
      torsoMaterial: torsoMat,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      highlight: ring,
      nameplate,
      walkPhase: 0,
      lastX: 0,
      lastZ: 0,
      onField: player.number <= 13,
    });
  };

  const homeKey = match.homeTeam.theme?.key ?? "home";
  const awayKey = match.awayTeam.theme?.key ?? "away";
  await Promise.all([
    ...match.homeTeam.players.map((p) =>
      make(p, "home", match.homeTeam.teamId, homeKey, match.homeTeam.nickName),
    ),
    ...match.awayTeam.players.map((p) =>
      make(p, "away", match.awayTeam.teamId, awayKey, match.awayTeam.nickName),
    ),
  ]);
  return tokens;
}

export function animateToken(token: PlayerToken, dt: number, ballX: number, ballZ: number) {
  const pos = token.root.position;
  const dx = pos.x - token.lastX;
  const dz = pos.z - token.lastZ;
  const speed = Math.sqrt(dx * dx + dz * dz) / Math.max(dt, 0.001);
  token.lastX = pos.x;
  token.lastZ = pos.z;

  const fx = ballX - pos.x;
  const fz = ballZ - pos.z;
  if (fx * fx + fz * fz > 0.01) {
    token.root.rotation.y = Math.atan2(fx, fz);
  }

  const normalized = Math.min(speed / 8, 1.5);
  token.walkPhase += dt * (6 + normalized * 10);
  const swing = Math.sin(token.walkPhase) * 0.5 * normalized;
  const counter = Math.sin(token.walkPhase + Math.PI) * 0.5 * normalized;

  token.leftLeg.rotation.x = swing;
  token.rightLeg.rotation.x = counter;
  token.leftArm.rotation.x = counter * 0.7;
  token.rightArm.rotation.x = swing * 0.7;

  token.highlight.position.set(pos.x, 0.02, pos.z);
}
