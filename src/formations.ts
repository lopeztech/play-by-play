import type { Side } from "./types";
import type { Snapshot } from "./simulation";

// Offsets are given relative to the ball, along the "axis of attack".
// along > 0 = toward the attacker's try line (in front of the ball)
// along < 0 = behind the ball
// across    = z position (sideline-to-sideline); positive = "right" side
interface Offset {
  along: number;
  across: number;
}

// Attacking team formation: forwards close to the ball, backs fanned out
// behind ready to receive a pass, fullback deep.
const ATTACK: Record<number, Offset> = {
  1: { along: -20, across: 0 },    // Fullback — deep
  2: { along: -4, across: -30 },   // Winger L
  3: { along: -8, across: -16 },   // Centre L
  4: { along: -8, across: 16 },    // Centre R
  5: { along: -4, across: 30 },    // Winger R
  6: { along: -8, across: -5 },    // Five-eighth
  7: { along: -5, across: 5 },     // Halfback
  8: { along: 0, across: -3 },     // Prop
  9: { along: 2, across: 0 },      // Hooker — play-the-ball
  10: { along: 0, across: 3 },     // Prop
  11: { along: 1, across: -9 },    // 2nd Row
  12: { along: 1, across: 9 },     // 2nd Row
  13: { along: 4, across: 0 },     // Lock
};

// Defensive team: line 10m in front of ball with fullback deep as safety.
const DEFEND: Record<number, Offset> = {
  1: { along: 25, across: 0 },     // Fullback — sweeper
  2: { along: 10, across: -32 },   // Winger L
  3: { along: 10, across: -18 },   // Centre L
  4: { along: 10, across: 18 },    // Centre R
  5: { along: 10, across: 32 },    // Winger R
  6: { along: 10, across: -7 },    // Five-eighth
  7: { along: 10, across: 7 },     // Halfback
  8: { along: 10, across: -3 },    // Prop
  9: { along: 5, across: 0 },      // Hooker marks at the ruck
  10: { along: 10, across: 3 },    // Prop
  11: { along: 10, across: -12 },  // 2nd Row
  12: { along: 10, across: 12 },   // 2nd Row
  13: { along: 10, across: 0 },    // Lock
};

function attackDir(side: Side | null): number {
  return side === "home" ? 1 : side === "away" ? -1 : 0;
}

export function playerTarget(
  number: number,
  playerSide: Side,
  snap: Snapshot,
): { x: number; z: number } {
  const possession = snap.possession;
  const dir = attackDir(possession);
  // If possession is unknown, park the player in a neutral slot behind
  // their own halfway — prevents the formation from snapping to the ball
  // when the simulator can't infer possession.
  if (!possession || !dir) {
    return neutralSlot(number, playerSide);
  }

  const isAttacking = possession === playerSide;
  const table = isAttacking ? ATTACK : DEFEND;
  const offset = table[number];
  if (!offset) return benchSlot(number, playerSide);

  return {
    x: clamp(snap.ballX + offset.along * dir, -58, 58),
    z: clamp(offset.across, -33, 33),
  };
}

function neutralSlot(number: number, side: Side): { x: number; z: number } {
  const sign = side === "home" ? -1 : 1;
  const row = Math.min(number, 13);
  return {
    x: sign * (20 + row * 1.5),
    z: ((row - 7) * 5),
  };
}

function benchSlot(number: number, side: Side): { x: number; z: number } {
  // 14+ sit on the sideline until interchanged
  const sign = side === "home" ? -1 : 1;
  return { x: sign * 40, z: 40 + (number - 14) * 3 };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
