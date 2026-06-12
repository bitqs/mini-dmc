// js/main.js — Task 6: style scoring + 3-wave encounter system

import { startLoop, W, H, GROUND, time } from './core/loop.js';
import { fx, installFx } from './core/fx.js';
import { sprites } from './core/sprites.js';
import { createPlayer } from './game/player.js';
import { createEnemyManager } from './game/enemies.js';
import { createStyle } from './game/style.js';
import { createEncounter } from './game/encounter.js';

installFx();

const manager = createEnemyManager();
const style = createStyle();

// Mutable player holder — onRestart rebuilds and swaps the reference
const holder = { player: createPlayer() };

// onRestart: called by encounter to rebuild player; returns fresh player ref
function onRestart() {
  const fresh = createPlayer();
  holder.player = fresh;
  window.__game.player = fresh;
  lastHp = fresh.hp;  // reset HP tracker so no spurious notifyPlayerHurt on restart
  return fresh;
}

const enc = createEncounter({
  get player() { return holder.player; },
  manager,
  style,
  time,
  onRestart,
});

// ---------- Keyboard → player.input ----------
const keys = {};
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function readKeyboard() {
  const i = holder.player.input;
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

// Track last HP to detect player getting hurt
let lastHp = holder.player.hp;

// ---------- Update ----------
function update(dt) {
  const player = holder.player;

  readKeyboard();
  player.input.left   = player.input.left   || touch.left;
  player.input.right  = player.input.right  || touch.right;
  player.input.jump   = player.input.jump   || touch.jump;
  player.input.up     = player.input.up     || touch.jump;
  player.input.attack = player.input.attack || touch.attack;
  player.input.dodge  = player.input.dodge  || touch.dodge;

  player.update(dt, { enemies: manager.list, projectiles: manager.projectiles });
  manager.update(dt, player);

  // Detect HP drop to notify style system
  if (player.hp < lastHp) {
    style.notifyPlayerHurt();
  }
  lastHp = player.hp;

  style.update(dt);
  enc.update(dt);

  fx.fire('onUpdate', { dt });
}

// ---------- Draw ----------
function draw(ctx) {
  const player = holder.player;

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

  // Scene: enemies + player
  manager.draw(ctx);
  player.draw(ctx);

  // FX layer (damage numbers, hit VFX, particles)
  fx.fire('onDraw', { ctx });

  // Style HUD (top-right rank/gauge/combo)
  style.drawHUD(ctx);

  // Encounter overlays (intro title card, result screen, dead screen) — drawn last
  enc.draw(ctx);

  // Debug HUD
  const tok = manager._tokenHolder;
  const tokLabel = tok ? `${tok.kind}@${tok._aiState}` : 'free';
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'left';
  ctx.fillText(
    `state:${player.state}  hp:${player.hp}  wave:${enc.wave}/${enc.state}  pts:${Math.round(style.totalPoints)}  token:${tokLabel}`,
    10, 18
  );
  ctx.fillText('A/D move  W/↑ jump  J/Space attack  K/Shift dodge  W+J launcher', 10, 34);
}

startLoop({ update, draw });

// Debug handle
window.__game = { time, fx, get player() { return holder.player; }, enemies: manager, style, enc };
