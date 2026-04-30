# Math & Music Festival

> A collection hub for interactive experiments at the intersection of mathematics, music, AI, computer vision, and creative coding.

[中文说明](#中文说明)

## Demo

- Live demo: not published yet
- Local demo: serve the repository root and open `index.html`
- Media to add: one overview screenshot showing the project cards, plus one image/GIF for each sub-project

## Overview

Math & Music Festival is a showcase repository that gathers multiple small browser experiments. Each project explores a different way of turning mathematical structure into visual or musical interaction: fractals, functions, Chladni patterns, kaleidoscopes, hand tracking, Euclidean rhythm, and Whitney-style audiovisual motion.

This repository acts as a public collection hub for the broader Electro-Dig practice: electronic music archaeology, mathematical music, embodied interfaces, and AI-assisted creative coding.

## Included Projects

| Project | Concept | Status |
|---|---|---|
| Pythagoras Fractal Tree | Geometric fractal tree generated through recursive scaling and rotation | Prototype |
| Function Dance | Mathematical functions rendered as choreographic visual motion | Prototype |
| Chladni Plate Simulator | Standing-wave / Chladni-figure visual simulation | Prototype |
| Hand & Music 2x2 | Gesture-controlled Euclidean rhythm and harmony instrument | Active prototype |
| Camera Kaleidoscope | Webcam-based real-time kaleidoscope visualizer | Prototype |
| Hands Whitney | Whitney-style audiovisual instrument driven by hand tracking | Active prototype |

## Relationship to Standalone Repositories

Some projects in this collection also exist as standalone repositories for focused development and presentation:

- [`hand-music-2x2`](https://github.com/Electro-Dig/hand-music-2x2)
- [`handswhitney`](https://github.com/Electro-Dig/handswhitney)

This repository should be treated as the festival map / collection entrance, while standalone repositories can contain deeper documentation and project-specific development history.

## How to Run

For the collection landing page:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Most sub-projects are static HTML / JS / CSS experiments and can be opened through the landing page. Projects using camera access should be served from `localhost` or HTTPS instead of direct `file://` URLs.

## Suggested Documentation Additions

- Add a screenshot or GIF for every project card
- Add live demo URLs once deployment is ready
- Add a short note explaining the mathematical idea behind each project
- Mark which projects are standalone and which are only collection demos
- Add credits and source notes for algorithms, references, audio samples, or images

## Project Status

Collection hub / active archive.

## License

No license has been specified yet.

---

# 中文说明

> 一个数学、音乐、AI、计算机视觉与 creative coding 交叉实验的合集入口。

## 演示

- 在线演示：暂未发布
- 本地演示：在仓库根目录启动静态服务器并打开 `index.html`
- 建议补充素材：一张展示项目卡片的总览截图，以及每个子项目各一张截图或 GIF

## 项目概述

Math & Music Festival 是一个展示型合集仓库，聚合了多个小型浏览器实验。每个项目都在探索如何把数学结构转化为视觉或音乐交互：分形、函数、克拉德尼图形、万花筒、手势识别、欧几里得节奏和 Whitney 风格视听运动。

这个仓库更像 Electro-Dig 实践的公开展览入口：电子音乐考古、数学音乐、身体化界面和 AI 辅助 creative coding。

## 包含项目

| 项目 | 概念 | 状态 |
|---|---|---|
| 毕达哥拉斯分形树 | 通过递归缩放与旋转生成几何分形树 | 原型 |
| 函数舞蹈 | 将数学函数渲染为舞蹈般的视觉运动 | 原型 |
| 克拉德尼板模拟器 | 驻波 / 克拉德尼图形视觉模拟 | 原型 |
| Hand & Music 2x2 | 手势控制的欧几里得节奏与和声乐器 | 活跃原型 |
| Camera Kaleidoscope | 基于摄像头的实时万花筒视觉工具 | 原型 |
| Hands Whitney | 由手势控制的 Whitney 风格视听乐器 | 活跃原型 |

## 与独立仓库的关系

合集中的部分项目也有独立仓库，用于更聚焦的开发与展示：

- [`hand-music-2x2`](https://github.com/Electro-Dig/hand-music-2x2)
- [`handswhitney`](https://github.com/Electro-Dig/handswhitney)

本仓库建议作为 festival map / collection entrance；独立仓库则负责更深入的说明、开发记录和项目文档。

## 本地运行

运行合集首页：

```bash
python -m http.server 8000
```

然后打开：

```text
http://localhost:8000
```

大多数子项目是静态 HTML / JS / CSS 实验，可以通过首页进入。需要摄像头权限的项目建议通过 `localhost` 或 HTTPS 访问，而不是直接用 `file://` 打开。

## 建议继续补充的文档

- 为每个项目卡片添加截图或 GIF
- 部署完成后添加 live demo URL
- 为每个项目补充一句数学 / 音乐原理说明
- 标明哪些项目是独立仓库，哪些只是合集 demo
- 补充算法、参考资料、音频样本或图片素材的 credits / source notes

## 项目状态

合集入口 / 活跃档案。

## License

暂未指定 license。