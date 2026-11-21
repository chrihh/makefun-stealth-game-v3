// Verdant Vault — browser entry: wires input, sound and the sim
// together, runs the level flow (intro, play, caught, clear, victory)
// and serves the deterministic ?shot= scenes used for screenshots.

import { createWorld, stepWorld, retryLevel, EVENT_CAUGHT, EVENT_LEVEL_CLEAR, EVENT_GAME_CLEAR, EVENT_POD, EVENT_LASER, EVENT_PICKUP } from './world.js';
import { drawWorld } from './render.js';
import { createInput } from './input.js';
import { sfx, toggleMute } from './audio.js';
import { applyShot } from './shots.js';
import { LEVELS } from './levels.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

if (shotName) {
  const { world, banner } = applyShot(shotName);
  drawWorld(ctx, world, { banner });
} else {
  const input = createInput(canvas);
  let world = createWorld(0);
  let mode = 'intro';
  let modeTime = 0;
  let paused = false;
  let stepAcc = 0;
  let last = performance.now();
  let stepSoundAt = 0;

  function bannerFor() {
    if (mode === 'intro') return { title: world.level.name.toUpperCase(), lines: [`Floor ${world.levelIndex + 1} of ${LEVELS.length} — ${world.level.sub}`, 'Steal the glass key, then slip out of the EXIT unseen. Press any key.'] };
    if (mode === 'caught') return { title: 'SPOTTED!', lines: [`The wardens caught you. Covers left: ${Math.max(0, world.covers)}`, world.covers > 0 ? 'Press any key to try the floor again.' : 'Press R for a fresh run.'] };
    if (mode === 'victory') return { title: 'THE VAULT IS EMPTY', lines: [`Final score ${world.score} — the moon orchid is yours and nobody saw a thing.`, 'Press R to play again.'] };
    if (paused) return { title: 'PAUSED', lines: ['Press P to resume.'] };
    return null;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const inp = input.poll();
    if (inp.mutePressed) toggleMute();
    if (inp.pausePressed && mode === 'play') paused = !paused;

    if (mode === 'intro' && inp.anyPressed) { mode = 'play'; modeTime = 0; }
    else if (mode === 'caught' && inp.anyPressed && modeTime > 0.4) {
      if (world.covers > 0) { world = retryLevel(world); mode = 'intro'; }
      modeTime = 0;
    } else if (mode === 'victory' && inp.restart) {
      world = createWorld(0); mode = 'intro'; modeTime = 0;
    } else if (mode === 'play' && !paused) {
      if (inp.restart) { world = retryLevel(world); mode = 'intro'; modeTime = 0; }
      stepAcc += dt;
      const step = 1 / 60;
      while (stepAcc >= step) {
        stepAcc -= step;
        const ev = stepWorld(world, inp, step);
        inp.throwAt = null; // a click throws once, not per sub-step
        if (ev & EVENT_POD) sfx.pod();
        if (ev & EVENT_LASER) { sfx.laser(); sfx.alarm(); }
        if (ev & EVENT_PICKUP) sfx.pickup();
        if (world.player.moving && world.time - stepSoundAt > 0.34) {
          stepSoundAt = world.time;
          const ch = world.level.grid[Math.floor(world.player.y)][Math.floor(world.player.x)];
          if (ch === ',') sfx.stepGravel(); else sfx.stepSoft();
        }
        if (ev & EVENT_CAUGHT) {
          sfx.caught();
          mode = world.covers > 0 ? 'caught' : 'caught';
          if (world.covers <= 0) mode = 'caught';
          modeTime = 0;
          break;
        }
        if (ev & (EVENT_LEVEL_CLEAR | EVENT_GAME_CLEAR)) {
          sfx.clear();
          if (ev & EVENT_GAME_CLEAR) { mode = 'victory'; }
          else world = createWorld(world.levelIndex + 1, { covers: world.covers, score: world.score });
          if (mode !== 'victory') mode = 'intro';
          modeTime = 0;
          break;
        }
      }
    }
    modeTime += dt;
    drawWorld(ctx, world, { banner: bannerFor() });
    input.consume();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
