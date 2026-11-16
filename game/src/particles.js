// Particles and floating score text: the game's juice. Bursts of sparks when a
// mote pops, a red spray when one crosses the line, a shockwave ring when the
// warden is hurt, and small "+20" labels that rise and fade where a mote died.
// Everything is drawn additively so embers glow against the indigo field.

/** Create the empty particle store the game state carries. */
export function createParticles() {
  return { sparks: [], rings: [], floaters: [] };
}

/** A burst of sparks flying out of (x, y) in the given colour. */
export function burst(particles, rng, x, y, colour, count = 12, speed = 190) {
  for (let i = 0; i < count; i += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const v = rng.range(speed * 0.25, speed);
    particles.sparks.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - 40,
      life: rng.range(0.3, 0.7),
      age: 0,
      size: rng.range(1.5, 3.5),
      colour,
    });
  }
}

/** An expanding ring, for impacts that should read at a glance. */
export function ring(particles, x, y, colour, maxRadius = 46) {
  particles.rings.push({ x, y, colour, maxRadius, age: 0, life: 0.35 });
}

/** A floating label that rises and fades (score popups, warnings). */
export function floater(particles, x, y, text, colour = '#ffd166', size = 17) {
  particles.floaters.push({ x, y, text, colour, size, age: 0, life: 0.9 });
}

/** Advance every particle by dt seconds; dead ones are dropped. */
export function updateParticles(particles, dt) {
  for (const s of particles.sparks) {
    s.age += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 320 * dt; // ember gravity
    s.vx *= 1 - 1.6 * dt;
  }
  particles.sparks = particles.sparks.filter((s) => s.age < s.life);
  for (const r of particles.rings) r.age += dt;
  particles.rings = particles.rings.filter((r) => r.age < r.life);
  for (const f of particles.floaters) {
    f.age += dt;
    f.y -= 42 * dt;
  }
  particles.floaters = particles.floaters.filter((f) => f.age < f.life);
}

/** Paint sparks, rings and floaters. Call inside a 'lighter' composite block. */
export function drawParticles(ctx, particles) {
  for (const s of particles.sparks) {
    const t = 1 - s.age / s.life;
    ctx.globalAlpha = t;
    ctx.fillStyle = s.colour;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * t + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const r of particles.rings) {
    const t = r.age / r.life;
    ctx.globalAlpha = (1 - t) * 0.8;
    ctx.strokeStyle = r.colour;
    ctx.lineWidth = 3 * (1 - t) + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.maxRadius * t + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of particles.floaters) {
    const t = 1 - f.age / f.life;
    ctx.globalAlpha = Math.min(1, t * 1.6);
    ctx.font = `700 ${f.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = f.colour;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
