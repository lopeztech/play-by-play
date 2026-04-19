import * as THREE from "three";

// Small billboarded pill that sits at the player's feet and shows their
// number + last name. Rendered on top of other geometry (depthTest off) so
// bench players don't get occluded by the dugout.
export function buildNameplate(
  number: number,
  firstName: string,
  lastName: string,
): THREE.Sprite {
  const w = 256;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Dark rounded pill background
  ctx.fillStyle = "rgba(10, 15, 30, 0.88)";
  roundedRect(ctx, 2, 4, w - 4, h - 8, 26);
  ctx.fill();

  // Number chip on the left
  ctx.fillStyle = "#ffc83d";
  roundedRect(ctx, 8, 10, 52, h - 20, 16);
  ctx.fill();

  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), 34, h / 2);

  // Name on the right
  const initial = firstName.charAt(0).toUpperCase();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`${initial}. ${lastName}`.toUpperCase(), 72, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.renderOrder = 10;
  // Aspect 4:1. Scaled further by the parent player group (PLAYER_SCALE).
  sprite.scale.set(1.3, 0.33, 1);
  // Place slightly above the grass at the player's feet so it reads as a
  // ground-level nameplate rather than floating over the head.
  sprite.position.set(0, 0.1, 0);
  return sprite;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
