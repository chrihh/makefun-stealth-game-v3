// Verdant Vault — the simulation. Pure and DOM-free so it can be
// play-tested headlessly: guards patrol, prowl, chase and follow a
// popped seed pod; drones sweep their lanes; vision cones are cut by
// hedges (never by glass); mist, moss, gravel and sneaking all bend
// how visible and how audible the intruder is.

import { LEVELS } from './levels.js';
import {
  PLAYER_SPEED, PLAYER_SNEAK_SPEED, PLAYER_RADIUS,
  GUARD_PATROL_SPEED, GUARD_PROWL_SPEED, GUARD_CHASE_SPEED, DRONE_SPEED,
  GUARD_RANGE, DRONE_RANGE, CONE_HALF,
  DETECT_FILL, DETECT_DRAIN, LASER_SPIKE, START_COVERS, PODS_PER_LEVEL,
  NOISE_WALK, NOISE_GRAVEL, NOISE_SNEAK, NOISE_SNEAK_GRAVEL, POD_HEARING,
  SCORE_KEY, SCORE_PETAL, SCORE_CLEAR, SCORE_GHOST, SCORE_POD_LEFT,
} from './config.js';

export const EVENT_CAUGHT = 1;
export const EVENT_LEVEL_CLEAR = 2;
export const EVENT_GAME_CLEAR = 4;
export const EVENT_POD = 8;
export const EVENT_LASER = 16;
export const EVENT_PICKUP = 32;

export function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || ty >= level.grid.length || tx >= level.grid[0].length) return '#';
  return level.grid[ty][tx];
}
export function blocksMove(ch) { return ch === '#' || ch === '%'; }
export function blocksSight(ch) { return ch === '#'; }

function findChar(level, ch) {
  for (let y = 0; y < level.grid.length; y++) {
    const x = level.grid[y].indexOf(ch);
    if (x >= 0) return { x: x + 0.5, y: y + 0.5 };
  }
  return { x: 1.5, y: 1.5 };
}

export function createWorld(levelIndex, carry = {}) {
  const level = LEVELS[levelIndex];
  const start = findChar(level, 'P');
  const petals = [];
  level.grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'o') petals.push({ x: x + 0.5, y: y + 0.5, taken: false });
  });
  return {
    levelIndex,
    level,
    time: 0,
    player: { x: start.x, y: start.y, face: 0, moving: false, sneaking: false },
    guards: level.guards.map((g) => ({
      x: g.path[0][0] + 0.5, y: g.path[0][1] + 0.5, face: 0,
      path: g.path, wp: 1, speedMul: g.speed,
      state: 'patrol', target: null, stateTime: 0, wait: 0,
    })),
    drones: level.drones.map((d) => ({
      x: d.a[0] + 0.5, y: d.a[1] + 0.5, face: 0,
      a: d.a, b: d.b, t: 0, dir: 1,
    })),
    lasers: level.lasers.map((l) => ({ ...l, cool: 0 })),
    mists: level.mists.map((m) => ({ ...m })),
    vents: level.vents,
    ventCool: 0,
    key: { ...findChar(level, 'K'), taken: false },
    exit: findChar(level, 'X'),
    petals,
    detection: 0,
    seenEver: false,
    pods: PODS_PER_LEVEL,
    pod: null,
    covers: carry.covers ?? START_COVERS,
    score: carry.score ?? 0,
    levelTime: 0,
    lastSeen: null,
    alarmFlash: 0,
    heard: null,
  };
}

export function retryLevel(world) {
  return createWorld(world.levelIndex, { covers: world.covers, score: world.score });
}

function moveWithCollision(level, e, dx, dy, radius) {
  // Axis-separated slide along hedges and glass panes.
  const tryAxis = (nx, ny) => {
    const pts = [[nx - radius, ny - radius], [nx + radius, ny - radius], [nx - radius, ny + radius], [nx + radius, ny + radius]];
    return !pts.some(([px, py]) => blocksMove(tileAt(level, Math.floor(px), Math.floor(py))));
  };
  if (tryAxis(e.x + dx, e.y)) e.x += dx;
  if (tryAxis(e.x, e.y + dy)) e.y += dy;
}

export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 0.12));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksSight(tileAt(level, Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t)))) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function mistAt(world, x, y) {
  return world.mists.some((m) => {
    const cx = m.x + m.w / 2 + Math.sin(world.time * m.speed) * m.drift;
    return x >= cx - m.w / 2 && x <= cx + m.w / 2 && y >= m.y && y <= m.y + m.h;
  });
}

// How visible the player is to one watcher right now: 0 unseen, else a
// fill rate per second (closer and plainer = faster).
export function visibility(world, watcher, range) {
  const p = world.player;
  const dx = p.x - watcher.x, dy = p.y - watcher.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), watcher.face)) > CONE_HALF && dist > 0.9) return 0;
  if (!hasLineOfSight(world.level, watcher.x, watcher.y, p.x, p.y)) return 0;
  let rate = (1.25 - dist / (range * 1.6)) / DETECT_FILL;
  if (p.sneaking) rate *= 0.55;
  if (mistAt(world, p.x, p.y)) rate *= 0.3;
  if (tileAt(world.level, Math.floor(p.x), Math.floor(p.y)) === 'm') rate *= 0.8;
  return Math.max(0.12, rate);
}

export function laserOn(laser, time) {
  const cyc = ((time + laser.phase) % laser.period) / laser.period;
  return cyc < 0.62;
}

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

function steerGuard(world, g, dt) {
  let speed = GUARD_PATROL_SPEED * g.speedMul;
  let dest = null;
  if (g.state === 'chase' && world.lastSeen) { dest = world.lastSeen; speed = GUARD_CHASE_SPEED; }
  else if ((g.state === 'prowl' || g.state === 'distracted') && g.target) { dest = g.target; speed = GUARD_PROWL_SPEED; }
  else {
    const [wx, wy] = g.path[g.wp];
    dest = { x: wx + 0.5, y: wy + 0.5 };
    if (Math.hypot(dest.x - g.x, dest.y - g.y) < 0.15) {
      g.wp = (g.wp + 1) % g.path.length;
      g.wait = 0.7; // pause and scan at each waypoint
      return;
    }
  }
  if (g.wait > 0) { g.wait -= dt; g.face += Math.sin(world.time * 1.7 + g.wp) * 0.9 * dt; return; }
  const dx = dest.x - g.x, dy = dest.y - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.12) {
    if (g.state === 'prowl' || g.state === 'distracted') { g.state = 'patrol'; g.target = null; }
    return;
  }
  const want = Math.atan2(dy, dx);
  g.face += Math.max(-3.2 * dt, Math.min(3.2 * dt, angleDiff(want, g.face)));
  // Move straight at the destination (the axis-separated slide finds
  // its way along walls); facing turns to match over a few frames.
  const step = Math.min(dist, speed * dt);
  moveWithCollision(world.level, g, (dx / dist) * step, (dy / dist) * step, 0.26);
}

export function stepWorld(world, input, dt) {
  let events = 0;
  world.time += dt;
  world.levelTime += dt;
  const p = world.player;
  p.sneaking = !!input.sneak;

  // --- player movement
  let mx = input.dx || 0, my = input.dy || 0;
  const ml = Math.hypot(mx, my);
  p.moving = ml > 0;
  if (ml > 0) {
    mx /= ml; my /= ml;
    p.face = Math.atan2(my, mx);
    const sp = p.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_SPEED;
    moveWithCollision(world.level, p, mx * sp * dt, my * sp * dt, PLAYER_RADIUS);
  }

  // --- seed pod distraction
  if (input.throwAt && world.pods > 0 && !world.pod) {
    world.pods--;
    world.pod = { x: input.throwAt.x, y: input.throwAt.y, ttl: 4.5 };
    events |= EVENT_POD;
    for (const g of world.guards) {
      if (Math.hypot(g.x - world.pod.x, g.y - world.pod.y) < POD_HEARING && g.state !== 'chase') {
        g.state = 'distracted'; g.target = { ...world.pod };
      }
    }
  }
  if (world.pod) { world.pod.ttl -= dt; if (world.pod.ttl <= 0) world.pod = null; }

  // --- vents: step on a grate, surface at its pair
  world.ventCool -= dt;
  if (world.ventCool <= 0) {
    for (const [a, b] of world.vents) {
      for (const [from, to] of [[a, b], [b, a]]) {
        if (Math.floor(p.x) === from[0] && Math.floor(p.y) === from[1]) {
          p.x = to[0] + 0.5; p.y = to[1] + 0.5; world.ventCool = 1.4;
          events |= EVENT_PICKUP;
        }
      }
    }
  }

  // --- noise: gravel crunches, moss muffles
  world.heard = null;
  if (p.moving) {
    const tile = tileAt(world.level, Math.floor(p.x), Math.floor(p.y));
    let radius = p.sneaking ? NOISE_SNEAK : NOISE_WALK;
    if (tile === ',') radius = p.sneaking ? NOISE_SNEAK_GRAVEL : NOISE_GRAVEL;
    if (tile === 'm') radius *= 0.45;
    for (const g of world.guards) {
      if (Math.hypot(g.x - p.x, g.y - p.y) < radius && g.state === 'patrol') {
        g.state = 'prowl'; g.target = { x: p.x, y: p.y };
        world.heard = { x: p.x, y: p.y };
      }
    }
  }

  // --- drones ping-pong along their lane
  for (const d of world.drones) {
    d.t += d.dir * DRONE_SPEED * dt / Math.max(0.001, Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]));
    if (d.t > 1) { d.t = 1; d.dir = -1; }
    if (d.t < 0) { d.t = 0; d.dir = 1; }
    const nx = d.a[0] + 0.5 + (d.b[0] - d.a[0]) * d.t;
    const ny = d.a[1] + 0.5 + (d.b[1] - d.a[1]) * d.t;
    if (Math.hypot(nx - d.x, ny - d.y) > 0.001) d.face = Math.atan2(ny - d.y, nx - d.x);
    d.x = nx; d.y = ny;
  }

  // --- vision and the detection meter
  let vis = 0;
  for (const g of world.guards) vis = Math.max(vis, visibility(world, g, GUARD_RANGE));
  for (const d of world.drones) vis = Math.max(vis, visibility(world, d, DRONE_RANGE) * 0.85);
  if (vis > 0) {
    world.detection = Math.min(1, world.detection + vis * dt);
    world.seenEver = true;
    world.lastSeen = { x: p.x, y: p.y };
  } else {
    world.detection = Math.max(0, world.detection - DETECT_DRAIN * dt);
  }
  const mood = world.detection >= 1 ? 'chase' : world.detection > 0.32 ? 'prowl' : 'patrol';
  for (const g of world.guards) {
    if (g.state !== 'distracted') {
      if (mood === 'chase') g.state = 'chase';
      else if (mood === 'prowl' && g.state === 'patrol') { g.state = 'prowl'; g.target = world.lastSeen; }
      else if (mood === 'patrol' && g.state !== 'patrol') { g.state = 'patrol'; g.target = null; }
    } else if (mood === 'chase') g.state = 'chase';
  }
  for (const g of world.guards) {
    // A warden who cannot reach a noise or a pod in 7 seconds gives
    // up and resumes its patrol rather than staring at a wall.
    if (g.state === 'prowl' || g.state === 'distracted') {
      g.stateTime += dt;
      if (g.stateTime > 7) { g.state = 'patrol'; g.target = null; g.stateTime = 0; }
    } else g.stateTime = 0;
    steerGuard(world, g, dt);
  }

  // --- tripwire lasers
  world.alarmFlash = Math.max(0, world.alarmFlash - dt);
  for (const l of world.lasers) {
    l.cool -= dt;
    if (laserOn(l, world.time) && l.cool <= 0 &&
        segDist(p.x, p.y, l.a[0] + 0.5, l.a[1] + 0.5, l.b[0] + 0.5, l.b[1] + 0.5) < 0.34) {
      world.detection = Math.min(1, world.detection + LASER_SPIKE);
      world.seenEver = true;
      world.alarmFlash = 0.8;
      world.lastSeen = { x: p.x, y: p.y };
      l.cool = 1.6;
      events |= EVENT_LASER;
    }
  }

  // --- pickups and the exit
  if (!world.key.taken && Math.hypot(p.x - world.key.x, p.y - world.key.y) < 0.55) {
    world.key.taken = true; world.score += SCORE_KEY; events |= EVENT_PICKUP;
  }
  for (const petal of world.petals) {
    if (!petal.taken && Math.hypot(p.x - petal.x, p.y - petal.y) < 0.55) {
      petal.taken = true; world.score += SCORE_PETAL; events |= EVENT_PICKUP;
    }
  }
  if (world.key.taken && Math.hypot(p.x - world.exit.x, p.y - world.exit.y) < 0.55) {
    world.score += SCORE_CLEAR + world.pods * SCORE_POD_LEFT;
    if (!world.seenEver) world.score += SCORE_GHOST;
    world.score += Math.max(0, 240 - Math.floor(world.levelTime) * 2);
    events |= world.levelIndex + 1 >= LEVELS.length ? EVENT_GAME_CLEAR : EVENT_LEVEL_CLEAR;
    return events;
  }

  // --- caught: an alert warden who reaches you, or a true body-check.
  // Brushing past a calm patrol costs detection, not a cover — the
  // meter is the recovery chance the design promises.
  for (const g of world.guards) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < 0.3 || (d < 0.48 && (g.state === 'chase' || world.detection > 0.5))) {
      world.covers--;
      events |= EVENT_CAUGHT;
      return events;
    }
    if (d < 0.7 && g.state === 'patrol') {
      world.detection = Math.min(1, world.detection + 0.25 * dt);
      world.seenEver = true;
      world.lastSeen = { x: p.x, y: p.y };
    }
  }
  return events;
}
