// js/main.js — Task 7: HUD, touch controls, README

import { startLoop, W, H, GROUND, time } from './core/loop.js';
import { fx, installFx } from './core/fx.js';
import { createPlayer } from './game/player.js';
import { createEnemyManager } from './game/enemies.js';
import { createStyle } from './game/style.js';
import { createEncounter } from './game/encounter.js';
import { createHud } from './game/hud.js';

installFx();

const manager = createEnemyManager();
const style = createStyle();

// Mutable player holder — onRestart rebuilds and swaps the reference
const holder = { player: createPlayer() };

// onRestart: called by encounter to rebuild player; returns fresh player ref
function onRestart() {
  const fresh = createPlayer();
  holder.player = fresh;
  lastHp = fresh.hp;   // reset so no spurious notifyPlayerHurt on restart
  return fresh;
}

const enc = createEncounter({
  get player() { return holder.player; },
  manager,
  style,
  time,
  onRestart,
});

const hud = createHud({
  getPlayer: () => holder.player,
  manager,
  style,
  enc,
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

// ---------- Touch buttons → player.input (pointer capture, multi-touch safe) ----------
const touch = { left: false, right: false, jump: false, attack: false, dodge: false };

function bindTouch(id, prop) {
  const el = document.getElementById(id);
  if (!el) return;
  // Track which pointer IDs are currently pressing this button
  const activePointers = new Set();

  function onDown(e) {
    e.preventDefault();
    activePointers.add(e.pointerId);
    touch[prop] = true;
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  }
  function onUp(e) {
    e.preventDefault();
    activePointers.delete(e.pointerId);
    if (activePointers.size === 0) touch[prop] = false;
  }

  el.addEventListener('pointerdown',   onDown, { passive: false });
  el.addEventListener('pointerup',     onUp,   { passive: false });
  el.addEventListener('pointercancel', onUp,   { passive: false });
}

bindTouch('btn-left',  'left');
bindTouch('btn-right', 'right');
bindTouch('btn-jump',  'jump');
bindTouch('btn-atk',   'attack');
bindTouch('btn-dodge', 'dodge');

// Track last HP to notify style system on player hurt
let lastHp = holder.player.hp;

// ---------- Update ----------
function update(dt) {
  const player = holder.player;

  readKeyboard();
  player.input.left   = player.input.left   || touch.left;
  player.input.right  = player.input.right  || touch.right;
  player.input.jump   = player.input.jump   || touch.jump;
  player.input.up     = player.input.up     || touch.jump;   // JMP hold → up (enables launcher)
  player.input.attack = player.input.attack || touch.attack;
  player.input.dodge  = player.input.dodge  || touch.dodge;

  player.update(dt, { enemies: manager.list, projectiles: manager.projectiles });
  manager.update(dt, player);

  // Notify style system on HP drop (gauge penalty)
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

  // HUD: HP bar, wave indicator, controls hint
  hud.draw(ctx);

  // Style HUD (top-right rank/gauge/combo)
  style.drawHUD(ctx);

  // Encounter overlays (intro title card, result screen, dead screen) — drawn last
  enc.draw(ctx);

  // Debug HUD (only when window.__debug = true)
  if (window.__debug) {
    const tok = manager._tokenHolder;
    const tokLabel = tok ? `${tok.kind}@${tok._aiState}` : 'free';
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'left';
    ctx.fillText(
      `state:${player.state}  hp:${player.hp}  wave:${enc.wave}/${enc.state}  pts:${Math.round(style.totalPoints)}  token:${tokLabel}`,
      10, 18
    );
  }
}

startLoop({ update, draw });

// Debug handle
window.__game = { time, fx, get player() { return holder.player; }, enemies: manager, style, enc };
