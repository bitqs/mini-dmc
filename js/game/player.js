// js/game/player.js — 玩家状态机:DMC 式动作的核心。
// 地面四连 / 挑空 / 空中三连(收尾下劈)/ 闪避翻滚 / 150ms 输入缓冲。
// 手感参数移植自 juice-lab scene.js(连击表、挥砍节奏、命中点 0.55)。
//
// 依赖:loop(GROUND/time)、fx(命中管线钩子)、audio(sfx)、sprites(精灵)。
// fx 会向命中目标写入 flashT/squashT/staggerT/selfFreeze/vx/vy —— 玩家自己也消费这些字段。

import { GROUND, time } from '../core/loop.js';
import { fx } from '../core/fx.js';
import { sfx } from '../core/audio.js';
import { sprites } from '../core/sprites.js';

// ---- 地面四连表(移植 juice-lab):伤害倍率 / 动画时长倍率 ----
const COMBO = [
  { mult: 1.0, durM: 1.0 },
  { mult: 1.1, durM: 0.92 },
  { mult: 1.3, durM: 0.88 },
  { mult: 1.8, durM: 1.35 },   // 第4段:必暴击终结
];

// ---- 空中三连表:0/1 = 快斩,2 = 下劈收尾 ----
const AIR = [
  { mult: 1.0 },
  { mult: 1.1 },
  { mult: 1.0 },   // slam,伤害靠 forceCrit 拉满
];

const ATTACK_DUR = 0.12;     // 基础挥砍时长(地面)
const AIR_DUR    = 0.11;     // 空中快斩时长
const HIT_PROG   = 0.55;     // 命中落在动画进度 0.55
const REACH      = 120;      // 攻击横向触及
const COMBO_WIN  = 0.9;      // 命中后连段窗口

const DODGE_DUR  = 0.30;     // 翻滚时长(全程 i-frame)
const DODGE_CD   = 0.15;     // 翻滚后冷却
const DODGE_SPD  = 220 / DODGE_DUR;  // 翻滚水平速度

const HURT_DUR   = 0.25;     // 受击僵直
const BUFFER_WIN = 0.15;     // 输入缓冲窗口(动作结束前 150ms 内的按键)

export function createPlayer() {
  const player = {
    // ---- entity contract ----
    x: 150, y: GROUND,
    vx: 0, vy: 0,
    w: 34, h: 56,
    hp: 100, maxHp: 100,
    alive: true,
    facing: 1,
    kind: 'player',
    flashT: 0, squashT: 0, staggerT: 0, selfFreeze: 0,
    airborne: false, dy: 0,

    // ---- debug ----
    state: 'idle',

    // ---- input(main.js 每帧写入)----
    input: { left: false, right: false, jump: false, attack: false, dodge: false, up: false },

    // ---- 攻击状态机 ----
    attackT: -1,        // -1 空闲;0..1 进度
    attackDur: ATTACK_DUR,
    didHit: false,
    swingStage: 0,      // 本次挥砍的段位(地面/空中各自语义)
    attackKind: 'none', // 'ground' | 'launcher' | 'air'

    // ---- 连段链 ----
    combo: 0,           // 地面连段当前段(0-3)
    comboWindow: 0,     // 连段窗口剩余秒
    airCombo: 0,        // 空中连段当前段(0-2)

    // ---- 闪避 ----
    dodgeT: -1,         // -1 非翻滚;0..DODGE_DUR
    dodgeDir: 1,
    dodgeCd: 0,
    launcherCd: 0,      // 挑空冷却(250ms,防连挑)
    iframes: false,
    ghosts: [],         // 翻滚残影 {x, y, facing, t}

    // ---- 受击 ----
    hurtT: 0,

    // ---- 落地尘土(玩家自管的小粒子,空中下劈收尾用)----
    dust: [],

    // ---- 输入缓冲(单槽,最新覆盖)----
    _buffer: null,      // {name:'attack'|'jump'|'dodge', t}

    // ---- 边沿检测上一帧状态 ----
    _prev: { jump: false, attack: false, dodge: false, up: false },

    update, draw, takeDamage,
  };

  // ---- 边沿检测:本帧按下且上帧未按 = 一次"press" ----
  function pressed(name) {
    return player.input[name] && !player._prev[name];
  }

  // ---- 命中管线:对所有重叠的存活敌人结算(多目标)----
  // 返回是否至少命中一个目标(用于推进连段 / 判定挥空)。
  function applyHit(enemies, projectiles, { mult, forceCrit, air, payloadMult, onEnemyHit }) {
    const dir = player.facing;
    // 攻击盒:身前矩形,reach 120,高 h+30,从玩家中心向 facing 方向延伸
    const cx = player.x;
    const cy = player.y - player.h / 2;
    const boxNear = dir > 0 ? cx : cx - REACH;
    const boxFar  = dir > 0 ? cx + REACH : cx;
    const boxTop  = cy - (player.h + 30) / 2;
    const boxBot  = cy + (player.h + 30) / 2;

    // 击落弩箭:标记重叠的飞行物 dead
    if (projectiles) {
      for (const p of projectiles) {
        if (p.dead) continue;
        const pl = p.x - p.w / 2, pr = p.x + p.w / 2;
        const pt = p.y - p.h / 2, pb = p.y + p.h / 2;
        if (pr >= boxNear && pl <= boxFar && pb >= boxTop && pt <= boxBot) p.dead = true;
      }
    }

    let hitAny = false;
    for (const e of enemies) {
      if (!e || !e.alive) continue;
      const el = e.x - e.w / 2, er = e.x + e.w / 2;
      const et = (e.y - (e.dy || 0)) - e.h, eb = (e.y - (e.dy || 0));
      if (er < boxNear || el > boxFar || eb < boxTop || et > boxBot) continue;

      // 命中:计算伤害
      const base = 8 + Math.floor(Math.random() * 7);   // 8-14
      const crit = forceCrit || Math.random() < 0.12;
      const finalDmg = Math.max(1, Math.round(base * mult * (payloadMult || 1) * (crit ? 2.5 : 1)));
      e.hp -= finalDmg;
      const kill = e.hp <= 0;
      if (kill) { e.hp = 0; e.alive = false; fx.fire('onKill', { target: e, dir }); }
      fx.fire('onHit', { target: e, dmg: finalDmg, crit, kill, dir, melee: true, air: !!air });
      if (onEnemyHit) onEnemyHit(e, kill);
      hitAny = true;
    }
    return hitAny;
  }

  // ---- 触发一次地面攻击(普通连段 / 挑空)----
  function startGroundAttack(launcher) {
    player.attackT = 0;
    player.didHit = false;
    if (launcher) {
      player.attackKind = 'launcher';
      player.attackDur  = 0.16;
      player.swingStage = 0;
    } else {
      player.attackKind = 'ground';
      player.swingStage = player.combo;
      player.attackDur  = ATTACK_DUR;
    }
    player.state = launcher ? 'launcher' : 'attack';
  }

  // ---- 触发一次空中攻击 ----
  function startAirAttack() {
    player.attackT = 0;
    player.didHit = false;
    player.attackKind = 'air';
    player.swingStage = player.airCombo;
    player.attackDur  = AIR_DUR;
    player.state = 'air-attack';
    if (player.swingStage < 2) {
      player.vy = Math.min(player.vy, 60);   // 快斩:滞空
    } else {
      player.vy = 820;                       // 收尾下劈:俯冲
    }
  }

  // ---- 命中结算分发(动画进度到 0.55 时调用)----
  function doHit(enemies, projectiles) {
    if (player.attackKind === 'launcher') {
      const landed = applyHit(enemies, projectiles, {
        mult: COMBO[0].mult, forceCrit: false, air: false, payloadMult: 1.2,
        onEnemyHit(e) {
          if (!e.armored) { e.vy = -620; e.airborne = true; e.dy = e.dy || 0; }
        },
      });
      if (landed) { sfx('launch'); }
      // 挑空不参与地面连段链;命中与否都不重置 combo(玩家可立即跳起接空中连)
      if (!landed) { fx.fire('onWhiff', {}); }
      return;
    }

    if (player.attackKind === 'air') {
      const st = player.swingStage;
      const slam = st === 2;
      const landed = applyHit(enemies, projectiles, {
        mult: AIR[st].mult, forceCrit: slam, air: true, payloadMult: 1,
        onEnemyHit(e) {
          if (e.armored) return;
          if (slam) { e.vy = 900; e.airborne = true; }          // 砸地
          else      { e.vy = -160; e.airborne = true; }         // 轻挑维持浮空
        },
      });
      if (landed) {
        player.airCombo = Math.min(st + 1, 2);   // 推进空中段(封顶在 slam)
      } else {
        fx.fire('onWhiff', {});
        // 空中挥空不重置段位(浮空追打容错);落地才重置
      }
      return;
    }

    // 地面普通连段
    const st = player.swingStage;
    const landed = applyHit(enemies, projectiles, {
      mult: COMBO[st].mult, forceCrit: st === 3, air: false, payloadMult: 1,
    });
    if (landed) {
      player.combo = (st + 1) % 4;
      player.comboWindow = COMBO_WIN;
    } else {
      player.combo = 0; player.comboWindow = 0;   // 挥空断连
      fx.fire('onWhiff', {});
    }
  }

  // ---- 受击 ----
  function takeDamage(dmg, dir) {
    if (player.iframes || !player.alive) return false;
    player.hp -= dmg;
    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      player.state = 'dead';
      player.vx = (dir || 1) * 120;
      sfx('hurt');
      return true;
    }
    player.hurtT = HURT_DUR;
    player.state = 'hurt';
    player.vx = (dir || 1) * 240;
    // 中断当前动作
    player.attackT = -1;
    player.attackKind = 'none';
    player.flashT = 0.12;
    sfx('hurt');
    time.freeze(0.04);
    return true;
  }

  // ---- 主更新 ----
  function update(dt, { enemies = [], projectiles = [] } = {}) {
    // 边沿检测的 press 必须在真实帧拍上;但 update 在顿帧期间 dt=0 仍调用,
    // 此时不推进时间也不消费缓冲(避免顿帧吞输入)。先采集 press,再快照 prev。
    const pAttack = pressed('attack');
    const pJump   = pressed('jump');
    const pDodge  = pressed('dodge');
    // 立刻快照 prev,保证同一次按下只触发一次,即便本帧 dt=0。
    player._prev.jump   = player.input.jump;
    player._prev.attack = player.input.attack;
    player._prev.dodge  = player.input.dodge;
    player._prev.up     = player.input.up;

    if (dt === 0) {
      // 顿帧:只衰减自身命中字段(真实时间),不跑物理/逻辑;press 入缓冲以免丢失。
      if (pAttack) player._buffer = { name: 'attack', t: 0 };
      else if (pJump) player._buffer = { name: 'jump', t: 0 };
      else if (pDodge) player._buffer = { name: 'dodge', t: 0 };
      decayHitFields(0.016);
      return;
    }

    // 死亡:躺地不动(encounter 后续处理重开)
    if (!player.alive) {
      player.vx *= Math.pow(0.0001, dt);
      player.x += player.vx * dt;
      decayHitFields(dt);
      updateGhostsAndDust(dt);
      return;
    }

    // 自身对象级顿帧(被敌人 fx 写入):冻自己,世界照走
    if (player.selfFreeze > 0) {
      player.selfFreeze = Math.max(0, player.selfFreeze - 0.016);
      decayHitFields(dt, true);
      updateGhostsAndDust(dt);
      return;
    }

    // ---- 缓冲计时 + 新 press 入槽(单槽,最新覆盖)----
    if (player._buffer) {
      player._buffer.t += dt;
      if (player._buffer.t > BUFFER_WIN) player._buffer = null;
    }
    if (pAttack) player._buffer = { name: 'attack', t: 0 };
    else if (pJump) player._buffer = { name: 'jump', t: 0 };
    else if (pDodge) player._buffer = { name: 'dodge', t: 0 };

    player.dodgeCd    = Math.max(0, player.dodgeCd - dt);
    player.launcherCd = Math.max(0, player.launcherCd - dt);

    // ===================== 受击僵直 =====================
    if (player.hurtT > 0) {
      player.hurtT -= dt;
      applyPhysics(dt);
      if (player.hurtT <= 0) { player.hurtT = 0; player.state = grounded() ? 'idle' : 'fall'; }
      decayHitFields(dt);
      updateGhostsAndDust(dt);
      return;
    }

    // ===================== 闪避翻滚 =====================
    if (player.dodgeT >= 0) {
      player.dodgeT += dt;
      // 记录残影
      if (player.ghosts.length === 0 || player.dodgeT - player.ghosts[player.ghosts.length - 1].born > 0.04) {
        player.ghosts.push({ x: player.x, y: player.y, facing: player.facing, t: 0, born: player.dodgeT });
      }
      player.vx = player.dodgeDir * DODGE_SPD;
      applyPhysics(dt);   // 翻滚期间保留重力(可滚下台,但通常在地面)
      if (player.dodgeT >= DODGE_DUR) {
        player.dodgeT = -1;
        player.iframes = false;
        player.dodgeCd = DODGE_CD;
        player.state = grounded() ? 'idle' : 'fall';
        consumeBuffer();   // 翻滚结束:吃缓冲(接攻击/跳)
      }
      decayHitFields(dt);
      updateGhostsAndDust(dt);
      return;
    }

    // ===================== 攻击动画推进 =====================
    if (player.attackT >= 0) {
      player.attackT += dt / player.attackDur;
      if (!player.didHit && Math.min(player.attackT, 1) >= HIT_PROG) {
        player.didHit = true;
        doHit(enemies, projectiles);
      }
      // 攻击中仍受重力(空中攻击会移动);挑空允许立即跳(下方缓冲处理)
      applyPhysics(dt);

      // 挑空特例:命中点过后玩家即可起跳(缓冲的 jump 立即生效,无后摇)
      if (player.attackKind === 'launcher' && player.didHit && bufferIs('jump') && grounded()) {
        player.attackT = -1;
        doJump();
        clearBuffer();
      }

      if (player.attackT >= 1) {
        player.attackT = -1;
        player.attackKind = 'none';
        player.state = grounded() ? 'idle' : 'fall';
        consumeBuffer();
      }
      decayHitFields(dt);
      updateGhostsAndDust(dt);
      return;
    }

    // ===================== 自由控制(可移动/转向/起手新动作)=====================

    // 落地检测:空中→地面,重置空中连段
    const wasAir = !grounded();

    // 水平移动
    const mdir = (player.input.right ? 1 : 0) - (player.input.left ? 1 : 0);
    const accel = grounded() ? 1800 : 1800 * 0.6;   // 空中控制 60%
    if (mdir !== 0) {
      player.vx += mdir * accel * dt;
      player.vx = Math.max(-280, Math.min(280, player.vx));
      player.facing = mdir;   // 非攻击中才转向(此分支即自由态)
    } else if (grounded()) {
      player.vx *= Math.pow(0.0001, dt);   // 强地面摩擦
    }

    applyPhysics(dt);

    if (wasAir && grounded()) {
      onLand();
    }

    // ---- 起手动作:先吃缓冲,再吃本帧 press ----
    // 缓冲优先(它是上一个动作结束时未消费的);本帧 press 直接处理。
    if (!tryAction(bufferedName())) {
      // 缓冲没触发动作(或没缓冲),尝试本帧实时 press
      if (pAttack) tryAction('attack');
      else if (pJump) tryAction('jump');
      else if (pDodge) tryAction('dodge');
    } else {
      clearBuffer();
    }

    // 状态字符串(空闲态)
    if (player.attackT < 0 && player.dodgeT < 0 && player.hurtT <= 0) {
      if (!grounded()) player.state = player.vy < 0 ? 'jump' : 'fall';
      else player.state = Math.abs(player.vx) > 20 ? 'run' : 'idle';
    }

    // 连段窗口倒数,断了归零
    player.comboWindow = Math.max(0, player.comboWindow - dt);
    if (player.comboWindow === 0) player.combo = 0;

    decayHitFields(dt);
    updateGhostsAndDust(dt);
  }

  // ---- 尝试触发一个动作(缓冲消费 / 实时 press 共用)----
  // 返回 true 表示动作成功触发(调用方负责清缓冲)。
  function tryAction(name) {
    if (!name) return false;
    if (name === 'dodge') {
      if (player.dodgeCd <= 0) { startDodge(); return true; }
      return false;
    }
    if (name === 'jump') {
      if (grounded()) { doJump(); return true; }
      return false;
    }
    if (name === 'attack') {
      if (!grounded()) {
        startAirAttack();
        return true;
      }
      // 地面:↑+攻击 = 挑空(冷却 250ms 防连挑),否则普通连段
      if (player.input.up) {
        if (player.launcherCd > 0) return false;
        startGroundAttack(true);
        player.launcherCd = 0.25;
      } else {
        startGroundAttack(false);
      }
      return true;
    }
    return false;
  }

  function doJump() {
    player.vy = -520;
    player.airborne = true;
    player.state = 'jump';
  }

  function startDodge() {
    player.dodgeT = 0;
    player.iframes = true;
    // 方向:输入方向优先,否则朝向
    const mdir = (player.input.right ? 1 : 0) - (player.input.left ? 1 : 0);
    player.dodgeDir = mdir !== 0 ? mdir : player.facing;
    player.facing = player.dodgeDir;
    player.state = 'dodge';
    player.ghosts.length = 0;
    sfx('dodge');
  }

  function onLand() {
    player.airborne = false;
    player.vy = 0;
    player.y = GROUND;
    player.airCombo = 0;   // 落地重置空中连段
    // 空中下劈落地:小爆发(屏震 + 尘土)
    if (player.attackKind === 'air' && player.swingStage === 2) {
      time.shake.mag = 8; time.shake.decay = 0.2;
    }
    spawnDust();
  }

  // ---- 物理:重力 + 落地夹取 ----
  function applyPhysics(dt) {
    player.x += player.vx * dt;
    if (player.x < 16) { player.x = 16; player.vx = 0; }
    if (player.x > 800 - 16) { player.x = 800 - 16; player.vx = 0; }

    if (!grounded() || player.vy < 0) {
      player.vy += 1400 * dt;
      player.y += player.vy * dt;
      player.airborne = true;
      if (player.y >= GROUND) {   // 精确落地
        player.y = GROUND;
        player.vy = 0;
        player.airborne = false;
      }
    } else {
      player.y = GROUND;
      player.airborne = false;
    }
  }

  function grounded() { return player.y >= GROUND - 0.001 && player.vy >= 0; }

  // ---- 缓冲辅助 ----
  function bufferedName() { return player._buffer ? player._buffer.name : null; }
  function bufferIs(n) { return player._buffer && player._buffer.name === n; }
  function clearBuffer() { player._buffer = null; }
  function consumeBuffer() {
    if (!player._buffer) return;
    const n = player._buffer.name;
    if (tryAction(n)) clearBuffer();
  }

  // ---- 命中字段衰减(玩家自身消费 flashT/squashT/staggerT)----
  function decayHitFields(dt, skipSelfFreeze) {
    player.flashT   = Math.max(0, player.flashT - dt);
    player.squashT  = Math.max(0, player.squashT - dt * 6);
    player.staggerT = Math.max(0, player.staggerT - dt * 2.2);
    if (!skipSelfFreeze) player.selfFreeze = Math.max(0, player.selfFreeze - 0.016);
  }

  // ---- 残影 + 尘土更新 ----
  function updateGhostsAndDust(dt) {
    for (const g of player.ghosts) g.t += dt;
    for (let i = player.ghosts.length - 1; i >= 0; i--) {
      if (player.ghosts[i].t > 0.25) player.ghosts.splice(i, 1);
    }
    for (const d of player.dust) {
      d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 600 * dt;
    }
    for (let i = player.dust.length - 1; i >= 0; i--) {
      if (player.dust[i].t > player.dust[i].life) player.dust.splice(i, 1);
    }
  }

  function spawnDust() {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + (i / (n - 1)) * Math.PI;   // 半圆向上铺开
      const sp = 60 + Math.random() * 80;
      player.dust.push({
        x: player.x, y: GROUND,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 40,
        t: 0, life: 0.35, size: 2 + Math.random() * 3,
      });
    }
  }

  // ============================ 绘制 ============================
  function draw(ctx) {
    // 残影(翻滚)
    for (const g of player.ghosts) {
      const a = (1 - g.t / 0.25) * 0.4;
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      drawBody(ctx, g.x, g.y, g.facing, true, 0);
      ctx.restore();
    }

    drawBody(ctx, player.x, player.y, player.facing, false, 0);

    // 尘土
    for (const d of player.dust) {
      ctx.globalAlpha = 1 - d.t / d.life;
      ctx.fillStyle = '#b8a890';
      ctx.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
    }
    ctx.globalAlpha = 1;
  }

  // 绘制本体(精灵 + 剑),ghost=true 时用白色剪影做残影
  function drawBody(ctx, px, py, facing, ghost) {
    const d = player;
    const dead = !d.alive;
    const attacking = d.attackT >= 0;
    const t = attacking ? Math.min(d.attackT, 1) : -1;

    // selfFreeze 抖动
    const jx = d.selfFreeze > 0 ? (Math.random() * 2 - 1) * 1.6 : 0;
    const jy = d.selfFreeze > 0 ? (Math.random() * 2 - 1) * 1.2 : 0;

    // idle 呼吸
    const bob = (!attacking && d.dodgeT < 0 && grounded() && !dead)
      ? Math.sin(performance.now() / 1000 * 3) * 1.5 : 0;

    ctx.save();
    // 锚点:玩家脚在 y,身体中心在 y - h/2
    ctx.translate(px + jx, py - d.h / 2 + bob + jy);

    // 影子(贴地,世界坐标 → 反推回脚下)
    if (!ghost) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      const airLift = Math.max(0, GROUND - py);
      ctx.beginPath();
      ctx.ellipse(0, d.h / 2 + 4 + airLift, 18 - airLift * 0.03, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 死亡:躺地旋转
    if (dead) ctx.rotate(facing * 1.45);

    // 翻滚:整体旋转 360° + 微挤压
    if (d.dodgeT >= 0 && !ghost) {
      const p = d.dodgeT / DODGE_DUR;
      ctx.rotate(facing * p * Math.PI * 2);
      const q = Math.sin(p * Math.PI) * 0.12;
      ctx.scale(1 + q, 1 - q);
    }

    // squashT(受击挤压)
    if (d.squashT > 0 && !dead) {
      const q = Math.sin(d.squashT * Math.PI) * 0.18;
      ctx.scale(1 + q, 1 - q);
    }
    // staggerT(受击后仰)
    if (d.staggerT > 0 && !dead) ctx.rotate(d.staggerT * 0.14);

    // 镜像整个身体(剑数学是右手系,镜像整体即可)
    ctx.scale(facing, 1);

    // 攻击前冲:挥砍时身体微突进
    const lunge = t < 0 ? 0 : Math.sin(t * Math.PI) * 10;
    ctx.translate(lunge, 0);

    // ---- 身体精灵 ----
    if (sprites.ready) {
      const flashing = d.flashT > 0;
      const img = (flashing || ghost) ? sprites.knightWhite : sprites.knight;
      // 64×96 viewBox → 绘制成 60×90,脚对齐到 h/2
      ctx.drawImage(img, -30, -d.h / 2 - 18, 60, 90);
    } else {
      ctx.fillStyle = (d.flashT > 0 || ghost) ? '#ffffff' : '#4d7fc4';
      ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
    }

    // ---- 剑(canvas 绘制,绕肩枢轴旋转,移植 juice-lab drawPlayer)----
    drawSword(ctx, t, d.attackKind, d.swingStage);

    ctx.restore();
  }

  // 剑:idle 扛肩;挥砍按段位走不同弧。枢轴在右肩(本地坐标 w/2-2, -h/2+16)。
  function drawSword(ctx, t, kind, stage) {
    const d = player;
    const px = d.w / 2 - 2;
    const py = -d.h / 2 + 16;

    let angle;
    if (t < 0) {
      angle = -2.45;   // idle 扛肩
    } else if (kind === 'launcher') {
      // 挑空:由下向上猛挑
      angle = 1.2 - t * 3.6;
    } else if (kind === 'air') {
      if (stage < 2) angle = -1.0 + t * 2.2;   // 空中快斩:横扫
      else angle = -2.6 + t * 3.0;             // 下劈收尾:高举猛劈
    } else {
      // 地面四连四套挥法(移植 juice-lab)
      angle =
        stage === 1 ? (0.72 - t * 2.85)                       // 上撩
        : stage === 2 ? (-1.05 + Math.sin(t * Math.PI) * 0.12) // 突刺(横持)
        : stage === 3 ? (-2.75 + t * 3.4)                     // 大上段
        : (-2.1 + t * 2.75);                                  // 基础下劈
    }

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);

    // 挥砍轨迹残影(攻击中段)
    if (t > 0.3 && t < 0.95) {
      ctx.fillStyle = 'rgba(207,214,228,0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, 52, -1.2, 0.5);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
    }

    // 剑身
    ctx.fillStyle = '#dfe6f2';
    ctx.fillRect(-2.5, -52, 5, 52);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2.5, -52, 2, 52);   // 刃高光
    ctx.fillStyle = '#caa84e';
    ctx.fillRect(-8, -2, 16, 4);      // 护手
    ctx.fillStyle = '#8a6d3b';
    ctx.fillRect(-2.5, 2, 5, 10);     // 柄
    ctx.restore();
  }

  return player;
}
