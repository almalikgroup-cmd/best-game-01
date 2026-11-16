// Emberfall — boot, the game loop, and the state machine.
//
// The warden-orb holds the ember-line at the bottom of the field against
// waves of falling ember-motes. This module owns the game state and the
// fixed-step loop, reads intent (from the keyboard and mouse live, or from
// an autopilot when staging a screenshot scene), resolves every collision,
// and moves the game between its screens: title, play, paused, game over.
//
// ?seed=N fixes the fall pattern. ?shot=title|game|wave|over (with &seed=N)
// stages that scene by playing the real rules forward under an autopilot,
// paints it, and sets window.__shotReady — the screenshots in the entry are
// renders of these scenes, never drawings made elsewhere.

import { createRandom } from './random.js';
import { createInput, consumePress, consumeClick, endFrame } from './input.js';
import { createPlayer, resetPlayer, updatePlayer, updateBolts, drawPlayer } from './player.js';
import { createMote, updateSpawner, updateMotes, drawMotes, waveQuota } from './enemies.js';
import { createParticles, burst, ring, floater, updateParticles, drawParticles } from './particles.js';
import { createAudio } from './audio.js';
import {
  drawBackground, drawDamageFlash, drawHUD, drawBanner,
  drawTitleScreen, drawPauseScreen, drawGameOverScreen,
} from './ui.js';

const WIDTH = 960;
const HEIGHT = 640;
const LINE_Y = 592;
const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const MAX_LIVES = 3;
const BEST_KEY = 'emberfall-best';
/** Canvas backing store is 1.5x the world, so the page stays crisp. */
const SCALE = 1.5;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be unavailable; the best score then lasts the visit only.
  }
}

/** A fresh game state on the title screen. */
function createState(rng) {
  return {
    width: WIDTH,
    height: HEIGHT,
    lineY: LINE_Y,
    rng,
    screen: 'title',
    time: 0,
    score: 0,
    best: readBest(),
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    combo: 0,
    multiplier: 1,
    maxMultiplier: 1,
    kills: 0,
    wave: 0,
    toSpawn: 0,
    spawnTimer: 0,
    waveClear: false,
    betweenTimer: 0,
    decorTimer: 0,
    player: createPlayer(WIDTH, HEIGHT),
    bolts: [],
    motes: [],
    particles: createParticles(),
    shake: 0,
    flash: 0,
    banner: null,
    muted: false,
  };
}

/** Begin the named wave: fill its quota and raise its banner. */
function startWave(state) {
  state.wave += 1;
  state.toSpawn = waveQuota(state.wave);
  state.spawnTimer = 0.4;
  state.waveClear = false;
  state.banner = {
    text: `WAVE ${state.wave}`,
    sub: state.wave === 1 ? 'Hold the line' : ['', '', 'Weavers on the wind', 'Streakers dive', 'Brutes in the fall'][state.wave] ?? 'The fall thickens',
    timer: 2,
    duration: 2,
  };
  audio.waveStart();
}

/** Reset everything and stand the warden at her post. */
function startGame(state) {
  state.score = 0;
  state.lives = MAX_LIVES;
  state.combo = 0;
  state.multiplier = 1;
  state.maxMultiplier = 1;
  state.kills = 0;
  state.wave = 0;
  state.bolts = [];
  state.motes = [];
  state.particles = createParticles();
  state.shake = 0;
  state.flash = 0;
  resetPlayer(state.player, WIDTH, HEIGHT);
  state.screen = 'play';
  startWave(state);
  audio.startAmbient();
  announce(`Wave 1. Hold the ember-line.`);
}

function gameOver(state) {
  state.screen = 'over';
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }
  audio.gameOver();
  audio.stopAmbient();
  announce(`The line has fallen. Final score ${state.score}. Press R to stand again.`);
}

function announce(text) {
  if (status !== null) status.textContent = text;
}

/** A life is lost: combo broken, the screen shudders, the line flares. */
function loseLife(state, x, kind) {
  state.lives -= 1;
  state.combo = 0;
  state.multiplier = 1;
  state.flash = 1;
  state.shake = 11;
  if (kind === 'leak') {
    burst(state.particles, state.rng, x, state.lineY, '#ff5a3c', 18, 240);
    floater(state.particles, x, state.lineY - 22, 'BREACHED', '#ff8a70', 16);
    audio.leak();
  } else {
    ring(state.particles, state.player.x, state.player.y, '#ff8a70', 54);
    burst(state.particles, state.rng, state.player.x, state.player.y, '#ffd166', 16, 230);
    state.player.invulnerable = 1.6;
    audio.playerHit();
  }
  if (state.lives <= 0) gameOver(state);
}

/** One fixed step of play under the given intent. */
function stepPlay(state, intent, dt) {
  updatePlayer(state, intent, dt, () => audio.shoot());
  updateBolts(state, dt);
  updateSpawner(state, dt);
  updateMotes(state, dt);

  // Bolts against motes.
  const deadBolts = new Set();
  const deadMotes = new Set();
  for (let bi = 0; bi < state.bolts.length; bi += 1) {
    const bolt = state.bolts[bi];
    for (let mi = 0; mi < state.motes.length; mi += 1) {
      if (deadMotes.has(mi)) continue;
      const mote = state.motes[mi];
      const dx = bolt.x - mote.x;
      const dy = bolt.y - mote.y;
      const rr = bolt.radius + mote.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      deadBolts.add(bi);
      mote.hp -= 1;
      mote.flash = 0.12;
      if (mote.hp <= 0) {
        deadMotes.add(mi);
        state.combo += 1;
        state.multiplier = Math.min(5, 1 + Math.floor(state.combo / 10));
        state.maxMultiplier = Math.max(state.maxMultiplier, state.multiplier);
        const points = mote.score * state.multiplier;
        state.score += points;
        state.kills += 1;
        burst(state.particles, state.rng, mote.x, mote.y, mote.colour, mote.kind === 'brute' ? 26 : 13, mote.kind === 'brute' ? 260 : 200);
        floater(state.particles, mote.x, mote.y - mote.radius - 4, `+${points}`, '#ffd166', mote.kind === 'brute' ? 20 : 16);
        audio.pop(mote.kind === 'brute');
      } else {
        burst(state.particles, state.rng, bolt.x, bolt.y, mote.colour, 4, 130);
      }
      break;
    }
  }
  if (deadBolts.size > 0) state.bolts = state.bolts.filter((_, i) => !deadBolts.has(i));
  if (deadMotes.size > 0) state.motes = state.motes.filter((_, i) => !deadMotes.has(i));

  // Motes against the line, and against the warden herself.
  const survivors = [];
  for (const mote of state.motes) {
    if (state.screen !== 'play') {
      survivors.push(mote);
      continue;
    }
    if (mote.y - mote.radius > state.lineY) {
      loseLife(state, mote.x, 'leak');
      continue;
    }
    const player = state.player;
    const dx = mote.x - player.x;
    const dy = mote.y - player.y;
    const rr = mote.radius + player.radius - 2;
    if (player.invulnerable <= 0 && dx * dx + dy * dy < rr * rr) {
      burst(state.particles, state.rng, mote.x, mote.y, mote.colour, 14, 210);
      audio.pop(false);
      loseLife(state, mote.x, 'hit');
      continue;
    }
    survivors.push(mote);
  }
  state.motes = survivors;

  // The wave is held when nothing is left to fall and nothing is falling.
  if (state.screen === 'play' && state.toSpawn === 0 && state.motes.length === 0) {
    if (!state.waveClear) {
      state.waveClear = true;
      state.betweenTimer = 1.8;
      const bonus = 25 * state.wave;
      state.score += bonus;
      floater(state.particles, state.width / 2, state.height / 2 - 110, `WAVE HELD  +${bonus}`, '#ffd9a0', 22);
    } else {
      state.betweenTimer -= dt;
      if (state.betweenTimer <= 0) startWave(state);
    }
  }

  if (state.banner !== null && state.banner.timer > 0) state.banner.timer -= dt;
  state.shake = Math.max(0, state.shake - dt * 26);
  state.flash = Math.max(0, state.flash - dt * 1.8);
  updateParticles(state.particles, dt);
}

/** One fixed step on the title screen: decorative motes drift behind the words. */
function stepTitle(state, dt) {
  state.decorTimer -= dt;
  if (state.decorTimer <= 0 && state.motes.length < 7) {
    state.decorTimer = 0.7;
    const kinds = ['drifter', 'weaver', 'streaker', 'brute'];
    const kind = kinds[Math.floor(state.rng.next() * kinds.length)];
    const mote = createMote(state.rng, state, kind);
    mote.vy *= 0.55; // the title sky falls gently
    mote.swayAmp = Math.min(mote.swayAmp, 22);
    state.motes.push(mote);
  }
  updateMotes(state, dt);
  state.motes = state.motes.filter((m) => m.y - m.radius < state.lineY);
  updateParticles(state.particles, dt);
}

/** Paint the whole scene for the state's current screen. */
function draw(state) {
  const shakeX = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake : 0;
  const shakeY = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake : 0;
  ctx.setTransform(SCALE, 0, 0, SCALE, shakeX * SCALE, shakeY * SCALE);
  drawBackground(ctx, state);
  drawMotes(ctx, state);
  if (state.screen === 'play' || state.screen === 'paused') {
    drawPlayer(ctx, state);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawParticles(ctx, state.particles);
  ctx.restore();
  drawDamageFlash(ctx, state);
  if (state.screen === 'play' || state.screen === 'paused') {
    drawHUD(ctx, state);
    drawBanner(ctx, state);
  }
  if (state.screen === 'title') drawTitleScreen(ctx, state);
  if (state.screen === 'paused') drawPauseScreen(ctx, state);
  if (state.screen === 'over') drawGameOverScreen(ctx, state);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Build the per-step intent from the live input devices. */
function intentFromInput(input) {
  return {
    up: input.keys.has('KeyW') || input.keys.has('ArrowUp'),
    down: input.keys.has('KeyS') || input.keys.has('ArrowDown'),
    left: input.keys.has('KeyA') || input.keys.has('ArrowLeft'),
    right: input.keys.has('KeyD') || input.keys.has('ArrowRight'),
    firing: input.firing || input.keys.has('Space'),
    aimX: input.mouseX,
    aimY: input.mouseY,
  };
}

/** The live game: screens, the fixed-step loop, and the pause/mute keys. */
function runGame(state) {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    state.time += dt;

    if (consumePress(input, 'KeyM')) {
      state.muted = audio.toggleMute();
      if (!state.muted && state.screen === 'play') audio.startAmbient();
    }

    if (state.screen === 'title') {
      if (consumePress(input, 'Enter') || consumePress(input, 'Space') || consumeClick(input)) {
        audio.unlock();
        audio.uiClick();
        startGame(state);
      } else {
        let acc = dt;
        while (acc > 0) {
          const step = Math.min(STEP, acc);
          stepTitle(state, step);
          acc -= step;
        }
      }
    } else if (state.screen === 'play') {
      if (consumePress(input, 'KeyP') || consumePress(input, 'Escape')) {
        state.screen = 'paused';
        announce('Paused. Press P to resume.');
      } else {
        accumulator += dt;
        const intent = intentFromInput(input);
        while (accumulator >= STEP) {
          stepPlay(state, intent, STEP);
          accumulator -= STEP;
          if (state.screen !== 'play') {
            accumulator = 0;
            break;
          }
        }
      }
    } else if (state.screen === 'paused') {
      if (consumePress(input, 'KeyP') || consumePress(input, 'Escape') || consumePress(input, 'Enter')) {
        state.screen = 'play';
        announce('Resumed.');
      }
    } else if (state.screen === 'over') {
      updateParticles(state.particles, dt);
      if (consumePress(input, 'KeyR') || consumePress(input, 'Enter') || consumePress(input, 'Space') || consumeClick(input)) {
        audio.unlock();
        audio.uiClick();
        startGame(state);
      }
    }

    endFrame(input);
    draw(state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// --- Screenshot staging -------------------------------------------------
// The autopilot plays the real rules: it leads the lowest mote (the one
// nearest the line), flies to its column, and fires. The 'over' scene's
// warden plays weakly — late aim, bursty fire — and the fall takes the line.

/**
 * The autopilot's intent for one step. mode 'strong' leads its target
 * properly; mode 'weak' aims where the mote was a moment ago and fires in
 * bursts, so it scores but is overrun, as a hurried player is; mode
 * 'passive' never lifts a hand.
 */
function autopilotIntent(state, mode, stepIndex) {
  const player = state.player;
  const intent = {
    up: false, down: false, left: false, right: false,
    firing: false, aimX: player.x, aimY: 0,
  };
  if (mode === 'passive') return intent;
  let target = null;
  for (const mote of state.motes) {
    if (target === null || mote.y > target.y) target = mote;
  }
  if (target === null) {
    intent.aimX = state.width / 2;
    intent.aimY = 120;
    if (player.x < state.width / 2 - 14) intent.right = true;
    else if (player.x > state.width / 2 + 14) intent.left = true;
    return intent;
  }
  const dist = Math.hypot(target.x - player.x, target.y - player.y);
  const lead = dist / 760 - (mode === 'weak' ? 0.28 : 0);
  const swayVelocity = Math.cos(target.phase) * target.swayAmp * target.swayFreq;
  intent.aimX = target.x + swayVelocity * lead;
  intent.aimY = target.y + target.vy * lead;
  if (target.x < player.x - 10) intent.left = true;
  else if (target.x > player.x + 10) intent.right = true;
  if (player.y < state.height - 200) intent.down = true;
  else if (player.y > state.height - 110) intent.up = true;
  intent.firing = mode === 'strong' || stepIndex % 3 !== 0;
  return intent;
}

/** A drawable copy of the state (the rng is shared, everything else deep). */
function snapshotState(state) {
  const { rng, ...rest } = state;
  const copy = JSON.parse(JSON.stringify(rest));
  copy.rng = rng;
  return copy;
}

function stageScene(name, seed) {
  let state = createState(createRandom(seed));
  if (name === 'game' || name === 'wave' || name === 'over') {
    state.screen = 'play';
    state.wave = 0;
    startWave(state);
    const maxSteps = 60 * 300;
    let bestFrame = null;
    let bestScore = -1;
    for (let i = 0; i < maxSteps; i += 1) {
      // The 'over' warden plays weakly, then gives up entirely if the fall
      // has not taken the line by then; her score and kills stay earned.
      const mode = name === 'over' ? (i < 60 * 150 ? 'weak' : 'passive') : 'strong';
      stepPlay(state, autopilotIntent(state, mode, i), STEP);
      state.time += STEP;
      if (name === 'game' && i >= 60 * 12 && state.screen === 'play') {
        // Not a fixed moment: keep the busiest honest frame of the run — a
        // full sky, bolts in flight, sparks still falling, no banner up.
        if (state.banner === null || state.banner.timer <= 0) {
          const density = state.motes.length * 2 + state.bolts.length + state.particles.sparks.length * 0.5;
          if (density > bestScore) {
            bestScore = density;
            bestFrame = snapshotState(state);
          }
          if (state.motes.length >= 8 && state.bolts.length >= 4 && state.particles.sparks.length >= 10) break;
        }
        if (i >= 60 * 80) break;
      }
      if (name === 'game' && state.screen !== 'play') break;
      if (name === 'wave' && state.wave >= 3 && state.banner !== null && state.banner.timer < 1.35) break;
      if (name === 'over' && state.screen === 'over') break;
    }
    if (name === 'game' && bestFrame !== null) state = bestFrame;
    if (name === 'wave' && state.screen === 'over') {
      // The pilot was overrun before wave 3 in this seed; the scene is still
      // a true frame of play, but prefer a living one: restage as 'game'.
      return stageScene('game', seed);
    }
  } else {
    // Title: let a few motes drift in behind the words.
    for (let i = 0; i < 60 * 3; i += 1) {
      stepTitle(state, STEP);
      state.time += STEP;
    }
  }
  return state;
}

function runShot(name, seed) {
  const state = stageScene(name, seed);
  let painted = 0;
  function paint() {
    draw(state);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// --- Boot ---------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const shot = params.get('shot');
if (shot !== null) {
  const seed = Number.isInteger(seedParam) ? seedParam : 1;
  runShot(shot, seed);
} else {
  const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
  const state = createState(createRandom(seed));
  announce('Emberfall. Press Enter or click to begin.');
  runGame(state);
}
