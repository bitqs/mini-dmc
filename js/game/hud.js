// js/game/hud.js — in-game HUD: HP bar, wave indicator, control hints
// Call order in main.js: hud.draw(ctx) → style.drawHUD(ctx) → enc.draw(ctx)

const MOBILE_MQ = typeof window !== 'undefined'
  ? window.matchMedia('(max-width: 768px)')
  : null;

function isMobile() {
  return MOBILE_MQ ? MOBILE_MQ.matches : false;
}

/**
 * createHud({ getPlayer, manager, style, enc })
 *   getPlayer — fn returning current player (holder pattern)
 *   manager   — enemy manager (not directly used, but kept for future)
 *   style     — style scoring system
 *   enc       — encounter state machine
 */
export function createHud({ getPlayer, manager, style, enc }) {
  let lastHp = -1;          // last known HP; initialized on first draw
  let flashT = 0;           // HP-drop white flash timer (seconds)
  const FLASH_DUR = 0.15;

  function draw(ctx) {
    const player = getPlayer();

    // ---- init lastHp on first draw ----
    if (lastHp < 0) lastHp = player.hp;

    // ---- detect HP drop ----
    if (player.hp < lastHp) {
      flashT = FLASH_DUR;
    }
    lastHp = player.hp;

    // ---- decay flash ----
    // (We don't have dt here, so approximate via rAF ~16ms)
    if (flashT > 0) flashT = Math.max(0, flashT - 0.016);

    // ==============================
    // 1. HP bar — top-left
    // ==============================
    const BAR_X = 12, BAR_Y = 12;
    const BAR_W = 220, BAR_H = 14;

    // Dark frame
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(BAR_X - 1, BAR_Y - 1, BAR_W + 2, BAR_H + 2);

    // Gauge bg
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);

    // Gauge fill: green above 35%, red below
    const pct = Math.max(0, player.hp / player.maxHp);
    const fillColor = pct > 0.35 ? '#3ddc84' : '#e03030';
    ctx.fillStyle = fillColor;
    ctx.fillRect(BAR_X, BAR_Y, Math.round(BAR_W * pct), BAR_H);

    // White flash overlay on HP drop
    if (flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(flashT / FLASH_DUR) * 0.55})`;
      ctx.fillRect(BAR_X, BAR_Y, Math.round(BAR_W * pct), BAR_H);
    }

    // "HP" label
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('HP', BAR_X + 4, BAR_Y + BAR_H - 2);

    // HP number
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`${player.hp}/${player.maxHp}`, BAR_X + BAR_W - 2, BAR_Y + BAR_H - 2);

    // ==============================
    // 2. Wave indicator — top-center
    //    only during 'intro' or 'fight'
    // ==============================
    if (enc.state === 'intro' || enc.state === 'fight') {
      ctx.font = '700 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,211,77,0.8)';
      ctx.fillText(`WAVE ${enc.wave}/3`, 400, 20);
    }

    // ==============================
    // 3. Controls hint — bottom-left, desktop only
    // ==============================
    if (!isMobile()) {
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(136,136,160,0.55)';
      ctx.fillText('A/D move  W jump  J attack  K dodge  W+J launcher', 10, 440);
    }
  }

  return { draw };
}
