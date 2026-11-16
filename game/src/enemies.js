// The ember-motes: everything that falls toward the line. Four kinds, unlocked
// as the waves climb — drifters that sway gently, weavers that snake, streakers
// that dive fast and small, and brutes that take four bolts and shrug off the
// first three. This module owns the wave table, spawning, falling and drawing;
// what happens when a mote is shot or crosses the line is the game loop's call.

export const MOTE_TYPES = {
  drifter: { radius: 13, hp: 1, score: 10, colour: '#ffb347', speed: [52, 84] },
  weaver: { radius: 12, hp: 1, score: 15, colour: '#ff6b4a', speed: [68, 98] },
  streaker: { radius: 9, hp: 1, score: 25, colour: '#ffe066', speed: [150, 195] },
  brute: { radius: 24, hp: 4, score: 40, colour: '#ff8c42', speed: [36, 54] },
};

/** How many motes a wave sends down. */
export function waveQuota(wave) {
  return 9 + wave * 4;
}

/** Seconds between spawns in a wave; the fall thickens as waves climb. */
export function spawnInterval(wave) {
  return Math.max(0.34, 1.05 - wave * 0.06);
}

/** Which kinds may fall in a wave, and their relative weights. */
function waveMix(wave) {
  const mix = [['drifter', 10]];
  if (wave >= 2) mix.push(['weaver', 3 + wave]);
  if (wave >= 3) mix.push(['streaker', 2 + wave]);
  if (wave >= 4) mix.push(['brute', Math.min(6, wave - 2)]);
  return mix;
}

function pickType(rng, wave) {
  const mix = waveMix(wave);
  let total = 0;
  for (const [, weight] of mix) total += weight;
  let roll = rng.range(0, total);
  for (const [name, weight] of mix) {
    roll -= weight;
    if (roll <= 0) return name;
  }
  return 'drifter';
}

/** Create one mote of the given kind at the top of the field. */
export function createMote(rng, state, kind) {
  const def = MOTE_TYPES[kind];
  const x = rng.range(30, state.width - 30);
  return {
    kind,
    x,
    baseX: x,
    y: -def.radius - 6,
    vy: rng.range(def.speed[0], def.speed[1]) * (1 + (state.wave - 1) * 0.045),
    radius: def.radius,
    hp: def.hp,
    maxHp: def.hp,
    score: def.score,
    colour: def.colour,
    swayAmp: kind === 'weaver' ? rng.range(46, 84) : rng.range(4, 14),
    swayFreq: rng.range(1.6, 2.6),
    phase: rng.range(0, Math.PI * 2),
    spin: rng.range(-0.9, 0.9),
    angle: rng.range(0, Math.PI * 2),
    flash: 0,
    pulse: rng.range(0, Math.PI * 2),
  };
}

/**
 * Run the wave's spawn clock: while the wave still has motes to send, one
 * falls every spawnInterval seconds. Returns how many spawned this step.
 */
export function updateSpawner(state, dt) {
  if (state.toSpawn <= 0) return 0;
  state.spawnTimer -= dt;
  let spawned = 0;
  while (state.spawnTimer <= 0 && state.toSpawn > 0) {
    state.spawnTimer += spawnInterval(state.wave);
    state.toSpawn -= 1;
    state.motes.push(createMote(state.rng, state, pickType(state.rng, state.wave)));
    spawned += 1;
  }
  return spawned;
}

/** Advance every mote: falling, swaying, spinning, cooling its hit flash. */
export function updateMotes(state, dt) {
  for (const mote of state.motes) {
    mote.y += mote.vy * dt;
    mote.phase += mote.swayFreq * dt;
    mote.x = mote.baseX + Math.sin(mote.phase) * mote.swayAmp;
    mote.angle += mote.spin * dt;
    mote.pulse += dt * 3;
    if (mote.flash > 0) mote.flash -= dt;
  }
}

/** Paint every mote: a glowing ember body, brighter core, brute damage ring. */
export function drawMotes(ctx, state) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const mote of state.motes) {
    const flicker = 1 + Math.sin(mote.pulse) * 0.08;
    const r = mote.radius * flicker;
    const halo = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, r * 2.3);
    halo.addColorStop(0, mote.colour + 'aa');
    halo.addColorStop(0.4, mote.colour + '44');
    halo.addColorStop(1, mote.colour + '00');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, r * 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  for (const mote of state.motes) {
    ctx.save();
    ctx.translate(mote.x, mote.y);
    ctx.rotate(mote.angle);
    const body = ctx.createRadialGradient(-mote.radius * 0.3, -mote.radius * 0.3, 1, 0, 0, mote.radius);
    body.addColorStop(0, '#fff3d6');
    body.addColorStop(0.45, mote.colour);
    body.addColorStop(1, '#8a2b12');
    ctx.fillStyle = body;
    ctx.beginPath();
    // A lumpy ember silhouette: radius wobbles around the circle as it turns.
    const points = 9;
    for (let i = 0; i <= points; i += 1) {
      const a = (i / points) * Math.PI * 2;
      const rr = mote.radius * (1 + 0.13 * Math.sin(a * 3 + mote.pulse * 0.7));
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    if (mote.flash > 0) {
      ctx.globalAlpha = Math.min(1, mote.flash * 6);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // A brute shows its wounds: an arc that empties as its health goes.
    if (mote.maxHp > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 230, 190, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.radius + 6, -Math.PI / 2, -Math.PI / 2 + (mote.hp / mote.maxHp) * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
