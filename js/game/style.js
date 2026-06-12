// js/game/style.js — DMC-style scoring system
// gauge 0-700, rank D..SSS, totalPoints (lifetime), maxCombo, HUD draw.
// Registers its own fx module so it hooks into the hit pipeline automatically.

import { fx } from '../core/fx.js';

const W = 800;

const RANKS = [
  { ch: 'D',   color: '#8888a0' },
  { ch: 'C',   color: '#9fb4d0' },
  { ch: 'B',   color: '#5dc8ff' },
  { ch: 'A',   color: '#5dff8f' },
  { ch: 'S',   color: '#ffd34d' },
  { ch: 'SS',  color: '#ff9d3c' },
  { ch: 'SSS', color: '#ff5d5d' },
];

export function createStyle() {
  const style = {
    gauge: 0,         // 0-700
    rank: -1,         // -1 = no rank; 0=D .. 6=SSS
    totalPoints: 0,   // lifetime — never decays; used for room rating
    maxCombo: 0,

    _comboCount: 0,
    _comboT: 0,
    _pulse: 0,        // rank-up visual pulse 0..1

    update,
    drawHUD,
    reset,
    notifyPlayerHurt,
  };

  // Register fx module — hooks into every hit fired in the game
  fx.register({
    id: 'style',
    onHit(payload) {
      // Only count enemy targets, not player
      if (!payload.target || payload.target.kind === 'player') return;

      const { kill, crit, air, melee } = payload;

      // Award points: use highest applicable tier, not cumulative
      let gain;
      if (kill)       gain = 90;
      else if (air)   gain = 35;
      else if (crit)  gain = 40;
      else if (melee) gain = 22;
      else            gain = 22;  // fallback

      style.gauge = Math.min(style.gauge + gain, 700);
      style.totalPoints += gain;

      style._comboCount++;
      style._comboT = 1.6;
      if (style._comboCount > style.maxCombo) style.maxCombo = style._comboCount;
    },
  });

  function update(dt) {
    // Decay: rate increases with rank
    const r = Math.max(0, Math.floor(style.gauge / 100));
    style.gauge = Math.max(0, style.gauge - (35 + r * 18) * dt);

    // Combo window
    if (style._comboT > 0) {
      style._comboT -= dt;
      if (style._comboT <= 0) { style._comboT = 0; style._comboCount = 0; }
    }

    // Compute rank: gauge < 25 = no rank (-1)
    const newRank = style.gauge < 25 ? -1 : Math.min(6, Math.floor(style.gauge / 100));
    if (newRank > style.rank) style._pulse = 1;   // rank-up pulse
    style.rank = newRank;

    style._pulse = Math.max(0, style._pulse - dt * 3);
  }

  function drawHUD(ctx) {
    if (style.rank < 0) return;

    const R = RANKS[style.rank];
    const scale = 1 + style._pulse * 0.6;

    ctx.save();
    ctx.translate(W - 78, 72);
    ctx.rotate(-0.08);
    ctx.scale(scale, scale);

    // Rank letter — italic, slash-tilt
    ctx.font = 'italic bold 44px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.strokeText(R.ch, 0, 0);
    ctx.fillStyle = R.color;
    ctx.fillText(R.ch, 0, 0);

    // Gauge bar (fills within current rank band: gauge % 100 / 100)
    ctx.fillStyle = 'rgba(13,12,22,0.7)';
    ctx.fillRect(-34, 10, 68, 5);
    ctx.fillStyle = R.color;
    ctx.fillRect(-34, 10, 68 * ((style.gauge % 100) / 100), 5);

    // Combo counter
    if (style._comboCount > 1) {
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#e8e8f0';
      ctx.fillText(`${style._comboCount} HITS`, 0, 32);
    }

    ctx.restore();
  }

  function reset() {
    style.gauge = 0;
    style.rank = -1;
    style.totalPoints = 0;
    style.maxCombo = 0;
    style._comboCount = 0;
    style._comboT = 0;
    style._pulse = 0;
  }

  function notifyPlayerHurt() {
    // Drop gauge and rank penalty
    style.gauge = Math.max(0, style.gauge - 60);
    if (style.rank > 0) {
      // Drop one full rank: clamp gauge to just below current rank floor
      style.gauge = Math.min(style.gauge, style.rank * 100 - 1);
    }
  }

  return style;
}
