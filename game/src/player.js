// The warden-orb: the player's piece. It glides anywhere on the field with
// WASD or the arrow keys, aims at the mouse, and fires bolts of light while
// the trigger is held. This module owns the orb, its bolts, their movement
// and their drawing; what a bolt hits is decided by the game loop in main.js.

export const PLAYER_RADIUS = 14;
const PLAYER_SPEED = 350;
const BOLT_SPEED = 760;
const FIRE_INTERVAL = 0.13;

/** A fresh orb, centred low on the field where the vigil starts. */
export function createPlayer(width, height) {
  return {
    x: width / 2,
    y: height - 130,
    radius: PLAYER_RADIUS,
    aimX: width / 2,
    aimY: height / 3,
    fireTimer: 0,
    invulnerable: 0, // seconds of post-hit grace, blinking
    tilt: 0, // visual lean from horizontal movement
  };
}

/** Place the orb back at its vigil post for a new game. */
export function resetPlayer(player, width, height) {
  player.x = width / 2;
  player.y = height - 130;
  player.aimX = width / 2;
  player.aimY = height / 3;
  player.fireTimer = 0;
  player.invulnerable = 0;
  player.tilt = 0;
}

/**
 * Move the orb from the held keys, point it at the mouse, and spawn bolts
 * while the trigger is held. `intent` is {up, down, left, right, firing,
 * aimX, aimY}; onShoot fires once per bolt so the caller can play the sound.
 */
export function updatePlayer(state, intent, dt, onShoot) {
  const player = state.player;
  let dx = 0;
  let dy = 0;
  if (intent.left) dx -= 1;
  if (intent.right) dx += 1;
  if (intent.up) dy -= 1;
  if (intent.down) dy += 1;
  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }
  player.x += dx * PLAYER_SPEED * dt;
  player.y += dy * PLAYER_SPEED * dt;
  player.x = Math.min(state.width - player.radius, Math.max(player.radius, player.x));
  player.y = Math.min(state.lineY - player.radius - 2, Math.max(player.radius, player.y));
  player.tilt += ((dx * 0.35) - player.tilt) * Math.min(1, dt * 10);
  player.aimX = intent.aimX;
  player.aimY = intent.aimY;
  if (player.invulnerable > 0) player.invulnerable -= dt;

  player.fireTimer -= dt;
  if (intent.firing && player.fireTimer <= 0) {
    player.fireTimer = FIRE_INTERVAL;
    const angle = Math.atan2(player.aimY - player.y, player.aimX - player.x);
    state.bolts.push({
      x: player.x + Math.cos(angle) * (player.radius + 4),
      y: player.y + Math.sin(angle) * (player.radius + 4),
      vx: Math.cos(angle) * BOLT_SPEED,
      vy: Math.sin(angle) * BOLT_SPEED,
      radius: 4,
    });
    onShoot();
  }
}

/** Advance every bolt; bolts that leave the field are dropped. */
export function updateBolts(state, dt) {
  for (const bolt of state.bolts) {
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
  }
  state.bolts = state.bolts.filter(
    (b) => b.x > -20 && b.x < state.width + 20 && b.y > -20 && b.y < state.height + 20,
  );
}

/** Paint the aim guide, the bolts, and the orb with its glow and lean. */
export function drawPlayer(ctx, state) {
  const player = state.player;

  // A faint dotted guide from the orb to the aim point.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.20)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 9]);
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.aimX, player.aimY);
  ctx.stroke();
  ctx.restore();

  // The aim reticle.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(player.aimX, player.aimY, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(player.aimX - 13, player.aimY);
  ctx.lineTo(player.aimX - 5, player.aimY);
  ctx.moveTo(player.aimX + 5, player.aimY);
  ctx.lineTo(player.aimX + 13, player.aimY);
  ctx.moveTo(player.aimX, player.aimY - 13);
  ctx.lineTo(player.aimX, player.aimY - 5);
  ctx.moveTo(player.aimX, player.aimY + 5);
  ctx.lineTo(player.aimX, player.aimY + 13);
  ctx.stroke();
  ctx.restore();

  // Bolts: bright cores with a warm halo.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bolt of state.bolts) {
    const grad = ctx.createRadialGradient(bolt.x, bolt.y, 0, bolt.x, bolt.y, 11);
    grad.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
    grad.addColorStop(0.35, 'rgba(255, 190, 90, 0.55)');
    grad.addColorStop(1, 'rgba(255, 150, 60, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // The orb itself: halo, shell, bright core. It blinks while invulnerable.
  const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.tilt);
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, player.radius * 2.6);
  halo.addColorStop(0, 'rgba(160, 220, 255, 0.35)');
  halo.addColorStop(1, 'rgba(160, 220, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius * 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = blink ? 0.35 : 1;
  const shell = ctx.createRadialGradient(-5, -6, 2, 0, 0, player.radius + 2);
  shell.addColorStop(0, '#fdfdff');
  shell.addColorStop(0.55, '#bcd9ff');
  shell.addColorStop(1, '#5f87c9');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff6dd';
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
