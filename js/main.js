// js/main.js — Task 5 harness: player + 3 enemy types + token AI
// Replaces the hand-rolled dummy with createEnemyManager().

import { startLoop, W, H, GROUND, time } from './core/loop.js';
import { fx, installFx } from './core/fx.js';
import { sprites } from './core/sprites.js';
import { createPlayer } from './game/player.js';
import { createEnemyManager } from './game/enemies.js';

installFx();

const player = createPlayer();
const manager = createEnemyManager();

// Spawn one of each kind at staggered positions
manager.spawn('grunt',  560);
manager.spawn('ranger', 700);
manager.spawn('heavy',  640);

// Respawn timer (test convenience: respawn all when all dead after 1.5s)
let respawnTimer = -1;

// ---------- Keyboard → player.input ----------
const keys = {};
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function readKeyboard() {
  const i = player.input;
  i.left   = !!(keys['KeyA'] || keys['ArrowLeft']);
  i.right  = !!(keys['KeyD'] || keys['ArrowRight']);
  i.up     = !!(keys['KeyW'] || keys['ArrowUp']);
  i.jump   = !!(keys['KeyW'] || keys['ArrowUp']);
  i.attack = !!(keys['KeyJ'] || keys['Space']);
  i.dodge  = !!(keys['KeyK'] || keys['ShiftLeft'] || keys['ShiftRight']);
}

// ---------- Touch buttons → player.input ----------
function bindTouch(id, prop) {
  const el = document.getElementById(id);
  if (!el) return;
  const set = (v) => (e) => { e.preventDefault(); touch[prop] = v; };
  el.addEventListener('touchstart', set(true), { passive: false });
  el.addEventListener('touchend', set(false), { passive: false });
  el.addEventListener('touchcancel', set(false), { passive: false });
  el.addEventListener('mousedown', set(true));
  el.addEventListener('mouseup', set(false));
  el.addEventListener('mouseleave', set(false));
}
const touch = { left: false, right: false, jump: false, attack: false, dodge: false };
bindTouch('btn-left', 'left');
bindTouch('btn-right', 'right');
bindTouch('btn-jump', 'jump');
bindTouch('btn-atk', 'attack');
bindTouch('btn-dodge', 'dodge');

// ---------- Update ----------
function update(dt) {
  readKeyboard();
  player.input.left   = player.input.left   || touch.left;
  player.input.right  = player.input.right  || touch.right;
  player.input.jump   = player.input.jump   || touch.jump;
  player.input.up     = player.input.up     || touch.jump;
  player.input.attack = player.input.attack || touch.attack;
  player.input.dodge  = player.input.dodge  || touch.dodge;

  player.update(dt, { enemies: manager.list, projectiles: manager.projectiles });
  manager.update(dt, player);

  // Respawn all when allDead (1.5s delay)
  if (manager.allDead()) {
    if (respawnTimer < 0) respawnTimer = 1.5;
    else {
      respawnTimer -= dt;
      if (respawnTimer <= 0) {
        respawnTimer = -1;
        // Clear list and projectiles, respawn
        manager.list.length = 0;
        manager.projectiles.length = 0;
        manager.spawn('grunt',  560);
        manager.spawn('ranger', 700);
        manager.spawn('heavy',  640);
      }
    }
  } else {
    respawnTimer = -1;
  }

  fx.fire('onUpdate', { dt });
}

// ---------- Draw ----------
function draw(ctx) {
  // Background
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#11101f');
  sky.addColorStop(0.7, '#171527');
  sky.addColorStop(1, '#0d0c16');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Ground
  ctx.fillStyle = '#1e1c30';
  ctx.fillRect(0, GROUND + 6, W, H - GROUND - 6);
  ctx.strokeStyle = '#ffd34d33';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND + 6); ctx.lineTo(W, GROUND + 6); ctx.stroke();

  manager.draw(ctx);
  player.draw(ctx);

  fx.fire('onDraw', { ctx });

  // Debug HUD
  const tok = manager._tokenHolder;
  const tokLabel = tok ? `${tok.kind}@${tok._aiState}` : 'free';
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'left';
  ctx.fillText(
    `state:${player.state}  combo:${player.combo}  air:${player.airCombo}  hp:${player.hp}  token:${tokLabel}`,
    10, 18
  );
  ctx.fillText('A/D move  W/↑ jump  J/Space attack  K/Shift dodge  W+J launcher', 10, 34);

  // Respawn countdown
  if (respawnTimer > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,211,77,0.7)';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`RESPAWN IN ${respawnTimer.toFixed(1)}s`, W / 2, H / 2);
  }
}

startLoop({ update, draw });

// Debug handle
window.__game = { time, fx, player, enemies: manager };
