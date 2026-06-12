// js/core/fx.js — fx engine: game-feel layer, all effects always-on
// No enabled flag per module. Hooks: onHit / onKill / onWhiff / onUpdate / onDraw.

import { sfx } from './audio.js';
import { time } from './loop.js';

// ---- Event bus ----
export const fx = {
  modules: [],
  register(mod) { this.modules.push(mod); },
  fire(hook, payload) {
    for (const mod of this.modules) {
      if (typeof mod[hook] === 'function') mod[hook](payload);
    }
  },
};

// ---- Kind color table (death particles) ----
const KIND_COLOR = {
  grunt:   '#8f6ab8',
  ranger:  '#6a7e9c',
  heavy:   '#a04848',
};
function kindColor(k) { return KIND_COLOR[k] || '#c97b4a'; }

// ---- installFx: registers all modules ----
export function installFx() {

  // ① flash — hit: 120ms white, kill: 60ms (keep brief so death anim shows)
  fx.register({
    id: 'flash',
    onHit({ target, kill }) { target.flashT = kill ? 0.06 : 0.12; },
  });

  // ② hitstop — two-tier: kill=world freeze 80ms, crit=55ms, else object-level 45ms
  fx.register({
    id: 'hitstop',
    onHit({ target, crit, kill }) {
      if (kill)       time.freeze(0.080);
      else if (crit)  time.freeze(0.055);
      else            target.selfFreeze = 0.045;
    },
  });

  // ③ knockback + squash — VS-style; armor flag skips vx/stagger (heavy 霸体)
  fx.register({
    id: 'knockback',
    onHit({ target, dir, kill, air }) {
      target.squashT = 1;
      if (target.armored) return;           // 霸体:skip vx/staggerT
      target.vx = dir * (kill ? 260 : 90);
      target.staggerT = 1;
      if (kill) {
        target.vy = target.airborne ? -180 : -260;
        target.dy = 1;                      // flag for scene physics
      }
    },
  });

  // ④ damage numbers — crit gold ×1.5 size; air hits cyan tint
  const numbers = [];
  fx.register({
    id: 'dmgnum',
    onHit({ target, dmg, crit, air }) {
      numbers.push({
        x:    target.x + (Math.random() * 24 - 12),
        y:    target.y - target.h / 2 - 8 - Math.random() * 10,
        vy:   -120,
        t:    0,
        life: 0.7,
        text: String(dmg),
        crit: !!crit,
        air:  !!air,
      });
    },
    onUpdate({ dt }) {
      for (const n of numbers) { n.t += dt; n.y += n.vy * dt; n.vy += 380 * dt; }
      for (let i = numbers.length - 1; i >= 0; i--) {
        if (numbers[i].t > numbers[i].life) numbers.splice(i, 1);
      }
    },
    onDraw({ ctx }) {
      for (const n of numbers) {
        const a    = 1 - Math.max(0, (n.t - n.life * 0.6) / (n.life * 0.4));
        const base = n.crit ? 30 : 20;
        const size = base * Math.min(1, 6 * n.t + 0.55);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font        = `bold ${size}px monospace`;
        ctx.textAlign   = 'center';
        // air hit: cyan; crit: gold; normal: white
        ctx.fillStyle   = n.air ? '#9adcff' : (n.crit ? '#ffd34d' : '#fff');
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 3;
        ctx.strokeText(n.text, n.x, n.y);
        ctx.fillText(n.text, n.x, n.y);
        ctx.restore();
      }
    },
  });

  // ⑤ hit VFX — 4-point star (90ms) + expanding ring (180ms) at contact edge
  const vfx = [];
  fx.register({
    id: 'hitvfx',
    onHit({ target, dir, crit }) {
      // contact edge: far side of target (attacker comes from -dir side)
      const x = target.x - dir * target.w / 2;
      const y = target.y - 10 + Math.random() * 20;
      vfx.push({ kind: 'star', x, y, t: 0, life: 0.09, big: !!crit });
      vfx.push({ kind: 'ring', x, y, t: 0, life: 0.18, big: !!crit });
    },
    onUpdate({ dt }) {
      for (const v of vfx) v.t += dt;
      for (let i = vfx.length - 1; i >= 0; i--) {
        if (vfx[i].t > vfx[i].life) vfx.splice(i, 1);
      }
    },
    onDraw({ ctx }) {
      for (const v of vfx) {
        const p = v.t / v.life;
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.globalAlpha = 1 - p;
        if (v.kind === 'star') {
          const r = (v.big ? 22 : 14) * (0.5 + p);
          ctx.fillStyle = '#fff';
          ctx.rotate(Math.PI / 4 * p);
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, -r); ctx.lineTo(3, -3); ctx.lineTo(-3, -3);
            ctx.closePath(); ctx.fill();
          }
        } else {
          ctx.strokeStyle = v.big ? '#ffd34d' : '#cfd6e4';
          ctx.lineWidth   = 2 * (1 - p) + 0.5;
          ctx.beginPath();
          ctx.arc(0, 0, (v.big ? 34 : 22) * p + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    },
  });

  // ⑥ death particles — 12 radial, gravity 400, life 0.6, color by target.kind
  const parts = [];
  fx.register({
    id: 'particles',
    onKill({ target, dir }) {
      const color = kindColor(target.kind);
      for (let i = 0; i < 12; i++) {
        const a  = Math.random() * Math.PI * 2;
        const sp = 120 + Math.random() * 180;
        parts.push({
          x: target.x, y: target.y,
          vx: Math.cos(a) * sp + (dir || 1) * 60,
          vy: Math.sin(a) * sp - 120,
          t: 0, life: 0.6,
          size: 3 + Math.random() * 4,
          color,
        });
      }
    },
    onUpdate({ dt }) {
      for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; }
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].t > parts[i].life) parts.splice(i, 1);
      }
    },
    onDraw({ ctx }) {
      for (const p of parts) {
        ctx.globalAlpha = 1 - p.t / p.life;
        ctx.fillStyle   = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    },
  });

  // ⑦ screen shake — scarce: kill 11px/0.35s, crit 6px/0.22s, normal 0
  fx.register({
    id: 'shake',
    onHit({ crit, kill }) {
      if      (kill) { time.shake.mag = 11; time.shake.decay = 0.35; }
      else if (crit) { time.shake.mag =  6; time.shake.decay = 0.22; }
      // normal hit: no shake (Vlambeer rule — shake is a scarce resource)
    },
  });

  // ⑧ camera kick + tilt — directional, not random
  fx.register({
    id: 'kick',
    onHit({ dir, crit, kill }) {
      time.kick.x = dir * (kill ? 7 : crit ? 5 : 2.5);
      time.kick.y = -(kill ? 3 : 1.5);
      time.tilt   = dir * (kill ? 0.022 : crit ? 0.012 : 0);
    },
  });

  // ⑨ sfx binding — hit/crit/kill; whiff
  fx.register({
    id: 'sfx',
    onHit({ crit, kill }) { sfx(kill ? 'kill' : crit ? 'crit' : 'hit'); },
    onWhiff()              { sfx('whiff'); },
  });
}
