import * as THREE from "three";

// Billboarded pill at the player's feet showing number + last name. Drawn at
// high canvas resolution and sprite-scaled large enough to read from the
// default camera distance.
export function buildNameplate(
  number: number,
  firstName: string,
  lastName: string,
): THREE.Sprite {
  const w = 512;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Dark rounded pill
  ctx.fillStyle = "rgba(8, 12, 26, 0.92)";
  roundedRect(ctx, 4, 8, w - 8, h - 16, 52);
  ctx.fill();

  // Thin highlight border
  ctx.strokeStyle = "rgba(255, 200, 61, 0.85)";
  ctx.lineWidth = 3;
  roundedRect(ctx, 4, 8, w - 8, h - 16, 52);
  ctx.stroke();

  // Number chip
  ctx.fillStyle = "#ffc83d";
  roundedRect(ctx, 16, 20, 96, h - 40, 32);
  ctx.fill();

  ctx.fillStyle = "#141414";
  ctx.font = "bold 60px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), 64, h / 2 + 2);

  // Name
  const initial = firstName.charAt(0).toUpperCase();
  const label = `${initial}. ${lastName}`.toUpperCase();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  // Compress text horizontally if it overflows
  const maxTextWidth = w - 140;
  const measured = ctx.measureText(label);
  if (measured.width > maxTextWidth) {
    const scale = maxTextWidth / measured.width;
    ctx.save();
    ctx.translate(128, h / 2);
    ctx.scale(scale, 1);
    ctx.fillText(label, 0, 2);
    ctx.restore();
  } else {
    ctx.fillText(label, 128, h / 2 + 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.renderOrder = 10;
  // 4:1 aspect. Parent group is scaled by PLAYER_SCALE (2×), so these local
  // values produce ~4m-wide nameplates — big enough to read from the default
  // camera position without covering neighbouring players at the halfway.
  sprite.scale.set(2.2, 0.55, 1);
  sprite.position.set(0, 0.35, 0);
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
