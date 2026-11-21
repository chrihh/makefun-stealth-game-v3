// Verdant Vault — canvas renderer. Draws the glasshouse from above:
// soil, gravel and moss underfoot, hedges and glass panes as cover,
// vision cones ray-cut by the hedges, drifting mist, blinking
// tripwires, and a HUD the judge can read at a glance.

import { TILE, VIEW_W, VIEW_H, GUARD_RANGE, DRONE_RANGE, CONE_HALF } from './config.js';
import { tileAt, hasLineOfSight, mistAt, laserOn } from './world.js';

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function conePolygon(world, watcher, range) {
  const pts = [[watcher.x * TILE, watcher.y * TILE]];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const ang = watcher.face - CONE_HALF + (i / steps) * CONE_HALF * 2;
    let d = range;
    for (let s = 0.2; s < range; s += 0.18) {
      const x = watcher.x + Math.cos(ang) * s, y = watcher.y + Math.sin(ang) * s;
      if (tileAt(world.level, Math.floor(x), Math.floor(y)) === '#') { d = s; break; }
    }
    pts.push([(watcher.x + Math.cos(ang) * d) * TILE, (watcher.y + Math.sin(ang) * d) * TILE]);
  }
  return pts;
}

function drawCone(ctx, world, watcher, range, color) {
  const pts = conePolygon(world, watcher, range);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTiles(ctx, world) {
  for (let y = 0; y < world.level.grid.length; y++) {
    for (let x = 0; x < world.level.grid[y].length; x++) {
      const ch = world.level.grid[y][x];
      const px = x * TILE, py = y * TILE, r = hash(x, y);
      if (ch === '#') {
        ctx.fillStyle = '#1d4423';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#2c6134';
        ctx.beginPath();
        ctx.arc(px + 10 + r * 18, py + 11 + r * 12, 8 + r * 5, 0, 7);
        ctx.arc(px + 26 - r * 10, py + 27 - r * 9, 7 + r * 4, 0, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(120,200,120,0.25)';
        ctx.fillRect(px, py, TILE, 3);
      } else if (ch === '%') {
        ctx.fillStyle = '#9fc8cf';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.moveTo(px + 6, py + TILE); ctx.lineTo(px + TILE * 0.55, py); ctx.lineTo(px + TILE * 0.8, py); ctx.lineTo(px + 20, py + TILE);
        ctx.fill();
        ctx.strokeStyle = '#5d8a91';
        ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      } else {
        ctx.fillStyle = ch === 'm' ? '#274d2c' : ch === ',' ? '#8a7648' : (x + y) % 2 ? '#3d5c33' : '#425f36';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = ch === ',' ? 'rgba(230,210,150,0.5)' : 'rgba(0,0,0,0.12)';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(px + 6 + hash(x * 3 + i, y) * 28, py + 6 + hash(x, y * 3 + i) * 28, ch === ',' ? 2.2 : 1.4, 0, 7);
          ctx.fill();
        }
        if (ch === 'm') {
          ctx.fillStyle = 'rgba(140,230,150,0.18)';
          ctx.fillRect(px + 4, py + TILE - 7, TILE - 8, 3);
        }
      }
    }
  }
}

function drawVent(ctx, x, y) {
  ctx.fillStyle = '#57606a';
  ctx.fillRect(x * TILE + 5, y * TILE + 5, TILE - 10, TILE - 10);
  ctx.fillStyle = '#2e343b';
  for (let i = 0; i < 3; i++) ctx.fillRect(x * TILE + 9, y * TILE + 10 + i * 8, TILE - 18, 3);
}

function drawLaser(ctx, world, l) {
  const ax = (l.a[0] + 0.5) * TILE, ay = (l.a[1] + 0.5) * TILE;
  const bx = (l.b[0] + 0.5) * TILE, by = (l.b[1] + 0.5) * TILE;
  ctx.fillStyle = '#3a3f45';
  ctx.beginPath(); ctx.arc(ax, ay, 6, 0, 7); ctx.arc(bx, by, 6, 0, 7); ctx.fill();
  const on = laserOn(l, world.time);
  ctx.strokeStyle = on ? 'rgba(255,60,70,0.95)' : 'rgba(255,60,70,0.18)';
  ctx.lineWidth = on ? 3 : 1.5;
  ctx.setLineDash(on ? [] : [5, 6]);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

function drawFigure(ctx, x, y, face, body, trim) {
  const px = x * TILE, py = y * TILE;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(px, py + 9, 11, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(px, py, 11, 0, 7); ctx.fill();
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.arc(px + Math.cos(face) * 5, py + Math.sin(face) * 5, 6, 0, 7);
  ctx.fill();
}

export function drawWorld(ctx, world, ui) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawTiles(ctx, world);
  for (const [a, b] of world.vents) { drawVent(ctx, a[0], a[1]); drawVent(ctx, b[0], b[1]); }

  // exit door and key
  const ex = world.exit.x * TILE, ey = world.exit.y * TILE;
  ctx.fillStyle = world.key.taken ? '#57d977' : '#7a4a3a';
  ctx.fillRect(ex - 15, ey - 17, 30, 34);
  ctx.fillStyle = '#17301c';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', ex, ey + 3);
  if (!world.key.taken) {
    const kx = world.key.x * TILE, ky = world.key.y * TILE;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(kx, ky, 8 + Math.sin(world.time * 4) * 1.5, 0, 7); ctx.fill();
    ctx.fillRect(kx + 5, ky - 2, 11, 4);
    ctx.fillStyle = '#8a6d1f';
    ctx.font = 'bold 8px system-ui';
    ctx.fillText('KEY', kx, ky - 13);
  }
  for (const petal of world.petals) {
    if (petal.taken) continue;
    const px = petal.x * TILE, py = petal.y * TILE;
    ctx.fillStyle = '#e8b4e8';
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + world.time * 0.8;
      ctx.beginPath(); ctx.arc(px + Math.cos(a) * 6, py + Math.sin(a) * 6, 4, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath(); ctx.arc(px, py, 3.4, 0, 7); ctx.fill();
  }
  if (world.pod) {
    ctx.fillStyle = '#c98f4e';
    ctx.beginPath(); ctx.arc(world.pod.x * TILE, world.pod.y * TILE, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,120,0.6)';
    ctx.beginPath(); ctx.arc(world.pod.x * TILE, world.pod.y * TILE, 10 + Math.sin(world.time * 9) * 3, 0, 7); ctx.stroke();
  }
  for (const l of world.lasers) drawLaser(ctx, world, l);

  // vision cones under the figures
  const alert = world.detection > 0.66;
  for (const g of world.guards) {
    const col = g.state === 'chase' ? 'rgba(255,70,60,0.4)' : g.state === 'patrol' ? 'rgba(255,214,90,0.3)' : 'rgba(255,150,60,0.36)';
    drawCone(ctx, world, g, GUARD_RANGE, col);
  }
  for (const d of world.drones) drawCone(ctx, world, d, DRONE_RANGE, 'rgba(190,140,255,0.28)');

  // mist banks roll over everything low
  for (const m of world.mists) {
    const cx = (m.x + Math.sin(world.time * m.speed) * m.drift) * TILE;
    const grad = ctx.createLinearGradient(cx, 0, cx + m.w * TILE, 0);
    grad.addColorStop(0, 'rgba(235,245,240,0)');
    grad.addColorStop(0.5, 'rgba(235,245,240,0.5)');
    grad.addColorStop(1, 'rgba(235,245,240,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx, m.y * TILE, m.w * TILE, m.h * TILE);
  }

  // drones, wardens, intruder
  for (const d of world.drones) {
    const px = d.x * TILE, py = d.y * TILE;
    ctx.fillStyle = '#4b3a63';
    ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#c9a8ff';
    ctx.beginPath(); ctx.arc(px, py, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(220,200,255,0.7)';
    ctx.beginPath(); ctx.moveTo(px - 13, py - 13); ctx.lineTo(px + 13, py + 13); ctx.moveTo(px + 13, py - 13); ctx.lineTo(px - 13, py + 13); ctx.stroke();
  }
  for (const g of world.guards) {
    drawFigure(ctx, g.x, g.y, g.face, '#b8452e', '#f2d8a0');
    if (g.state !== 'patrol') {
      ctx.fillStyle = g.state === 'chase' ? '#ff5040' : '#ffb340';
      ctx.font = 'bold 15px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(g.state === 'chase' ? '!' : '?', g.x * TILE, g.y * TILE - 16);
    }
  }
  const p = world.player;
  drawFigure(ctx, p.x, p.y, p.face, '#2e7fb8', '#dff2ff');
  if (mistAt(world, p.x, p.y)) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('IN MIST', p.x * TILE, p.y * TILE - 17);
  }

  drawHud(ctx, world, ui);
  if (world.alarmFlash > 0) {
    ctx.fillStyle = `rgba(255,40,40,${world.alarmFlash * 0.16})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawHud(ctx, world, ui) {
  ctx.fillStyle = 'rgba(10,22,13,0.88)';
  ctx.fillRect(0, 0, VIEW_W, 34);
  ctx.fillStyle = '#e9f5e4';
  ctx.font = 'bold 15px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(`VERDANT VAULT — ${world.level.name}`, 12, 22);
  ctx.font = '12px system-ui';
  ctx.fillStyle = '#b9d9ae';
  ctx.fillText(world.level.sub, 330, 22);
  // detection meter
  ctx.fillStyle = '#40282a';
  ctx.fillRect(742, 9, 170, 16);
  ctx.fillStyle = world.detection > 0.66 ? '#ff5040' : world.detection > 0.32 ? '#ffb340' : '#ffd94d';
  ctx.fillRect(742, 9, 170 * world.detection, 16);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px system-ui';
  ctx.fillText('SEEN', 750, 21);
  ctx.font = 'bold 12px system-ui';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(`${world.key.taken ? 'KEY ✓' : 'KEY ✗'}  Pods ${world.pods}  ${'♥'.repeat(Math.max(0, world.covers))}`, 928, 22);
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e9f5e4';
  ctx.fillText(`Score ${world.score}`, 1272, 22);
  ctx.textAlign = 'left';
  if (ui && ui.banner) {
    ctx.fillStyle = 'rgba(8,18,10,0.82)';
    ctx.fillRect(0, VIEW_H / 2 - 78, VIEW_W, 156);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4ffef';
    ctx.font = 'bold 40px system-ui';
    ctx.fillText(ui.banner.title, VIEW_W / 2, VIEW_H / 2 - 14);
    ctx.font = '16px system-ui';
    ctx.fillStyle = '#cfe8c4';
    for (let i = 0; i < ui.banner.lines.length; i++) ctx.fillText(ui.banner.lines[i], VIEW_W / 2, VIEW_H / 2 + 22 + i * 24);
  }
}
