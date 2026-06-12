// js/game/enemies.js — Task 5: 3 enemy types + token-based AI coordinator
// Entity contract: { x, y(feet), vx, vy, w, h, hp, maxHp, alive, facing, kind,
//   flashT, squashT, staggerT, selfFreeze, airborne, dy, armored }
// fx writes flashT/squashT/staggerT/selfFreeze/vx/vy on hit (armor blocks knockback/stagger).
// Token: manager holds 1 attack token; heavy has priority when token frees.

import { GROUND, W } from '../core/loop.js';
import { fx } from '../core/fx.js';
import { sprites } from '../core/sprites.js';

// ---- Sprite draw sizes ----
// grunt/ranger SVG viewBox 64×96 → canvas 132×198 (scaled ~2.06×)
// heavy SVG viewBox 96×96 → canvas 198×198
const GRUNT_DW  = 132, GRUNT_DH  = 198;
const RANGER_DW = 132, RANGER_DH = 198;
const HEAVY_DW  = 198, HEAVY_DH  = 198;

// ---- Corpse fade duration ----
const CORPSE_LIFE = 3.0;

// ---- Orbit strafe: tokenless enemies in range orbit at 140–220px ----
const ORBIT_INNER = 140;
const ORBIT_OUTER = 220;

export function createEnemyManager() {
  // ---- Token state ----
  let _token = null;          // null = free; reference to holding enemy
  const _waiting = [];        // enemies waiting for token (heavy kept at front)

  function requestToken(e) {
    if (_token === null) {
      _token = e;
      return true;
    }
    if (!_waiting.includes(e)) {
      // heavy jumps to front of queue
      if (e.kind === 'heavy') _waiting.unshift(e);
      else                    _waiting.push(e);
    }
    return false;
  }

  function releaseToken(e) {
    if (_token === e) {
      _token = null;
      // Grant to next waiting enemy (heavy-priority already encoded in queue order)
      // Re-sort: bubble any heavy to front
      const heavyIdx = _waiting.findIndex(w => w.kind === 'heavy' && w.alive);
      if (heavyIdx > 0) {
        const h = _waiting.splice(heavyIdx, 1)[0];
        _waiting.unshift(h);
      }
      // Grant to first alive waiting enemy
      while (_waiting.length) {
        const next = _waiting.shift();
        if (next.alive) {
          _token = next;
          next._tokenGranted = true;
          break;
        }
      }
    } else {
      // Remove from waiting list if not token holder
      const idx = _waiting.indexOf(e);
      if (idx !== -1) _waiting.splice(idx, 1);
    }
  }

  function forceReleaseToken(e) {
    if (_token === e) releaseToken(e);
    const idx = _waiting.indexOf(e);
    if (idx !== -1) _waiting.splice(idx, 1);
  }

  // ---- Projectiles (ranger bolts) ----
  const projectiles = [];

  // ---- Enemy list ----
  const list = [];

  // ---- Spawn ----
  function spawn(kind, x) {
    const defs = {
      grunt:  { hp: 40,  maxHp: 40,  w: 44, h: 88, speed: 90,  armored: false },
      ranger: { hp: 25,  maxHp: 25,  w: 44, h: 88, speed: 70,  armored: false },
      heavy:  { hp: 120, maxHp: 120, w: 88, h: 88, speed: 45,  armored: true  },
    };
    const def = defs[kind];
    if (!def) return null;

    const e = {
      // entity contract
      x, y: GROUND,
      vx: 0, vy: 0,
      w: def.w, h: def.h,
      hp: def.hp, maxHp: def.maxHp,
      alive: true,
      facing: -1,            // start facing left (toward player who starts at x=150)
      kind,
      flashT: 0, squashT: 0, staggerT: 0, selfFreeze: 0,
      airborne: false, dy: 0,
      armored: def.armored,

      // AI state
      _speed: def.speed,
      _aiState: 'approach',  // approach | telegraph | strike | recover | orbit
      _aiTimer: 0,
      _tokenGranted: false,

      // telegraph pulse for visual effect
      _telegraphT: 0,        // counts up during telegraph phase
      _blinkT: 0,            // for 100ms blink cycle (grunt)

      // ranger specific
      _shotCooldown: 0,      // time until next shot attempt (2.2s)

      // heavy specific: smash point x for ring telegraph
      _smashX: 0,

      // corpse
      _corpseT: 0,           // counts up after death; remove when > CORPSE_LIFE
      _corpseFacing: 1,

      // orbit strafe
      _strafeDir: 1,
      _strafeDirTimer: 0,
    };

    list.push(e);
    return e;
  }

  // ---- Main update ----
  function update(dt, player) {
    // Update projectiles
    for (const p of projectiles) {
      if (p.dead) continue;
      p.x += p.vx * dt;
      // Off-screen kill
      if (p.x < -50 || p.x > W + 50) p.dead = true;
      // AABB vs player
      if (!p.dead && player.alive && !player.iframes) {
        const pl = player.x - player.w / 2, pr = player.x + player.w / 2;
        const pt = player.y - player.h,      pb = player.y;
        const bl = p.x - p.w / 2, br = p.x + p.w / 2;
        const bt = p.y - p.h / 2, bb = p.y + p.h / 2;
        if (br >= pl && bl <= pr && bb >= pt && bt <= pb) {
          const hit = player.takeDamage(8, Math.sign(p.vx));
          if (hit !== false) p.dead = true;
        }
      }
    }
    // Remove dead projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (projectiles[i].dead) projectiles.splice(i, 1);
    }

    // Update enemies
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];

      // ---- Corpse phase ----
      if (!e.alive) {
        e._corpseT += dt;

        // Corpse physics: vx decay, gravity for dy
        e.x += e.vx * dt;
        e.vx *= Math.pow(0.002, dt);
        if (e.dy > 0 || e.vy !== 0) {
          e.vy += 1400 * dt;
          e.dy = Math.max(0, e.dy - e.vy * dt);
          if (e.dy <= 0 && e.vy > 0) { e.dy = 0; e.vy = 0; }
        }

        // Decay hit fields (real-tick based)
        decayFields(e, dt);

        if (e._corpseT >= CORPSE_LIFE) list.splice(i, 1);
        continue;
      }

      // ---- Hit field decay ----
      decayFields(e, dt);

      // ---- selfFreeze: skip all update ----
      if (e.selfFreeze > 0) continue;

      // ---- dt=0 (world freeze): skip physics/AI but decay already done ----
      if (dt === 0) continue;

      // ---- Airborne: suspend AI, apply gravity ----
      if (e.airborne || e.dy > 0 || e.vy !== 0) {
        e.vy += 1400 * dt;
        e.dy = Math.max(0, e.dy - e.vy * dt);
        e.x += e.vx * dt;
        e.vx *= Math.pow(0.01, dt);
        if (e.dy <= 0 && e.vy > 0) {
          // Land
          e.dy = 0; e.vy = 0; e.airborne = false;
          e.vx = 0;
          // 400ms get-up stun after landing
          e._aiState = 'getup';
          e._aiTimer = 0.4;
        }
        e.x = Math.max(60, Math.min(W - 60, e.x));
        continue;
      }

      // ---- If token was just granted to us, clear the flag and proceed ----
      if (e._tokenGranted) {
        e._tokenGranted = false;
        // The AI loop will pick it up naturally since _token === e now
      }

      // ---- staggerT > 0: AI frozen (except armored); interrupt telegraph ----
      if (e.staggerT > 0 && !e.armored) {
        // If holding token and in telegraph/strike, release it
        if (_token === e && (e._aiState === 'telegraph' || e._aiState === 'strike')) {
          e._aiState = 'staggered';
          forceReleaseToken(e);
        } else if (e._aiState === 'telegraph' || e._aiState === 'strike') {
          e._aiState = 'staggered';
        }
        // Stagger drift
        e.x += e.vx * dt;
        e.vx *= Math.pow(0.01, dt);
        e.x = Math.max(60, Math.min(W - 60, e.x));
        continue;
      }

      // If was staggered, recover to approach
      if (e._aiState === 'staggered' && e.staggerT <= 0) {
        e._aiState = 'approach';
      }

      // ---- Get-up timer ----
      if (e._aiState === 'getup') {
        e._aiTimer -= dt;
        if (e._aiTimer <= 0) e._aiState = 'approach';
        continue;
      }

      // ---- Per-kind AI ----
      const dx = player.x - e.x;
      const absDx = Math.abs(dx);
      const dirToPlayer = Math.sign(dx) || 1;
      e.facing = dirToPlayer;   // face player always (sprites face left; mirror when dirToPlayer > 0)

      if (e.kind === 'grunt') updateGrunt(e, dt, player, dx, absDx, dirToPlayer);
      else if (e.kind === 'ranger') updateRanger(e, dt, player, dx, absDx, dirToPlayer);
      else if (e.kind === 'heavy') updateHeavy(e, dt, player, dx, absDx, dirToPlayer);

      // Boundary clamp
      e.x = Math.max(20, Math.min(W - 20, e.x));
    }
  }

  // ---- Grunt AI ----
  function updateGrunt(e, dt, player, dx, absDx, dirToPlayer) {
    switch (e._aiState) {
      case 'approach': {
        if (absDx <= 90) {
          // Request token to telegraph
          if (requestToken(e)) {
            e._aiState = 'telegraph';
            e._aiTimer = 0.45;
            e._telegraphT = 0;
            e._blinkT = 0;
          } else {
            // No token: orbit
            doOrbit(e, dt, player, dirToPlayer);
          }
        } else {
          e.x += dirToPlayer * e._speed * dt;
        }
        break;
      }
      case 'telegraph': {
        e._aiTimer -= dt;
        e._telegraphT += dt;
        e._blinkT += dt;
        // Blink toward white every 100ms
        if (e._blinkT >= 0.1) {
          e._blinkT = 0;
          e.flashT = 0.05;   // brief white flash
        }
        if (e._aiTimer <= 0) {
          e._aiState = 'strike';
          e._aiTimer = 0;
        }
        break;
      }
      case 'strike': {
        // Strike frame: check if player still in range
        const freshDx = Math.abs(player.x - e.x);
        if (freshDx <= 110) {
          player.takeDamage(12, dirToPlayer);
        }
        e._aiState = 'recover';
        e._aiTimer = 0.6;
        break;
      }
      case 'recover': {
        e._aiTimer -= dt;
        if (e._aiTimer <= 0) {
          e._aiState = 'approach';
          releaseToken(e);
        }
        break;
      }
      default:
        e._aiState = 'approach';
    }
  }

  // ---- Ranger AI ----
  function updateRanger(e, dt, player, dx, absDx, dirToPlayer) {
    // Advance shot cooldown always
    e._shotCooldown = Math.max(0, e._shotCooldown - dt);

    switch (e._aiState) {
      case 'approach': {
        // Keep distance: 260–340px
        if (absDx < 260) {
          // Too close: retreat
          e.x -= dirToPlayer * e._speed * dt;
        } else if (absDx > 340) {
          e.x += dirToPlayer * e._speed * dt;
        }
        // Attempt shot if cooldown done
        if (e._shotCooldown <= 0) {
          if (requestToken(e)) {
            e._aiState = 'telegraph';
            e._aiTimer = 0.6;
            e._telegraphT = 0;
          } else {
            // No token: orbit at distance
            doOrbit(e, dt, player, dirToPlayer);
          }
        }
        break;
      }
      case 'telegraph': {
        e._aiTimer -= dt;
        e._telegraphT += dt;
        // Keep distance during telegraph
        if (absDx < 260) e.x -= dirToPlayer * e._speed * 0.5 * dt;
        if (e._aiTimer <= 0) {
          e._aiState = 'strike';
        }
        break;
      }
      case 'strike': {
        // Fire bolt
        fireBolt(e, dirToPlayer);
        e._shotCooldown = 2.2;
        e._aiState = 'recover';
        e._aiTimer = 0.2;   // brief recover before releasing token
        break;
      }
      case 'recover': {
        e._aiTimer -= dt;
        if (e._aiTimer <= 0) {
          e._aiState = 'approach';
          releaseToken(e);
        }
        break;
      }
      default:
        e._aiState = 'approach';
    }
  }

  function fireBolt(e, dirToPlayer) {
    projectiles.push({
      x: e.x + dirToPlayer * 10,
      y: e.y - 50,   // mid-body height
      vx: dirToPlayer * 380,
      w: 26, h: 6,
      dead: false,
    });
  }

  // ---- Heavy AI ----
  function updateHeavy(e, dt, player, dx, absDx, dirToPlayer) {
    // Heavy is armored: staggerT won't freeze it, but we still respect it
    // (armored = fx skips vx/stagger writes; heavy AI ignores staggerT entirely)
    switch (e._aiState) {
      case 'approach': {
        if (absDx <= 120) {
          if (requestToken(e)) {
            e._smashX = player.x;   // record smash target point
            e._aiState = 'telegraph';
            e._aiTimer = 0.8;
            e._telegraphT = 0;
          } else {
            doOrbit(e, dt, player, dirToPlayer);
          }
        } else {
          e.x += dirToPlayer * e._speed * dt;
        }
        break;
      }
      case 'telegraph': {
        e._aiTimer -= dt;
        e._telegraphT += dt;
        if (e._aiTimer <= 0) {
          e._aiState = 'strike';
        }
        break;
      }
      case 'strike': {
        // Smash: check if player within 140px of smash point
        const smashDist = Math.abs(player.x - e._smashX);
        if (smashDist <= 140) {
          const dir = Math.sign(player.x - e.x) || 1;
          player.takeDamage(25, dir);
        }
        e._aiState = 'recover';
        e._aiTimer = 0.9;
        break;
      }
      case 'recover': {
        e._aiTimer -= dt;
        if (e._aiTimer <= 0) {
          e._aiState = 'approach';
          releaseToken(e);
        }
        break;
      }
      default:
        e._aiState = 'approach';
    }
  }

  // ---- Orbit behavior (tokenless, in-range enemies) ----
  function doOrbit(e, dt, player, dirToPlayer) {
    // Refresh strafe direction randomly every 1–2s
    e._strafeDirTimer -= dt;
    if (e._strafeDirTimer <= 0) {
      e._strafeDir = Math.random() < 0.5 ? 1 : -1;
      e._strafeDirTimer = 1 + Math.random();
    }

    const absDx = Math.abs(player.x - e.x);
    if (absDx < ORBIT_INNER) {
      // Too close: back away
      e.x -= dirToPlayer * e._speed * 0.6 * dt;
    } else if (absDx > ORBIT_OUTER) {
      // Too far: approach
      e.x += dirToPlayer * e._speed * 0.6 * dt;
    } else {
      // In orbit band: strafe
      e.x += e._strafeDir * e._speed * 0.5 * dt;
    }
  }

  // ---- Hit field decay (enemy's own tick) ----
  function decayFields(e, dt) {
    const tick = dt || 0.016;
    e.flashT   = Math.max(0, e.flashT   - tick);
    e.squashT  = Math.max(0, e.squashT  - tick * 6);
    e.staggerT = Math.max(0, e.staggerT - tick * 2.2);
    e.selfFreeze = Math.max(0, e.selfFreeze - 0.016);
  }

  // ---- allDead ----
  function allDead() {
    return list.length > 0 && list.every(e => !e.alive);
  }

  // ---- Draw ----
  function draw(ctx) {
    // Draw projectiles first (behind enemies)
    for (const p of projectiles) {
      if (p.dead) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      // Glow
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#fff8c0';
      ctx.fillRect(-p.w / 2 - 2, -p.h / 2 - 2, p.w + 4, p.h + 4);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Draw heavy telegraph ring (GROUND level, below characters)
    for (const e of list) {
      if (e.alive && e.kind === 'heavy' && e._aiState === 'telegraph') {
        const prog = e._telegraphT / 0.8;
        const alpha = 0.15 + 0.45 * Math.abs(Math.sin(e._telegraphT * Math.PI * 3));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#ff3030';
        ctx.lineWidth = 3 + prog * 2;
        ctx.beginPath();
        ctx.ellipse(e._smashX, GROUND + 4, 140, 18, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Inner fill
        ctx.globalAlpha = alpha * 0.2;
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.ellipse(e._smashX, GROUND + 4, 140, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw enemies (sort by y for layering — here all at GROUND, so order preserved)
    for (const e of list) {
      drawEnemy(ctx, e);
    }
  }

  function drawEnemy(ctx, e) {
    ctx.save();

    // Corpse: fade out
    let alpha = 1;
    if (!e.alive) {
      alpha = Math.max(0, 1 - e._corpseT / CORPSE_LIFE);
      ctx.globalAlpha = alpha;
    }

    const jx = e.selfFreeze > 0 ? (Math.random() * 2 - 1) * 1.6 : 0;
    const jy = e.selfFreeze > 0 ? (Math.random() * 2 - 1) * 1.2 : 0;

    // Anchor: feet at y - dy (airborne lifts up), center at y - dy - h/2
    const groundY = e.y - e.dy;
    ctx.translate(e.x + jx, groundY - e.h / 2 + jy);

    // Shadow (ground level, not lifted by dy)
    if (alpha > 0.05) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      const shadowRx = e.kind === 'heavy' ? 30 : 22;
      ctx.beginPath();
      ctx.ellipse(0, e.h / 2 + 6 + e.dy, shadowRx, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Corpse rotation
    if (!e.alive) {
      ctx.rotate(e._corpseFacing * 0.55);
    }

    // squashT
    if (e.squashT > 0 && e.alive) {
      const q = Math.sin(e.squashT * Math.PI) * 0.18;
      ctx.scale(1 + q, 1 - q);
    }

    // staggerT lean (not armored, or armored but we show it anyway for non-stagger hits)
    if (e.staggerT > 0 && e.alive && !e.armored) {
      ctx.rotate(e.staggerT * 0.14);
    }

    // Mirror: sprites face LEFT; if player is to the RIGHT (dirToPlayer=+1 = facing=+1), mirror
    const mirrorX = e.facing > 0 ? -1 : 1;
    ctx.scale(mirrorX, 1);

    // Draw sprite
    if (sprites.ready) {
      const flashing = e.flashT > 0;
      const isDead = !e.alive;

      if (e.kind === 'grunt') {
        const img = flashing ? sprites.gruntWhite : (isDead ? sprites.gruntDark : sprites.grunt);
        // grunt: 64×96 SVG → 132×198 canvas; center at (0,0) which is h/2 up from feet
        ctx.drawImage(img, -GRUNT_DW / 2, -GRUNT_DH / 2, GRUNT_DW, GRUNT_DH);
      } else if (e.kind === 'ranger') {
        const img = flashing ? sprites.rangerWhite : (isDead ? sprites.rangerDark : sprites.ranger);
        ctx.drawImage(img, -RANGER_DW / 2, -RANGER_DH / 2, RANGER_DW, RANGER_DH);
      } else if (e.kind === 'heavy') {
        const img = flashing ? sprites.heavyWhite : (isDead ? sprites.heavyDark : sprites.heavy);
        // heavy: 96×96 SVG → 198×198; same center approach
        ctx.drawImage(img, -HEAVY_DW / 2, -HEAVY_DH / 2, HEAVY_DW, HEAVY_DH);
      }
    } else {
      // Fallback rectangles
      const colors = { grunt: '#8f6ab8', ranger: '#6a7e9c', heavy: '#a04848' };
      ctx.fillStyle = e.flashT > 0 ? '#ffffff' : (e.alive ? colors[e.kind] : '#444');
      ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
    }

    // Telegraph glow overlay (grunt raises scimitar, ranger crossbow glows)
    if (e.alive && e._aiState === 'telegraph') {
      if (e.kind === 'grunt') {
        // Blink tint already handled via flashT; additionally draw subtle orange aura
        const prog = e._telegraphT / 0.45;
        ctx.globalAlpha = 0.12 + prog * 0.15;
        ctx.fillStyle = '#ff8840';
        ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'ranger') {
        // Crossbow glow
        const prog = e._telegraphT / 0.6;
        ctx.globalAlpha = 0.15 + prog * 0.25;
        ctx.fillStyle = '#60c8e0';
        ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();

    // HP bar (above entity, in world space — need to re-translate)
    if (e.alive && e.hp < e.maxHp) {
      const bw = e.kind === 'heavy' ? 70 : 50;
      const bh = 6;
      const bx = e.x - bw / 2;
      const by = e.y - e.dy - e.h - 14;   // above head
      ctx.fillStyle = 'rgba(13,12,22,0.85)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      const pct = e.hp / e.maxHp;
      ctx.fillStyle = pct > 0.35 ? '#5dff8f' : '#ff5d5d';
      ctx.fillRect(bx, by, bw * pct, bh);
    }
  }

  const manager = {
    list,
    projectiles,
    spawn,
    update,
    draw,
    allDead,
    // Expose token holder for debug/verification
    get _tokenHolder() { return _token; },
  };

  return manager;
}
