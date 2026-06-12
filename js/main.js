import { startLoop, W, H, GROUND, time } from './core/loop.js';

// ---------- 测试场景状态 ----------
const box = {
  x: W / 2,
  y: GROUND - 40,   // 站在地面上
  w: 40,
  h: 40,
  vx: 200,          // 200px/s 左右弹跳
};

function update(dt) {
  box.x += box.vx * dt;
  // 弹墙
  if (box.x + box.w >= W) { box.x = W - box.w; box.vx = -200; }
  if (box.x <= 0)          { box.x = 0;          box.vx =  200; }
}

function draw(ctx) {
  // 夜色渐变背景
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#06060f');
  grad.addColorStop(1, '#0d0d20');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 地面线
  ctx.strokeStyle = '#ffd34d44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(W, GROUND);
  ctx.stroke();

  // 金色方块
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(box.x, box.y, box.w, box.h);
}

startLoop({ update, draw });

// 调试用:挂载到 window 供控制台验证
window.__game = { time };
