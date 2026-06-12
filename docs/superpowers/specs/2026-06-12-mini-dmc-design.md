# Mini-DMC 设计文档

2026-06-12 · 用户已确认(选项 A:独立新项目)

## 目标

复刻《鬼泣》核心战斗体验的侧视动作小游戏。juice-lab 是"打击感博物馆",
mini-dmc 是用那些研究**真打一场**:连击/挑空/空中连段/闪避/风格评价/房间战。

## 栈与约束

- vanilla JS + Canvas 2D,零依赖,ES modules,无构建(沿用 juice-lab 栈)
- 固定时间步(1/60 累积器)— 手感参数确定性
- juice-lab 的 18 层打击感经验作为 **fx 引擎层** 移植,全部常开(游戏,不是开关教学)
- SVG 内联精灵(juice-lab 同款管线:svgToImage + 白/暗变体)
- 视角:侧视卷轴(DMC1 维度),不做过肩
- 中文 UI 优先(给自媒体物料),i18n 后置

## DMC 核心循环(v1 范围)

1. **玩家**:左右移动、跳跃、地面 4 连击(下劈/上撩/突刺/大上段)、
   **挑空 Launcher**(↑+攻击,敌人浮空)、**空中连段 Aerial Rave**(浮空追打)、
   **闪避翻滚**(i-frames 无敌帧)、输入缓冲 150ms
2. **敌人 3 种**:杂兵 Grunt(走近+前摇明显的挥击)、远程 Ranger(保持距离+弹道)、
   重甲 Heavy(慢、霸体无硬直、大前摇重击)
3. **AI 令牌制**(DMC 暗规则):同一时刻最多 1 个敌人真正进攻,其余游走包围
4. **房间战**:3 波遭遇(2杂兵 → 杂兵+远程 → 杂兵+远程+重甲)→ 清场 → 结算
5. **Style Meter**:D→SSS 实时段位(移植 juice-lab),多样性给分,挨打掉分;
   结算画面按累计风格分给房间评级(DMC 招牌)
6. **玩家有血条**:挨打掉血,死亡重开本房 — 闪避才有意义

## 操作

| 键 | 动作 |
|---|---|
| A/D | 移动 |
| W 或 ↑ | 跳跃 |
| J 或 Space | 攻击(地面连/空中连/W+J=挑空) |
| K 或 Shift | 闪避翻滚(i-frames 300ms) |
| 手机 | 屏幕按钮:◀ ▶ · JMP · ATK · DGE |

## 架构(分层,文件即模块)

```
index.html / style.css      街机控制台视觉语言(juice-lab 同款)
js/core/loop.js             固定时间步主循环 + time 全局(freeze/slowmo/shake/kick/tilt/zoom)
js/core/fx.js               钩子注册表 + 打击感模块(闪白/双层顿帧/击退挤压/数字/贴片/粒子/屏震/音效)
js/core/audio.js            WebAudio 合成(命中三档+挥空+受击+死亡+结算)
js/core/sprites.js          SVG 精灵:骑士 + 杂兵/远程/重甲 + 变体
js/game/player.js           玩家状态机(地面/空中/连击/挑空/闪避)
js/game/enemies.js          3 敌人 AI + 令牌调度器
js/game/encounter.js        波次/房间状态机(intro→fight→cleared→result)
js/game/style.js            风格评价 + 房间评级
js/game/hud.js              血条/段位/波次/结算画面/手机按钮
js/main.js                  接线
```

## 实体契约(fx 模块依赖,全游戏统一)

```js
entity = { x, y, vx, vy, w, h, hp, maxHp, alive, facing,
           flashT, squashT, staggerT, selfFreeze,        // fx 写入
           airborne, dy,                                  // 浮空(挑空用)
           kind }                                         // 'player'|'grunt'|'ranger'|'heavy'
```

fx 钩子:onHit{target,dmg,crit,kill,dir,melee} / onKill{target,dir} / onWhiff /
onUpdate{dt} / onDraw{ctx}(screen:true = 屏幕空间)。

## 不做(YAGNI)

- 武器切换/枪(DMC 双武器后置 v2)
- 商店/技能树/红魂经济
- 多房间地图,Boss
- 存档
- 过肩 3D

## 成功标准

- 一套"挑空→空中三连→落地接地面连"能打出来,手感对(顿帧/缓冲/取消窗口)
- 敌人令牌制让 5 敌同屏也不觉得围殴不公平
- 清房结算 SSS 时有"打得漂亮"的确认感
- 手机可玩,60fps
