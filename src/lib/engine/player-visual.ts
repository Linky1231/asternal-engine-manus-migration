type PillVisualOptions = {
  time: number;
  speed?: number;
  facing?: 1 | -1;
  visualEffects?: boolean;
};

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Render consistente de la píldora azul en el editor y en Play. */
export function drawPlayerPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  { time, speed = 0, facing = 1, visualEffects = true }: PillVisualOptions,
) {
  const movement = Math.min(1, Math.abs(speed) / 220);
  const walkPhase = time * (8 + movement * 8);
  const bob = movement > 0.03 ? Math.sin(walkPhase) * Math.min(2.4, h * 0.045) : 0;
  const squash = movement > 0.03 ? 1 + Math.sin(walkPhase * 2) * 0.035 : 1;
  const bodyH = h * squash;
  const bodyY = y + h - bodyH + bob;
  const r = Math.min(w / 2, h / 2, 18);

  ctx.save();
  if (visualEffects) {
    ctx.shadowColor = "rgba(86, 173, 255, 0.72)";
    ctx.shadowBlur = 10 + movement * 5;
  }
  // Superficie sólida con halo: sin raya aislada en la cabeza.
  ctx.fillStyle = "#5fb8ee";
  roundedRect(ctx, x, bodyY, w, bodyH, r);
  ctx.fill();

  // Luz amplia y suave integrada en el volumen superior.
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(224,248,255,0.13)";
  roundedRect(ctx, x + w * 0.12, bodyY + bodyH * 0.08, w * 0.76, bodyH * 0.32, Math.min(10, r));
  ctx.fill();

  const blinkCycle = (time % 4.2);
  const blinking = blinkCycle > 3.92 && blinkCycle < 4.08;
  const eyeW = Math.max(4, w * 0.16);
  const eyeH = blinking ? Math.max(1.2, h * 0.026) : Math.max(4, h * 0.12);
  const eyeY = bodyY + bodyH * 0.36 - eyeH / 2;
  const gaze = Math.sin(time * 3.4) * Math.min(1.5, w * 0.025) + (facing < 0 ? -1 : 1) * movement * Math.min(1.5, w * 0.03);
  ctx.fillStyle = "#10254e";
  roundedRect(ctx, x + w * 0.25 + gaze, eyeY, eyeW, eyeH, eyeH / 2);
  ctx.fill();
  roundedRect(ctx, x + w * 0.59 + gaze, eyeY, eyeW, eyeH, eyeH / 2);
  ctx.fill();

  if (movement > 0.08) {
    ctx.strokeStyle = "rgba(16, 37, 78, 0.34)";
    ctx.lineWidth = Math.max(1, w * 0.035);
    ctx.lineCap = "round";
    const step = Math.sin(walkPhase) * w * 0.07;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.28 - step, bodyY + bodyH * 0.91);
    ctx.lineTo(x + w * 0.39 - step, bodyY + bodyH * 0.91);
    ctx.moveTo(x + w * 0.61 + step, bodyY + bodyH * 0.91);
    ctx.lineTo(x + w * 0.72 + step, bodyY + bodyH * 0.91);
    ctx.stroke();
  }
  ctx.restore();
}
