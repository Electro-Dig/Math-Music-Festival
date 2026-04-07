# Hand+Music 2x2 项目整合方案

## 项目概述

本项目旨在将手势识别技术与欧几里得音乐算法相结合，创建一个通过手势控制音乐生成和可视化的交互式应用。

### 核心组件

1. **手势识别基础** (来自 `arpeggiator-main`)
   - MediaPipe 手势跟踪
   - 手势状态识别（握拳、手指状态等）
   - 手部位置映射

2. **音乐与视觉反馈** (来自 `euclidean_delay.html` 和 `euclidean_xy_pad.html`)
   - 欧几里得算法生成节奏和和声模式
   - Canvas 2D 可视化渲染
   - Tone.js 音频合成与处理

---

## 技术架构分析

### 1. arpeggiator-main 项目结构

#### 核心文件
- **`game.js`** (1645 行)
  - `Game` 类：主要游戏/应用逻辑
  - MediaPipe HandLandmarker 初始化与处理
  - 手势检测方法：
    - `_isFist(landmarks)`: 检测握拳手势
    - `_getFingerStates(landmarks)`: 获取手指状态（张开/闭合）
  - 手部位置映射：将视频坐标转换为画布坐标
  - 平滑处理：使用 `smoothingFactor` 平滑手势数据

- **`MusicManager.js`** (487 行)
  - 音乐预设管理
  - 琶音器模式生成
  - Tone.js 音频合成器管理

- **`DrumManager.js`** (263 行)
  - 鼓机序列管理
  - 手指状态到鼓模式的映射

#### 手势识别关键代码位置

```javascript
// 手势检测流程 (game.js:720-867)
_updateHands() {
  // 1. 使用 HandLandmarker 检测手部
  results = this.handLandmarker.detectForVideo(video, time)
  
  // 2. 平滑处理 landmarks
  smoothedLandmarks = applySmoothing(currentRawLandmarks)
  
  // 3. 坐标映射：视频坐标 -> 画布坐标
  normX_visible, normY_visible = mapToCanvas(landmarks)
  
  // 4. 手势识别
  isFist = _isFist(smoothedLandmarks)  // 握拳检测
  fingerStates = _getFingerStates(smoothedLandmarks)  // 手指状态
  
  // 5. 控制音乐
  if (hand === 0) {
    // 控制音高和音量
    noteIndex = mapYToNote(normY_visible)
    velocity = calculatePinchDistance(thumbTip, indexTip)
  }
}
```

#### 关键方法提取清单

需要从 `arpeggiator-main/game.js` 提取的方法：

1. **MediaPipe 初始化** (约 line 660-715)
   - `FilesetResolver` 设置
   - `HandLandmarker.createFromOptions`
   - 视频流获取与处理

2. **手势检测方法** (约 line 1108-1197)
   - `_isFist(landmarks)`: 握拳检测
   - `_getFingerStates(landmarks)`: 手指状态检测
   - `_getVisibleVideoParameters()`: 视频参数计算

3. **坐标映射** (约 line 720-800)
   - 视频坐标到画布坐标的转换
   - 平滑处理算法

---

### 2. euclidean_delay.html 项目分析

#### 核心功能
- **XY Pad 交互**: 鼠标/触摸位置映射到音效参数
- **欧几里得算法**: 生成和声模式
- **延迟效果**: X 轴控制延迟时间，Y 轴控制和声复杂度
- **视觉反馈**: Canvas 绘制动画条、和声块、播放头

#### 关键代码结构

```javascript
// XY Pad 位置 (line 159)
padPos = { x: 0.5, y: 0.5 }

// 欧几里得算法 (line 166-175)
function generateEuclidean(events, length) {
  // 生成均匀分布的节奏/和声模式
}

// 音频效果更新 (line 177-188)
function updateAudioEffects() {
  // X 轴 -> 延迟时间
  delayTime = DELAY_TIMES[floor(padPos.x * DELAY_TIMES.length)]
  
  // Y 轴 -> 和声复杂度
  harmonyEvents = floor((1 - padPos.y) * (harmonyLength - 1)) + 1
  harmonyPattern = generateEuclidean(harmonyEvents, harmonyLength)
}

// 渲染循环 (line 198-294)
function draw(currentTime) {
  // 1. 更新动画状态
  // 2. 绘制背景标记
  // 3. 绘制和声块（左侧）
  // 4. 绘制动画条（延迟回声）
  // 5. 绘制 XY Pad 十字线
}
```

#### 可复用组件

1. **欧几里得算法生成器** (`generateEuclidean`)
2. **Canvas 渲染逻辑** (动画条、和声可视化)
3. **Tone.js 音频设置** (FeedbackDelay, PolySynth)

---

### 3. euclidean_xy_pad.html 项目分析

#### 核心功能
- **双轴控制**:
  - Y 轴：和声复杂度（向上 = 更多音符）
  - X 轴：节奏预设（9 种不同的欧几里得节奏模式）
- **录音循环功能**: ARM -> 按下鼠标开始录音 -> 释放停止并循环
- **视觉反馈**: 
  - 左侧：和声块堆叠显示
  - 主区域：节奏背景线、动画条
  - 底部：录音进度条

#### 关键代码结构

```javascript
// 节奏预设 (line 609-613)
const RHYTHM_PRESETS = [
  { e: 3, a: 1 },  // events, accents
  { e: 4, a: 1 },
  // ... 9 种预设
]

// 模式更新 (line 652-676)
function updatePatterns() {
  // Y 轴 -> 和声
  harmonyPattern = generateEuclidean(
    floor((1 - padPos.y) * (harmonyLength - 1)) + 1,
    harmonyLength
  )
  
  // X 轴 -> 节奏
  rhythmIndex = floor(padPos.x * RHYTHM_PRESETS.length)
  rhythmPattern = generateEuclidean(preset.e, RHYTHM_STEPS)
  
  // 重音模式
  accentEuclidean = generateEuclidean(preset.a, preset.e)
  velocityPattern = applyAccents(rhythmPattern, accentEuclidean)
}

// 录音循环 (line 632-951)
// 录音状态管理
isArmed, isRecording, isLooping
recordedLoop[]  // 存储每步的 padPos 和模式数据
```

#### 可复用组件

1. **双轴模式生成系统** (`updatePatterns`)
2. **录音循环逻辑** (ARM/Recording/Looping 状态机)
3. **节奏可视化** (背景线、动画条、播放头)

---

## 整合方案

### 方案概述

将手势识别替代鼠标输入，实现手势控制的欧几里得音乐生成器。

### 架构设计

```
┌─────────────────────────────────────┐
│   Hand Tracking Layer                │
│   (from arpeggiator-main/game.js)    │
│   - MediaPipe HandLandmarker         │
│   - Gesture Detection                │
│   - Coordinate Mapping               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   XY Pad Position Mapper             │
│   - Hand position → padPos (x, y)     │
│   - Gesture states → interaction modes│
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Euclidean Pattern Generator        │
│   (from euclidean_*.html)            │
│   - generateEuclidean()              │
│   - updatePatterns()                 │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌──────────────┐  ┌──────────────┐
│ Audio Engine │  │ Visual Engine │
│ (Tone.js)    │  │ (Canvas 2D)   │
└──────────────┘  ┌──────────────┘
```

### 整合步骤

#### 阶段 1: 手势识别模块提取

**目标**: 创建独立的手势识别模块

1. **创建 `HandTracker.js`**
   ```javascript
   class HandTracker {
     constructor(canvasElement, videoElement) {
       // MediaPipe 初始化
       // HandLandmarker 设置
     }
     
     async initialize()
     detectHands()  // 返回 landmarks
     isFist(landmarks)
     getFingerStates(landmarks)
     mapToCanvas(normalizedX, normalizedY)  // 坐标转换
   }
   ```

2. **提取的关键功能**:
   - MediaPipe 初始化逻辑
   - 手势检测方法 (`_isFist`, `_getFingerStates`)
   - 坐标映射 (`_getVisibleVideoParameters`, 视频→画布)

#### 阶段 2: XY Pad 映射层

**目标**: 将手势位置映射到 XY Pad 坐标

1. **创建 `GesturePadMapper.js`**
   ```javascript
   class GesturePadMapper {
     constructor(handTracker, canvas) {
       this.handTracker = handTracker
       this.canvas = canvas
       this.padPos = { x: 0.5, y: 0.5 }
     }
     
     update() {
       // 1. 获取手部位置
       const handPos = this.handTracker.getHandPosition(0) // 第一只手
       
       // 2. 映射到 padPos (0-1 范围)
       this.padPos.x = handPos.x / canvas.width
       this.padPos.y = handPos.y / canvas.height
       
       // 3. 手势状态处理
       if (this.handTracker.isFist(0)) {
         // 握拳 = 停止播放 (类似 mouseup)
       }
     }
     
     getPadPosition() { return this.padPos }
     isActive() { return this.handTracker.hasHand(0) }
   }
   ```

2. **手势到交互的映射**:
   - **握拳**: `isMouseDown = false` (停止播放)
   - **张开手**: `isMouseDown = true` (开始播放)
   - **手部移动**: 更新 `padPos`
   - **拇指-食指捏合**: 控制音量/反馈

#### 阶段 3: 整合欧几里得音乐逻辑

**目标**: 将手势控制的 padPos 输入到欧几里得音乐系统

1. **从 euclidean_xy_pad.html 提取**:
   - `generateEuclidean()` 函数
   - `updatePatterns()` 函数
   - 节奏预设数组
   - 录音循环状态机

2. **从 euclidean_delay.html 提取**:
   - 延迟效果控制逻辑
   - 动画条渲染
   - Tone.js FeedbackDelay 设置

3. **创建 `EuclideanMusicEngine.js`**
   ```javascript
   class EuclideanMusicEngine {
     constructor() {
       this.harmonyPattern = []
       this.rhythmPattern = []
       this.velocityPattern = []
     }
     
     updatePatterns(padPos, harmonyLength) {
       // 从 euclidean_xy_pad.html 的 updatePatterns() 逻辑
     }
     
     generateEuclidean(events, length) {
       // 欧几里得算法实现
     }
   }
   ```

#### 阶段 4: Canvas 可视化整合

**目标**: 将手势可视化与音乐可视化合并

1. **创建 `VisualRenderer.js`**
   ```javascript
   class VisualRenderer {
     constructor(canvas, harmonyLength) {
       this.canvas = canvas
       this.ctx = canvas.getContext('2d')
     }
     
     render(padPos, harmonyPattern, rhythmPattern, animatedBars, handPositions) {
       // 1. 绘制背景（从 euclidean_xy_pad）
       // 2. 绘制和声块（左侧）
       // 3. 绘制节奏背景线
       // 4. 绘制动画条
       // 5. 绘制 XY Pad 十字线（显示 padPos）
       // 6. 绘制手部位置指示器（可选）
     }
   }
   ```

2. **可选增强**:
   - 在画布上显示手部骨架（从 arpeggiator-main）
   - 显示手势状态标签（握拳、手指状态）

#### 阶段 5: 音频引擎整合

**目标**: 整合 Tone.js 音频处理

1. **创建 `AudioEngine.js`**
   ```javascript
   class AudioEngine {
     constructor() {
       this.synth = null
       this.delay = null  // 来自 euclidean_delay
       this.loop = null
     }
     
     async initialize() {
       await Tone.start()
       // 设置合成器和效果
     }
     
     triggerNotes(harmonyPattern, velocity, time) {
       // 触发音符
     }
     
     updateDelay(delayTime) {
       // 更新延迟效果（来自 euclidean_delay）
     }
   }
   ```

2. **音频消息系统**:
   - 使用 `window.parent.postMessage` 与宿主应用通信（如需要）
   - 或直接使用 Tone.js 本地合成

---

## 文件结构规划

```
hand+music 2x2/
├── index.html                 # 主 HTML 文件
├── README.md                  # 本文档
├── src/
│   ├── core/
│   │   ├── HandTracker.js     # 手势识别模块（从 arpeggiator-main）
│   │   ├── GesturePadMapper.js # 手势→XY Pad 映射
│   │   └── EuclideanEngine.js  # 欧几里得算法引擎
│   ├── audio/
│   │   ├── AudioEngine.js     # Tone.js 音频引擎
│   │   └── DelayProcessor.js   # 延迟效果处理器（来自 euclidean_delay）
│   ├── visual/
│   │   ├── VisualRenderer.js  # Canvas 渲染器
│   │   └── BarAnimation.js    # 动画条管理
│   └── main.js                # 主应用入口
├── styles/
│   └── main.css               # 样式文件
└── lib/                       # 外部库（如需要）
    └── tone.js                # Tone.js 库
```

---

## 关键技术决策

### 1. 手势输入替代鼠标输入

**替换映射**:
- `canvas.addEventListener('mousedown')` → `handTracker.isFist() === false && wasFist === true`
- `canvas.addEventListener('mousemove')` → `handTracker.update()` (持续跟踪)
- `window.addEventListener('mouseup')` → `handTracker.isFist() === true`

### 2. 坐标系统统一

- **手势坐标**: MediaPipe 返回归一化坐标 (0-1)
- **画布坐标**: Canvas 像素坐标
- **Pad 坐标**: 归一化 (0-1)，用于模式生成

**转换链**:
```
MediaPipe normalized (0-1)
  ↓
Canvas pixel coordinates
  ↓
Pad normalized (0-1)
  ↓
Pattern generation
```

### 3. 状态管理

使用状态机管理播放状态：

```javascript
const PlayState = {
  IDLE: 'idle',           // 未播放
  PLAYING: 'playing',   // 正在播放（手部检测到）
  RECORDING: 'recording', // 录音中
  LOOPING: 'looping'    // 循环播放录音
}
```

### 4. 平滑处理

- **手势数据平滑**: 使用 arpeggiator-main 的 `smoothingFactor`
- **Pad 位置平滑**: 避免突变，使用线性插值

---

## 实施优先级

### MVP (最小可行产品)

1. ✅ 手势识别基础（MediaPipe 初始化）
2. ✅ 手部位置映射到 XY Pad
3. ✅ 欧几里得算法生成和声模式
4. ✅ 基础 Canvas 可视化
5. ✅ Tone.js 音符触发

### Phase 2 (增强功能)

1. 延迟效果控制（euclidean_delay 功能）
2. 录音循环功能（euclidean_xy_pad 功能）
3. 节奏预设切换（X 轴控制）
4. 手势状态可视化

### Phase 3 (高级功能)

1. 双手控制（左手和声，右手节奏）
2. 手势快捷操作（握拳切换预设等）
3. 音频反馈可视化波形
4. MIDI 输出支持

---

## 代码复用清单

### 从 arpeggiator-main/game.js 复用

- [ ] MediaPipe 初始化代码 (line ~660-715)
- [ ] `_isFist()` 方法 (line ~1155-1197)
- [ ] `_getFingerStates()` 方法 (line ~1108-1152)
- [ ] `_getVisibleVideoParameters()` 方法 (line ~871-909)
- [ ] 坐标映射逻辑 (line ~752-758)
- [ ] 平滑处理算法 (line ~739-746)

### 从 euclidean_delay.html 复用

- [ ] `generateEuclidean()` 函数 (line ~166-175)
- [ ] `updateAudioEffects()` 函数 (line ~177-188)
- [ ] 延迟效果设置 (Tone.FeedbackDelay)
- [ ] Canvas 渲染逻辑（动画条、和声块）
- [ ] 延迟时间映射 (X 轴 → DELAY_TIMES)

### 从 euclidean_xy_pad.html 复用

- [ ] `updatePatterns()` 函数 (line ~652-676)
- [ ] 节奏预设数组 (line ~609-613)
- [ ] 录音循环状态机 (line ~632-951)
- [ ] 录音进度条渲染 (line ~852-865)
- [ ] 节奏背景线绘制 (line ~776-799)
- [ ] 播放头可视化

---

## 潜在问题与解决方案

### 1. 手势识别延迟

**问题**: MediaPipe 处理可能有延迟

**解决方案**:
- 使用平滑处理减少抖动
- 预测下一帧位置（简单线性外推）
- 优化视频处理帧率

### 2. 坐标系统不一致

**问题**: 三个项目使用不同的坐标系统

**解决方案**:
- 统一使用归一化坐标 (0-1)
- 创建坐标转换工具函数
- 在文档中明确标注各层的坐标系统

### 3. Tone.js 上下文启动

**问题**: 浏览器需要用户交互才能启动音频上下文

**解决方案**:
- 添加"启动音频"按钮
- 或使用手势检测作为首次交互触发

### 4. 性能优化

**问题**: Canvas 渲染 + 手势识别可能造成性能问题

**解决方案**:
- 使用 `requestAnimationFrame` 优化渲染
- 降低手势检测频率（如每 2 帧检测一次）
- 使用 Web Workers 处理手势识别（如可能）

---

## 开发建议

1. **分阶段开发**: 先实现基础手势→音乐映射，再逐步添加功能
2. **模块化设计**: 将各功能拆分为独立模块，便于测试和调试
3. **使用 TypeScript**: 提高代码可维护性（如需要）
4. **充分测试**: 在不同设备和浏览器上测试手势识别准确性
5. **用户反馈**: 提供清晰的视觉反馈，让用户知道手势是否被正确识别

---

## 参考资料

- [MediaPipe Hand Landmarks](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- [Tone.js Documentation](https://tonejs.github.io/)
- [Euclidean Rhythms Algorithm](http://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf)
- [arpeggiator-main 项目](live coding/live/arpeggiator-main)
- [euclidean_delay.html](AI音乐交互/gemini2x2/experiments/euclidean_delay.html)
- [euclidean_xy_pad.html](AI音乐交互/gemini2x2/experiments/euclidean_xy_pad.html)

---

## 下一步行动

1. **创建项目基础结构**: 按照文件结构规划创建目录和文件
2. **提取手势识别模块**: 从 arpeggiator-main 提取并重构 HandTracker 类
3. **实现基础 XY Pad 映射**: 创建 GesturePadMapper 并测试手势→坐标转换
4. **整合欧几里得算法**: 实现模式生成并与手势输入连接
5. **开发 MVP 原型**: 实现最小可行产品，验证核心功能

---

**最后更新**: 2024-12-19

