import type { Entity } from "./core";

type EntityVisualOptions = {
  time?: number;
  visualEffects?: boolean;
};

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string) {
  ctx.fillStyle = fill;
  roundedRect(ctx, x, y, w, h, radius);
  ctx.fill();
}

function strokeRounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, stroke: string, width = 1) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  roundedRect(ctx, x, y, w, h, radius);
  ctx.stroke();
}

/**
 * Arte fallback compartido por el editor y Play. Cada preset tiene silueta,
 * detalle y movimiento propio, pero conserva el color configurado por Entity.
 */
export function drawEntityFallback(ctx: CanvasRenderingContext2D, entity: Entity, { time = 0, visualEffects = true }: EntityVisualOptions = {}) {
  const { x, y, w, h, color, kind } = entity;
  const pulse = Math.sin(time * 3.5) * 0.5 + 0.5;
  const glow = visualEffects ? 5 + pulse * 4 : 0;

  ctx.save();
  if (visualEffects) {
    ctx.shadowColor = color;
    ctx.shadowBlur = kind === "coin" ? 12 + pulse * 4 : kind === "goal" ? 13 + pulse * 4 : 5;
  }

  if (kind === "coin") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const radius = Math.max(3, Math.min(w, h) / 2 - 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = Math.max(1, radius * 0.14);
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.67, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.beginPath();
    ctx.arc(cx - radius * 0.34, cy - radius * 0.34, Math.max(1, radius * 0.16), 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "goal") {
    const poleX = x + Math.max(3, w * 0.2);
    const poleW = Math.max(2, w * 0.09);
    ctx.shadowBlur = glow;
    fillRounded(ctx, x, y + h * 0.9, w * 0.72, h * 0.1, Math.max(2, w * 0.06), "rgba(255,255,255,0.22)");
    fillRounded(ctx, poleX, y, poleW, h, poleW / 2, color);
    ctx.fillStyle = "rgba(255,255,255,0.84)";
    ctx.beginPath();
    ctx.moveTo(poleX + poleW, y + h * 0.08);
    ctx.lineTo(x + w, y + h * 0.22);
    ctx.lineTo(poleX + poleW, y + h * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, w * 0.06);
    ctx.beginPath();
    ctx.moveTo(poleX + poleW, y + h * 0.08);
    ctx.lineTo(x + w, y + h * 0.22);
    ctx.lineTo(poleX + poleW, y + h * 0.38);
    ctx.stroke();
  } else if (kind === "enemy") {
    const radius = Math.min(w, h) * 0.18;
    fillRounded(ctx, x, y + h * 0.12, w, h * 0.78, radius, color);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#161b3a";
    ctx.beginPath();
    ctx.arc(x + w * 0.32, y + h * 0.49, Math.max(2, w * 0.1), 0, Math.PI * 2);
    ctx.arc(x + w * 0.68, y + h * 0.49, Math.max(2, w * 0.1), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(22,27,58,0.7)";
    ctx.lineWidth = Math.max(1, w * 0.05);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.34, y + h * 0.7);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.8, x + w * 0.66, y + h * 0.7);
    ctx.stroke();
  } else if (kind === "platform") {
    // Bloque continuo: bordes mínimos para que piezas contiguas se unan visualmente.
    const radius = Math.min(5, Math.max(2, h * 0.12));
    const depth = Math.max(3, Math.min(8, h * 0.2));
    const capH = Math.max(6, Math.min(15, h * 0.36));

    // Halo volumétrico alrededor del cuerpo completo, nunca una raya aislada.
    if (visualEffects) {
      ctx.shadowColor = "rgba(91, 183, 255, 0.88)";
      ctx.shadowBlur = 16 + glow;
    }
    fillRounded(ctx, x, y + depth * 0.55, w, Math.max(4, h - depth * 0.2), radius, "rgba(8,25,64,0.78)");
    ctx.shadowBlur = 0;

    // Cuerpo compacto con faldón inferior, sin panel interior que cree separaciones.
    fillRounded(ctx, x, y + depth, w, Math.max(4, h - depth), radius, color);
    ctx.fillStyle = "rgba(5,16,45,0.44)";
    ctx.fillRect(x, y + h - Math.max(3, h * 0.14), w, Math.max(2, h * 0.1));

    // Cara superior ancha: la iluminación ocupa la superficie y conecta con el bloque vecino.
    fillRounded(ctx, x, y, w, capH, radius, "rgba(109, 196, 255, 0.96)");

    // Remaches internos, alejados de las uniones para no dibujar falsas grietas.
    ctx.fillStyle = "rgba(225,248,255,0.5)";
    const rivet = Math.max(1.5, Math.min(3.5, h * 0.085));
    for (const px of [x + w * 0.18, x + w * 0.5, x + w * 0.82]) {
      ctx.beginPath();
      ctx.arc(px, y + h * 0.68, rivet, 0, Math.PI * 2);
      ctx.fill();
    }
    strokeRounded(ctx, x, y, w, h, radius, "rgba(179,235,255,0.76)", Math.max(1, h * 0.04));
  } else if (kind === "decor") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(x + w, cy - h * 0.12);
    ctx.lineTo(x + w * 0.78, y + h);
    ctx.lineTo(x + w * 0.22, y + h);
    ctx.lineTo(x, cy - h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.34)";
    ctx.beginPath();
    ctx.moveTo(cx, y + h * 0.14);
    ctx.lineTo(cx + w * 0.18, cy);
    ctx.lineTo(cx, y + h * 0.78);
    ctx.lineTo(cx - w * 0.08, cy);
    ctx.closePath();
    ctx.fill();
    strokeRounded(ctx, x + w * 0.1, y + h * 0.08, w * 0.8, h * 0.84, Math.min(10, w * 0.12), "rgba(255,255,255,0.24)");
  } else if (kind !== "player") {
    fillRounded(ctx, x, y, w, h, Math.min(8, Math.min(w, h) * 0.18), color);
    ctx.shadowBlur = 0;
    strokeRounded(ctx, x, y, w, h, Math.min(8, Math.min(w, h) * 0.18), "rgba(255,255,255,0.24)");
  }

  ctx.restore();
}
