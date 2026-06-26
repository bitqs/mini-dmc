# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

mini-dmc — 复刻《鬼泣》核心战斗循环的开源小游戏:地面四连、挑空、空中三连收尾下劈、
翻滚无敌帧 + 完整 Style 评分系统。**纯原生 JS + Canvas,零依赖,无 build step。**
Live: https://mini-dmc.shuangqu.workers.dev · repo `bitqs/mini-dmc`

## Run / deploy

静态站点 — 直接在浏览器打开 `index.html` 即可玩;部署到 Cloudflare Workers
(`*.shuangqu.workers.dev`)。没有 npm/构建流程,改 JS 即时生效。

## 注意

战斗手感是核心。改数值/帧数前先在浏览器实测打击感,别只看代码就说"好了"。
操作表见 README。
