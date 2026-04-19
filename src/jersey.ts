import * as THREE from "three";
import type { TeamPalette } from "./teamColors";

const JERSEY_SIZE = 256;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Draws a jersey badge (team primary colour rectangle with sleeves, team logo
// centred, number below) into a canvas. Returned as a CanvasTexture so it can
// be reused across Sprite materials.
export async function buildJerseyTexture(
  palette: TeamPalette,
  number: number,
  badgeUrl: string,
): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement("canvas");
  canvas.width = JERSEY_SIZE;
  canvas.height = JERSEY_SIZE;
  const ctx = canvas.getContext("2d")!;

  // Base body
  ctx.fillStyle = palette.primary;
  roundedRect(ctx, 40, 60, 176, 176, 18);
  ctx.fill();

  // Collar flash
  ctx.fillStyle = palette.secondary;
  roundedRect(ctx, 96, 48, 64, 24, 8);
  ctx.fill();

  // Shoulder stripes
  ctx.fillStyle = palette.secondary;
  ctx.fillRect(40, 80, 30, 18);
  ctx.fillRect(186, 80, 30, 18);

  // Badge
  try {
    const img = await loadImage(badgeUrl);
    const size = 96;
    ctx.drawImage(img, (JERSEY_SIZE - size) / 2, 96, size, size);
  } catch {
    // If the logo fails to load we just skip it; base jersey still renders.
  }

  // Number
  ctx.fillStyle = palette.numberColor;
  ctx.font = "bold 60px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), JERSEY_SIZE / 2, 210);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
