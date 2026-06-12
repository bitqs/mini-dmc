// WebAudio 合成音效,零音频文件。
// 分层哲学(Vlambeer GDC 2013):重击 = 低频;轻击 = 中频短促;击杀 = 下扫收尾。

let ac = null;

function ctx() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(a, t, type, f0, f1, dur, gain) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

function noise(a, t, dur, gain) {
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  const g = a.createGain();
  src.buffer = buf;
  g.gain.value = gain;
  src.connect(g).connect(a.destination);
  src.start(t);
}

export function sfx(kind) {
  const a = ctx();
  const t = a.currentTime;
  const pv = 0.92 + Math.random() * 0.16;   // 音调随机 ±8%:每刀不重样(Vlambeer)

  if (kind === 'hit') {
    // 中频三角波 60ms,带一点点噪声脆感
    tone(a, t, 'triangle', 320 * pv, 180 * pv, 0.06, 0.25);
    noise(a, t, 0.03, 0.08);
  } else if (kind === 'crit') {
    // 低频方波 120ms + 噪声 — "重"在低频
    tone(a, t, 'square', 140 * pv, 70 * pv, 0.12, 0.35);
    noise(a, t, 0.06, 0.18);
  } else if (kind === 'kill') {
    // 下扫 200ms:从 400Hz 滑到 40Hz,终结感
    tone(a, t, 'sawtooth', 400, 40, 0.2, 0.3);
    noise(a, t, 0.1, 0.2);
  } else if (kind === 'whiff') {
    // 挥空:闷风声,明显比命中"空"
    noise(a, t, 0.09, 0.12);
    tone(a, t, 'sine', 220, 140, 0.08, 0.06);
  } else if (kind === 'hurt') {
    // 玩家受击:低沉闷击,正弦 90→50Hz 180ms + 短噪声
    tone(a, t, 'sine', 90 * pv, 50 * pv, 0.18, 0.4);
    noise(a, t, 0.06, 0.15);
  } else if (kind === 'launch') {
    // 挑空上升:锯齿 200→700Hz 200ms
    tone(a, t, 'sawtooth', 200 * pv, 700 * pv, 0.2, 0.25);
  } else if (kind === 'dodge') {
    // 闪避:短促气流 + 三角波下扫
    noise(a, t, 0.06, 0.15);
    tone(a, t, 'triangle', 600 * pv, 300 * pv, 0.05, 0.08);
  } else if (kind === 'wave') {
    // 波次提示:三个上升音调
    tone(a, t,        'square', 330, 330, 0.09, 0.2);
    tone(a, t + 0.10, 'square', 440, 440, 0.09, 0.2);
    tone(a, t + 0.20, 'square', 550, 550, 0.09, 0.2);
  } else if (kind === 'result') {
    // 结算和弦琶音:正弦 C4/E4/G4/C5
    tone(a, t,        'sine', 262, 262, 0.12, 0.25);
    tone(a, t + 0.09, 'sine', 330, 330, 0.12, 0.25);
    tone(a, t + 0.18, 'sine', 392, 392, 0.12, 0.25);
    tone(a, t + 0.27, 'sine', 523, 523, 0.12, 0.25);
  }
}
