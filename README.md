# mini-dmc

**🎮 Play online / 在线体验:<https://mini-dmc.shuangqu.workers.dev>**

**EN** A bite-sized open-source game that recreates the core combat loop of Devil May Cry — ground combos, launchers, aerial juggles, dodge i-frames, and a DMC-style style-gauge ranking system — built entirely in vanilla JS + Canvas.

**ZH** 复刻鬼泣核心循环的开源小游戏：地面四连、挑空、空中三连收尾下劈、翻滚无敌帧，以及完整的 Style 评分系统，纯原生 JS + Canvas 实现，零依赖。

---

## Controls / 操作

| Action / 动作 | Keyboard / 键盘 | Mobile / 手机 |
|---|---|---|
| Move left/right | A / D or ←/→ | ◀ ▶ buttons |
| Jump | W or ↑ | JMP |
| Attack (combo) | J or Space | ATK |
| Launcher (up + attack) | W + J | Hold JMP + tap ATK |
| Air combo | J (while airborne) | ATK (while airborne) |
| Dodge (i-frames) | K or Shift | DGE |
| Restart (after death/clear) | Any key | Tap canvas |

---

## Architecture / 代码结构

```
mini-dmc/
├── index.html          # canvas + touch button HTML
├── style.css           # arcade console aesthetic (dark, gold accent)
├── js/
│   ├── main.js         # game loop wiring, keyboard + touch input
│   ├── core/
│   │   ├── loop.js     # fixed-timestep rAF loop, camera shake/slowmo
│   │   ├── fx.js       # hit pipeline: onHit / onKill / onWhiff hooks
│   │   ├── audio.js    # Web Audio sfx (procedural)
│   │   └── sprites.js  # knight sprite loader
│   └── game/
│       ├── player.js   # player state machine (ground/air/dodge/hurt)
│       ├── enemies.js  # grunt / ranger / heavy AI + token system
│       ├── style.js    # DMC style gauge (D→SSS), combo counter, HUD
│       ├── encounter.js# 3-wave encounter FSM + result/dead screens
│       └── hud.js      # HP bar, wave indicator, controls hint
```

---

## Run locally / 本地运行

```bash
cd mini-dmc
python3 -m http.server 8080
# then open http://localhost:8080
```

No build step. No dependencies. Just a browser.

---

## Related projects / 相关项目

- **[juice-lab](https://github.com/bitqs/juice-lab)** — the FX engine this game ports: screen shake, hit-freeze, slowmo, damage numbers, particle trails. The combat feel comes from there.
- **[vs-anatomy](https://github.com/bitqs/vs-anatomy)** — a deep teardown of Vampire Survivors (14 design notes + GDD + 157 atomic mechanics). Informed the encounter pacing and kill-loop design.

---

## License

MIT
