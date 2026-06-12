import { startLoop, W, H, GROUND, time } from './core/loop.js';
import { fx, installFx } from './core/fx.js';

// ---------- Entity (entity-contract object) ----------
const box = {
  // position / physics
  x: W / 2,
  y: GROUND - 40,
  vx: 200,          // 200px/s left-right bounce
  vy: 0,
  w: 40,
  h: 40,
  // entity contract fields consumed by fx
  hp: 100,
  maxHp: 100,
  alive: true,
  facing: 1,
  kind: 'grunt',
  // fx-written fields (consumed in drawBox)
  flashT: 0,
  squashT: 0,
  staggerT: 0,
  selfFreeze: 0,
  airborne: false,
  dy: 0,
  armored: false,
};

installFx();

// ---------- Canvas click → fire fake onHit ----------
const canvas = document.getElementById('game');
canvas.addEventListener('click', () => {
  if (!box.alive) return;

  const dmg  = 12;
  const crit = Math.random() < 0.2;
  box.hp    -= dmg;
  const kill = box.hp <= 0;
  const dir  = 1;

  if (kill) {
    box.hp    = 0;
    box.alive = false;
    fx.fire('onKill', { target: box, dir });
  }
  fx.fire('onHit', { target: box, dmg, crit, kill, dir, melee: true });

  if (kill) {
    // Respawn after a short delay
    setTimeout(() => {
      box.alive   = true;
      box.hp      = box.maxHp;
      box.x       = W / 2;
      box.vx      = 200;
      box.vy      = 0;
      box.dy      = 0;
      box.flashT  = 0;
      box.squashT = 0;
      box.staggerT = 0;
      box.selfFreeze = 0;
    }, 1200);
  }
});

// ---------- Update ----------
function update(dt) {
  // Decay fx fields
  box.flashT     = Math.max(0, box.flashT  - dt);
  box.squashT    = Math.max(0, box.squashT - dt * 6);
  box.staggerT   = Math.max(0, box.staggerT - dt * 2.2);
  box.selfFreeze = Math.max(0, box.selfFreeze - 0.016);  // real-time decay like scene.js

  // Object-level hitstop: freeze entity physics, world keeps going
  if (box.selfFreeze > 0) {
    // entity frozen — skip physics but let fx modules update
    fx.fire('onUpdate', { dt });
    return;
  }

  // Physics: horizontal bounce
  if (box.alive) {
    box.x += box.vx * dt;
    if (box.x + box.w >= W) { box.x = W - box.w; box.vx = -Math.abs(box.vx); }
    if (box.x <= 0)          { box.x = 0;          box.vx =  Math.abs(box.vx); }
  }

  fx.fire('onUpdate', { dt });
}

// ---------- Draw ----------
function draw(ctx) {
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#06060f');
  grad.addColorStop(1, '#0d0d20');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Ground line
  ctx.strokeStyle = '#ffd34d44';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(W, GROUND);
  ctx.stroke();

  // Draw box with fx field consumption
  drawBox(ctx);

  // Overlay: click hint
  ctx.font      = '14px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'center';
  ctx.fillText('click to hit', W / 2, H - 18);

  // HP bar
  ctx.fillStyle = 'rgba(13,12,22,0.85)';
  ctx.fillRect(W / 2 - 40, GROUND - 110, 80, 8);
  const pct = Math.max(0, box.hp / box.maxHp);
  ctx.fillStyle = pct > 0.35 ? '#5dff8f' : '#ff5d5d';
  ctx.fillRect(W / 2 - 39, GROUND - 109, 78 * pct, 6);

  // fx onDraw (particles, numbers, vfx)
  fx.fire('onDraw', { ctx });
}

function drawBox(ctx) {
  const d = box;
  ctx.save();

  // selfFreeze jitter (±1.6px like scene.js drawDummy)
  const jx = d.selfFreeze > 0 ? (Math.random() * 2 - 1) * 1.6 : 0;
  const jy = d.selfFreeze > 0 ? (Math.random() * 2 - 1) * 1.2 : 0;

  ctx.translate(d.x + d.w / 2 + jx, d.y + d.h / 2 + jy);

  // squashT: horizontal stretch, vertical squish (Disney squash principle)
  if (d.squashT > 0 && d.alive) {
    const q = Math.sin(d.squashT * Math.PI) * 0.18;
    ctx.scale(1 + q, 1 - q);
  }

  // staggerT: tilt backward on hit
  if (d.alive && d.staggerT > 0) {
    ctx.rotate(d.staggerT * 0.14);
  }

  // flashT: white fill
  if (d.flashT > 0) {
    ctx.fillStyle = '#ffffff';
  } else if (!d.alive) {
    ctx.fillStyle = '#6e4a32';  // dead: dark
  } else {
    ctx.fillStyle = '#8f6ab8';  // grunt purple
  }

  ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
  ctx.restore();
}

startLoop({ update, draw });

// Debug handle
window.__game = { time, fx };
