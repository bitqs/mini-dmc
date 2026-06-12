// js/game/encounter.js — 3-wave encounter state machine
// States: intro → fight → (next intro | cleared → result) | dead
// Accepts: { player, manager, style, time, onRestart }

import { sfx } from '../core/audio.js';
import { W, H } from '../core/loop.js';

// Wave spawn tables: each entry is [kind, x]
const WAVES = [
  [ ['grunt', 560], ['grunt', 700] ],
  [ ['grunt', 560], ['grunt', 700], ['ranger', 740] ],
  [ ['grunt', 540], ['ranger', 740], ['heavy', 640], ['grunt', 700] ],
];

// Room-rank thresholds (totalPoints)
const ROOM_RANK_THRESHOLDS = [
  { min: 3000, ch: 'SSS', color: '#ff5d5d', glow: true },
  { min: 2200, ch: 'SS',  color: '#ff9d3c', glow: false },
  { min: 1600, ch: 'S',   color: '#ffd34d', glow: false },
  { min: 1100, ch: 'A',   color: '#5dff8f', glow: false },
  { min:  700, ch: 'B',   color: '#5dc8ff', glow: false },
  { min:  400, ch: 'C',   color: '#9fb4d0', glow: false },
  { min:    0, ch: 'D',   color: '#8888a0', glow: false },
];

function getRoomRank(pts) {
  for (const r of ROOM_RANK_THRESHOLDS) {
    if (pts >= r.min) return r;
  }
  return ROOM_RANK_THRESHOLDS[ROOM_RANK_THRESHOLDS.length - 1];
}

export function createEncounter({ player: playerRef, manager, style, time, onRestart }) {
  // Mutable player reference holder — onRestart may swap the player object
  let player = playerRef;

  const enc = {
    state: 'intro',     // 'intro' | 'fight' | 'cleared' | 'result' | 'dead'
    wave: 1,
    elapsed: 0,         // fight time only

    _introT: 0,
    _clearedT: 0,
    _resultSfxPlayed: false,
    _resultSlam: 0,     // scale-punch progress 0..1 for room rank letter
    _wavesfxPlayed: false,

    update,
    draw,
  };

  function spawnWave(w) {
    manager.list.length = 0;
    manager.projectiles.length = 0;
    const table = WAVES[w - 1];
    for (const [kind, x] of table) {
      manager.spawn(kind, x);
    }
  }

  function startIntro(w) {
    enc.wave = w;
    enc.state = 'intro';
    enc._introT = 0;
    enc._wavesfxPlayed = false;
  }

  function update(dt) {
    // Regardless of state, update player reference (may have been swapped by onRestart)
    // (player is captured via closure; updated by reassignment from outside via enc._setPlayer)

    switch (enc.state) {
      case 'intro': {
        if (!enc._wavesfxPlayed) {
          sfx('wave');
          enc._wavesfxPlayed = true;
        }
        enc._introT += dt;
        if (enc._introT >= 1.0) {
          spawnWave(enc.wave);
          enc.state = 'fight';
        }
        break;
      }

      case 'fight': {
        // Check player death first
        if (!player.alive) {
          enc.state = 'dead';
          break;
        }

        enc.elapsed += dt;

        if (manager.allDead()) {
          if (enc.wave < 3) {
            startIntro(enc.wave + 1);
          } else {
            // All 3 waves done
            enc.state = 'cleared';
            enc._clearedT = 0;
            time.slowmo(0.25, 1.0);
          }
        }
        break;
      }

      case 'cleared': {
        enc._clearedT += dt;
        if (enc._clearedT >= 1.0) {
          enc.state = 'result';
          enc._resultSfxPlayed = false;
          enc._resultSlam = 0;
        }
        break;
      }

      case 'result': {
        if (!enc._resultSfxPlayed) {
          sfx('result');
          enc._resultSfxPlayed = true;
        }
        // Slam-in animation
        if (enc._resultSlam < 1) {
          enc._resultSlam = Math.min(1, enc._resultSlam + dt * 4);
        }
        break;
      }

      case 'dead': {
        // Waiting for restart input — handled by input listener
        break;
      }
    }
  }

  function draw(ctx) {
    switch (enc.state) {
      case 'intro':
        drawIntro(ctx);
        break;
      case 'result':
        drawResult(ctx);
        break;
      case 'dead':
        drawDead(ctx);
        break;
      // fight / cleared: no overlay (cleared does slowmo but no UI text)
    }
  }

  function drawIntro(ctx) {
    // Semi-transparent dark overlay
    ctx.save();
    const p = Math.min(1, enc._introT * 4);   // fade in quickly
    ctx.globalAlpha = 0.55 * p;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // WAVE N big center text
    const textAlpha = p;
    ctx.globalAlpha = textAlpha;
    ctx.textAlign = 'center';

    // Shadow / outline
    ctx.font = 'italic bold 72px monospace';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 8;
    ctx.strokeText(`WAVE ${enc.wave}`, W / 2, H / 2 + 12);

    ctx.fillStyle = '#ffd34d';
    ctx.fillText(`WAVE ${enc.wave}`, W / 2, H / 2 + 12);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawResult(ctx) {
    // Dark overlay
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#05040f';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    const cx = W / 2;
    const cy = H / 2;

    // Title
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#ffd34d';
    ctx.fillText('MISSION COMPLETE', cx, cy - 110);

    // TIME
    const totalSec = Math.floor(enc.elapsed);
    const mm = String(Math.floor(totalSec / 60)).padStart(1, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    ctx.font = '18px monospace';
    ctx.fillStyle = '#ccd5f0';
    ctx.fillText(`TIME  ${mm}:${ss}`, cx, cy - 70);

    // MAX COMBO
    ctx.fillText(`MAX COMBO  ${style.maxCombo}`, cx, cy - 44);

    // STYLE PTS
    ctx.fillText(`STYLE PTS  ${Math.round(style.totalPoints)}`, cx, cy - 18);

    // Room rank letter slam-in
    const rr = getRoomRank(style.totalPoints);
    const slam = enc._resultSlam;
    // Scale punch: overshoot then settle
    const scaleVal = slam < 0.7
      ? 0.01 + (slam / 0.7) * 2.2
      : 2.2 - ((slam - 0.7) / 0.3) * 1.2;  // settle at 1.0
    const finalScale = Math.max(scaleVal, 0.01);

    ctx.save();
    ctx.translate(cx, cy + 45);
    ctx.scale(finalScale, finalScale);
    ctx.font = 'italic bold 64px monospace';
    ctx.textAlign = 'center';

    if (rr.glow) {
      // SSS: golden glow
      ctx.shadowColor = rr.color;
      ctx.shadowBlur = 28;
    }
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.strokeText(rr.ch, 0, 0);
    ctx.fillStyle = rr.color;
    ctx.fillText(rr.ch, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Restart hint
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(200,210,240,0.6)';
    ctx.fillText('press any key / tap to restart', cx, cy + 120);

    ctx.restore();
  }

  function drawDead(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // Desaturate slightly: draw gray tint
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#888';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.font = 'italic bold 64px monospace';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 8;
    ctx.strokeText('YOU DIED', W / 2, H / 2 + 12);
    ctx.fillStyle = '#cc3333';
    ctx.fillText('YOU DIED', W / 2, H / 2 + 12);

    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(200,210,240,0.6)';
    ctx.fillText('press any key / tap to restart', W / 2, H / 2 + 60);

    ctx.restore();
  }

  // Called internally when restart is triggered
  function doRestart() {
    // Reset encounter state
    enc.wave = 1;
    enc.elapsed = 0;
    enc._introT = 0;
    enc._clearedT = 0;
    enc._resultSfxPlayed = false;
    enc._resultSlam = 0;
    enc._wavesfxPlayed = false;

    // Clear enemies
    manager.list.length = 0;
    manager.projectiles.length = 0;

    // Reset style
    style.reset();

    // Rebuild player via callback — main.js provides this
    player = onRestart();

    // Go to intro for wave 1
    enc.state = 'intro';
  }

  // Allow main.js to update the player reference (after onRestart rebuilds it)
  enc._setPlayer = (p) => { player = p; };

  // Restart input: keydown or canvas pointerdown in result/dead state
  window.addEventListener('keydown', (e) => {
    if (enc.state === 'result' || enc.state === 'dead') {
      doRestart();
    }
  });

  const canvas = document.getElementById('game');
  if (canvas) {
    canvas.addEventListener('pointerdown', () => {
      if (enc.state === 'result' || enc.state === 'dead') {
        doRestart();
      }
    });
  }

  return enc;
}
