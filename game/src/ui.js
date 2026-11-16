// Everything the player reads: the indigo field and its ember-line, the HUD
// (score, wave, lives, combo), the wave banner, and the three screens —
// title, pause and game over. All of it is canvas drawing from the game
// state; this module changes nothing, it only paints.

const FONT = '"Segoe UI", system-ui, sans-serif';
const DISPLAY_FONT = 'Georgia, "Times New Roman", serif';

/** Dust specks drifting on the field, fixed once so the sky never flickers. */
const DUST = [];
for (let i = 0; i < 70; i += 1) {
  DUST.push({
    x: ((i * 137.5) % 960),
    y: ((i * 89.3) % 640),
    r: 0.8 + ((i * 7) % 10) / 6,
    drift: 4 + ((i * 13) % 10),
  });
}

/** The field itself: night-indigo gradient, drifting dust, the ember-line. */
export function drawBackground(ctx, state) {
  const { width, height } = state;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0a0e2a');
  grad.addColorStop(0.55, '#101736');
  grad.addColorStop(1, '#1a1030');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Far silhouettes: two ridge lines the embers fall past.
  ctx.fillStyle = 'rgba(38, 48, 96, 0.5)';
  ctx.beginPath();
  ctx.moveTo(0, 470);
  for (let x = 0; x <= width; x += 80) {
    ctx.lineTo(x, 470 - 26 * Math.abs(Math.sin(x * 0.011 + 2)));
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Dust.
  ctx.fillStyle = 'rgba(190, 205, 255, 0.35)';
  for (const d of DUST) {
    const y = (d.y + state.time * d.drift) % height;
    ctx.beginPath();
    ctx.arc(d.x, y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // The ember-line: a band of banked coals with a bright heart, gently pulsing.
  const pulse = 0.75 + Math.sin(state.time * 2.2) * 0.25;
  const lineGrad = ctx.createLinearGradient(0, state.lineY, 0, height);
  lineGrad.addColorStop(0, `rgba(255, 140, 60, ${0.55 * pulse})`);
  lineGrad.addColorStop(0.25, 'rgba(120, 40, 20, 0.55)');
  lineGrad.addColorStop(1, 'rgba(30, 8, 16, 0.9)');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(0, state.lineY, width, height - state.lineY);
  ctx.fillStyle = `rgba(255, 196, 110, ${0.9 * pulse})`;
  ctx.fillRect(0, state.lineY, width, 3);
  // Ward ticks along the line.
  ctx.fillStyle = 'rgba(255, 220, 160, 0.5)';
  for (let x = 24; x < width; x += 48) {
    ctx.fillRect(x, state.lineY + 8, 3, 10);
  }
}

/** A red vignette that flares when a life is lost. */
export function drawDamageFlash(ctx, state) {
  if (state.flash <= 0) return;
  const { width, height } = state;
  const grad = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.85);
  grad.addColorStop(0, 'rgba(255, 40, 20, 0)');
  grad.addColorStop(1, `rgba(255, 40, 20, ${0.5 * state.flash})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function label(ctx, text, x, y, size, colour, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}

/** Score, best, wave, lives and the combo meter — always visible in play. */
export function drawHUD(ctx, state) {
  const { width } = state;
  label(ctx, 'SCORE', 22, 30, 12, 'rgba(200, 212, 255, 0.7)');
  label(ctx, String(state.score).padStart(6, '0'), 22, 58, 26, '#ffe9bd', 'left', 700);

  // Lives: little warden-orbs under the score.
  for (let i = 0; i < state.maxLives; i += 1) {
    const x = 34 + i * 26;
    const y = 82;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    if (i < state.lives) {
      const g = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, 9);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#5f87c9');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = 'rgba(120, 130, 170, 0.25)';
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  label(ctx, `WAVE ${state.wave}`, width / 2, 46, 22, '#ffd9a0', 'center', 700);
  label(ctx, 'BEST', width - 22, 30, 12, 'rgba(200, 212, 255, 0.7)', 'right');
  label(ctx, String(state.best).padStart(6, '0'), width - 22, 58, 26, '#ffe9bd', 'right', 700);

  // Combo: the multiplier, and a meter filling toward the next one.
  if (state.combo > 1) {
    label(ctx, `COMBO ×${state.multiplier}`, 22, state.height - 18, 17, '#ffb347', 'left', 700);
    const progress = (state.combo % 10) / 10;
    ctx.fillStyle = 'rgba(255, 179, 71, 0.25)';
    ctx.fillRect(128, state.height - 27, 90, 6);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(128, state.height - 27, 90 * (state.multiplier >= 5 ? 1 : progress), 6);
  }
  label(ctx, state.muted ? 'M — sound off' : 'P — pause · M — sound', width - 22, state.height - 18, 12, 'rgba(200, 212, 255, 0.55)', 'right', 400);
}

/** The big centre banner shown as a wave begins. */
export function drawBanner(ctx, state) {
  if (state.banner === null || state.banner.timer <= 0) return;
  const t = state.banner.timer / state.banner.duration;
  const alpha = Math.min(1, t * 3, (1 - t) * 4 + 0.2);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.font = `700 54px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd9a0';
  ctx.shadowColor = 'rgba(255, 150, 60, 0.8)';
  ctx.shadowBlur = 26;
  ctx.fillText(state.banner.text, state.width / 2, state.height / 2 - 60);
  ctx.shadowBlur = 0;
  if (state.banner.sub !== '') {
    label(ctx, state.banner.sub, state.width / 2, state.height / 2 - 24, 17, 'rgba(230, 236, 255, 0.9)', 'center', 400);
  }
  ctx.restore();
}

function dim(ctx, state, alpha) {
  ctx.fillStyle = `rgba(5, 6, 20, ${alpha})`;
  ctx.fillRect(0, 0, state.width, state.height);
}

/** The title screen: name, the vigil's rules, and how to begin. */
export function drawTitleScreen(ctx, state) {
  dim(ctx, state, 0.45);
  const cx = state.width / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `700 96px ${DISPLAY_FONT}`;
  ctx.shadowColor = 'rgba(255, 150, 60, 0.85)';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ffd9a0';
  ctx.fillText('EMBERFALL', cx, 218);
  ctx.shadowBlur = 0;
  ctx.font = `italic 21px ${DISPLAY_FONT}`;
  ctx.fillStyle = 'rgba(230, 236, 255, 0.85)';
  ctx.fillText('— a warden’s vigil —', cx, 256);
  ctx.restore();

  label(ctx, 'Ember-motes are falling on the ward-line. Hold it.', cx, 330, 18, '#e6ecff', 'center', 400);
  label(ctx, 'Move — WASD or arrow keys        Aim — mouse        Fire — hold click or SPACE', cx, 372, 16, 'rgba(200, 212, 255, 0.85)', 'center', 400);
  label(ctx, 'Every mote that crosses the ember-line costs a life. Streak kills to raise your combo.', cx, 400, 16, 'rgba(200, 212, 255, 0.85)', 'center', 400);

  const pulse = 0.65 + Math.sin(state.time * 3) * 0.35;
  ctx.save();
  ctx.globalAlpha = pulse;
  label(ctx, 'PRESS ENTER OR CLICK TO BEGIN', cx, 478, 20, '#ffd166', 'center', 700);
  ctx.restore();
  if (state.best > 0) {
    label(ctx, `Best vigil so far: ${state.best}`, cx, 522, 15, 'rgba(200, 212, 255, 0.7)', 'center', 400);
  }
}

/** The pause overlay. */
export function drawPauseScreen(ctx, state) {
  dim(ctx, state, 0.55);
  const cx = state.width / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `700 52px ${DISPLAY_FONT}`;
  ctx.fillStyle = '#ffd9a0';
  ctx.fillText('PAUSED', cx, state.height / 2 - 10);
  ctx.restore();
  label(ctx, 'Press P to resume', cx, state.height / 2 + 30, 17, 'rgba(230, 236, 255, 0.9)', 'center', 400);
}

/** The results screen: the fallen line, the final tally, the way back in. */
export function drawGameOverScreen(ctx, state) {
  dim(ctx, state, 0.62);
  const cx = state.width / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `700 56px ${DISPLAY_FONT}`;
  ctx.shadowColor = 'rgba(255, 80, 40, 0.7)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#ffb59d';
  ctx.fillText('THE LINE HAS FALLEN', cx, 190);
  ctx.shadowBlur = 0;
  ctx.restore();

  label(ctx, 'FINAL SCORE', cx, 268, 13, 'rgba(200, 212, 255, 0.7)', 'center');
  label(ctx, String(state.score), cx, 322, 52, '#ffe9bd', 'center', 700);
  label(ctx, `Wave reached ${state.wave}   ·   Motes burned ${state.kills}   ·   Best combo ×${state.maxMultiplier}`, cx, 372, 17, '#e6ecff', 'center', 400);
  if (state.score >= state.best && state.score > 0) {
    label(ctx, 'A new best vigil.', cx, 404, 16, '#ffd166', 'center', 700);
  } else {
    label(ctx, `Best: ${state.best}`, cx, 404, 16, 'rgba(200, 212, 255, 0.75)', 'center', 400);
  }

  const pulse = 0.65 + Math.sin(state.time * 3) * 0.35;
  ctx.save();
  ctx.globalAlpha = pulse;
  label(ctx, 'PRESS R OR CLICK TO STAND AGAIN', cx, 478, 19, '#ffd166', 'center', 700);
  ctx.restore();
}
