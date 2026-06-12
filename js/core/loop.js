// js/core/loop.js — 固定步长主循环 + 全局时间控制
// 下游任务依赖这里的导出名称,不要改字段名

export const W = 800, H = 450, GROUND = 360;

export const time = {
  freezeLeft: 0,       // 顿帧剩余秒(真实时间)
  scale: 1,            // 慢动作倍率(<1 慢)
  scaleLeft: 0,        // 慢动作剩余真实秒
  overload: 1,         // 过载倍率(预留)
  shake: { mag: 0, decay: 0, x: 0, y: 0 },
  kick: { x: 0, y: 0 },
  tilt: 0,
  zoom: { v: 1, cx: 400, cy: 225 },

  freeze(sec) { this.freezeLeft = Math.max(this.freezeLeft, sec); },
  slowmo(factor, sec) { this.scale = factor; this.scaleLeft = sec; },
};

// startLoop: 固定步长 1/60s,最多追 4 步避免死亡螺旋
// update(dt) 仍在顿帧期间每步调用,但 dt=0
// draw(ctx) 每 rAF 调用一次,ctx 已应用镜头变换
export function startLoop({ update, draw }) {
  // DOM 访问在函数内部,import 时不触发
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const FIXED_DT = 1 / 60;
  const MAX_STEPS = 4;

  let last = performance.now();
  let acc = 0;

  function frame(now) {
    const realDt = Math.min((now - last) / 1000, 0.1); // 限幅防调试器卡死
    last = now;

    // 屏震:真实时间衰减,不受顿帧影响
    const sh = time.shake;
    if (sh.mag > 0.15) {
      sh.x = (Math.random() * 2 - 1) * sh.mag;
      sh.y = (Math.random() * 2 - 1) * sh.mag;
      sh.mag *= Math.exp(-realDt / (sh.decay * 0.45 || 0.001));
    } else if (sh.mag !== 0) {
      sh.x = sh.y = 0; sh.mag = 0;
    }

    // 镜头后坐 + 荷兰角:真实时间衰减
    time.kick.x *= Math.exp(-realDt * 14);
    time.kick.y *= Math.exp(-realDt * 14);
    time.tilt   *= Math.exp(-realDt * 9);

    // 慢动作计时(真实时间)
    if (time.scaleLeft > 0) {
      time.scaleLeft -= realDt;
      if (time.scaleLeft <= 0) { time.scaleLeft = 0; time.scale = 1; }
    }

    // 固定步长追帧
    acc += realDt;
    let steps = 0;
    while (acc >= FIXED_DT && steps < MAX_STEPS) {
      let dt = FIXED_DT;

      // 顿帧:本步消耗真实时间,游戏 dt=0
      if (time.freezeLeft > 0) {
        time.freezeLeft -= FIXED_DT;
        dt = 0;
      } else {
        dt *= time.scale; // 慢动作缩放游戏 dt
      }

      update(dt);
      acc -= FIXED_DT;
      steps++;
    }

    // 绘制:每 rAF 一次,应用镜头变换
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // 1. 屏震 + 镜头后坐
    ctx.translate(sh.x + time.kick.x, sh.y + time.kick.y);

    // 2. 荷兰角(绕画面中心)
    if (Math.abs(time.tilt) > 0.0005) {
      ctx.translate(400, 225);
      ctx.rotate(time.tilt);
      ctx.translate(-400, -225);
    }

    // 3. 急推变焦
    const z = time.zoom;
    if (z.v !== 1) {
      ctx.translate(z.cx, z.cy);
      ctx.scale(z.v, z.v);
      ctx.translate(-z.cx, -z.cy);
    }

    draw(ctx);
    ctx.restore();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
