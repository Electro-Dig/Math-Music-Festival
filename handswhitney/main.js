import { paper, Disc, createRainbowColors, MOTION_MODES, COLOR_MODES, createColors } from './whitneyDisc.js';
import { WhitneyAudioEngine } from './audioEngine.js';
import { HandsTracker } from './handTracking.js';
import { mapGestures } from './gestureMapper.js';
import * as Tone from 'https://esm.sh/tone';

// 多语言文案
const TEXTS = {
  zh: {
    title: '惠特尼音乐盒',
    subtitle: '左手：声音 | 右手：旋转',
    controlsTitle: '控制面板',
    langButton: '中 / EN',
    btnHandLines: '手势线条',
    btnWhitneyLines: '惠特尼连线',
    btnMirror: '摄像头镜像',
    btnWheelMode: '轮盘模式',
    btnHandTracking: '手势追踪',
    statusAudioLabel: '音频',
    statusAudioWaiting: '未启动',
    statusAudioStarted: '已启动',
    statusPresetLabel: '音色',
    statusTransposeLabel: '移调',
    statusSpeedLabel: '速度',
    statusTinesLabel: '点数',
    statusModeLabel: '模式',
    onText: '开',
    offText: '关',
    shapeLabel: '形状',
    shapeSizeLabel: '大小',
    tinesLabel: '数量',
    speedMulLabel: '速度倍率',
    manualSpeedLabel: '手动速度',
    modeMusic: '🎵 音乐',
    modeVisual: '👁️ 视觉',
    sliderLabel: '← 拖动控制速度 →',
    scaleModeLabel: '音阶',
    statusScaleLabel: '音阶',
    scaleModes: {
      classic: '🎹 经典钢琴',
      harmonics20Hz: '🔊 基础共振',
      microtones: '💫 幽微微分音',
      sciFiReversed: '🚀 科幻高密度',
    },
    motionModeLabel: '运动',
    statusMotionLabel: '运动',
    motionModes: {
      circular: '🔄 圆周运动',
      tusiCouple: '⚡ 穿心振荡',
    },
    colorModeLabel: '颜色',
    colorModes: {
      rainbow: '🌈 经典彩虹',
      shuttle: '🚀 穿梭感',
      cyberpunk: '💜 赛博朋克',
      oscilloscope: '📟 示波器',
      fireworks: '🎆 音乐烟花',
      aurora: '🌌 极光',
    },
  },
  en: {
    title: 'Hands × Whitney Music Box',
    subtitle: 'Left hand: sound | Right hand: rotation',
    controlsTitle: 'Controls',
    langButton: 'EN / 中',
    btnHandLines: 'Hand Lines',
    btnWhitneyLines: 'Whitney Lines',
    btnMirror: 'Mirror Camera',
    btnWheelMode: 'Wheel Mode',
    btnHandTracking: 'Hand Tracking',
    statusAudioLabel: 'Audio',
    statusAudioWaiting: 'waiting',
    statusAudioStarted: 'started',
    statusPresetLabel: 'Preset',
    statusTransposeLabel: 'Transpose',
    statusSpeedLabel: 'Speed',
    statusTinesLabel: 'Tines',
    statusModeLabel: 'Mode',
    onText: 'On',
    offText: 'Off',
    shapeLabel: 'Shape',
    shapeSizeLabel: 'Size',
    tinesLabel: 'Tines',
    speedMulLabel: 'Speed ×',
    manualSpeedLabel: 'Manual Speed',
    modeMusic: '🎵 Music',
    modeVisual: '👁️ Visual',
    sliderLabel: '← Drag to control speed →',
    scaleModeLabel: 'Scale',
    statusScaleLabel: 'Scale',
    scaleModes: {
      classic: '🎹 Classic',
      harmonics20Hz: '🔊 Harmonics 20Hz',
      microtones: '💫 Microtones',
      sciFiReversed: '🚀 Sci-Fi Reversed',
    },
    motionModeLabel: 'Motion',
    statusMotionLabel: 'Motion',
    motionModes: {
      circular: '🔄 Circular',
      tusiCouple: '⚡ Tusi Couple',
    },
    colorModeLabel: 'Color',
    colorModes: {
      rainbow: '🌈 Rainbow',
      shuttle: '🚀 Shuttle',
      cyberpunk: '💜 Cyberpunk',
      oscilloscope: '📟 Oscilloscope',
      fireworks: '🎆 Fireworks',
      aurora: '🌌 Aurora',
    },
  },
};

// === 全局状态 ===
let tineCount = 48;
let disc = null;
let audioEngine = null;
let handsTracker = null;
let handsTrackerRunning = false;

let latestHands = { left: null, right: null };
let mappedState = null;

let audioStarted = false;

// 模式: 'music' | 'visual'
let currentMode = 'music';
// 视觉模式下保存的 tine 数量
let visualTineCount = 1024;
// 视觉模式手动速度
let manualSpeed = 0.3;

// 视觉 & 交互设置
const settings = {
  showHandLines: true,
  showWhitneyLines: true,
  mirrorCamera: true,
  wheelMode: false,
  handTrackingEnabled: true,
  lang: 'zh', // 'zh' | 'en'
  shapeType: 'circle',
  shapeSize: 1.0, // 形状大小倍数
  speedMultiplier: 1.0,
  debugGestures: false,
};

// 状态栏数据
const status = {
  audioStarted: false,
  preset: 'piano',
  transpose: 0,
  speed: 0,
  scaleMode: 'classic', // 当前音阶模式
  motionMode: 'circular', // 当前运动模式
  colorMode: 'rainbow', // 当前颜色模式
};

// MediaPipe 手部骨架连接（按索引）
const HAND_CONNECTIONS = [
  // 拇指
  [0, 1], [1, 2], [2, 3], [3, 4],
  // 食指
  [0, 5], [5, 6], [6, 7], [7, 8],
  // 中指
  [0, 9], [9, 10], [10, 11], [11, 12],
  // 无名指
  [0, 13], [13, 14], [14, 15], [15, 16],
  // 小指
  [0, 17], [17, 18], [18, 19], [19, 20],
];

// 轮盘模式状态
let wheelSpeed = 0;
let prevWheelAngle = null;

// Toggle 按钮状态
let toggleStates = [];

// 拖地条滑块状态
let sliderSpeed = 0; // 当前滑块速度值 (-1 ~ 1)
let sliderDragging = false; // 是否正在拖动滑块

// === 初始化入口 ===
async function init() {
  const mainCanvas = document.getElementById('mainCanvas');
  const handsCanvas = document.getElementById('handsCanvas');
  const webcam = document.getElementById('webcam');

  paper.setup(mainCanvas);

  const discCenter = paper.view.center;
  const radius = Math.min(
    paper.view.size.width,
    paper.view.size.height,
  ) / 2;
  const colors = createRainbowColors(tineCount);
  disc = new Disc(discCenter, radius * 0.95, tineCount, colors, settings.showWhitneyLines, settings.shapeType);
  disc.setLinesVisible(settings.showWhitneyLines);
  disc.setSpeedMultiplier(settings.speedMultiplier);

  audioEngine = new WhitneyAudioEngine(tineCount, 'A2');
  status.preset = audioEngine.getCurrentPresetKey
    ? audioEngine.getCurrentPresetKey()
    : 'piano';

  // 将 zero 事件记录下来，在每一帧统一触发音符
  const notesToTrigger = [];
  disc.addZeroListener((tineId) => {
    notesToTrigger.push(tineId);
  });

  // 手势追踪初始化（但可以随时停止/启动）
  handsTracker = new HandsTracker(webcam);

  // 启动/停止手势追踪的函数
  async function startHandTracking() {
    if (handsTrackerRunning) return;
    try {
      await handsTracker.start((hands) => {
        latestHands = hands;
      });
      handsTrackerRunning = true;
    } catch (e) {
      console.warn('Failed to start hand tracking:', e);
    }
  }

  function stopHandTracking() {
    if (!handsTrackerRunning) return;
    handsTracker.stop();
    handsTrackerRunning = false;
    latestHands = { left: null, right: null };
  }

  // 根据当前设置启动手势追踪
  if (settings.handTrackingEnabled && currentMode === 'music') {
    await startHandTracking();
  }

  mappedState = mapGestures(latestHands, null);

  // 控制面板按钮 & 语言
  setupToggleButtons(startHandTracking, stopHandTracking);
  applyLanguage();
  renderStatus();

  // 初始化拖地条并设置可见性
  setupSpeedSlider();
  updateSliderVisibility();
  updateSliderLabel();

  // 重建 Disc 的方法（支持视觉模式的大量点位）
  function rebuildDisc() {
    if (disc) {
      disc.dispose();
    }
    const currentCount = currentMode === 'visual' ? visualTineCount : tineCount;

    // 根据颜色模式生成颜色
    const currentColorMode = status.colorMode || 'rainbow';
    const newColors = createColors(currentCount, currentColorMode);

    // 视觉模式下优化配置
    const isVisual = currentMode === 'visual';
    // 始终创建连线，但视觉模式下默认不显示（用户可以手动开启）
    const shouldShowLines = isVisual ? false : settings.showWhitneyLines;

    // 获取当前运动模式
    const currentMotionMode = status.motionMode === 'tusiCouple'
      ? MOTION_MODES.TUSI_COUPLE
      : MOTION_MODES.CIRCULAR;

    disc = new Disc(
      discCenter,
      radius * 0.95,
      currentCount,
      newColors,
      true, // 始终创建连线
      settings.shapeType,
      isVisual, // 传入视觉模式标志用于性能优化
      settings.shapeSize, // 形状大小倍数
      currentMotionMode, // 运动模式
      currentColorMode // 颜色模式
    );
    disc.setLinesVisible(shouldShowLines);
    disc.setSpeedMultiplier(settings.speedMultiplier);

    // 音乐模式下更新音频引擎
    if (!isVisual && audioEngine && audioEngine.setTineCount) {
      audioEngine.setTineCount(currentCount);
    }

    // 重新绑定 zero 事件（仅音乐模式）
    if (!isVisual) {
      disc.addZeroListener((tineId) => {
        notesToTrigger.push(tineId);
      });
    }
  }

  // 暴露 rebuildDisc 到全局供模式切换使用
  window._rebuildDisc = rebuildDisc;
  window._startHandTracking = startHandTracking;
  window._stopHandTracking = stopHandTracking;

  // 形状选择绑定
  const shapeSelect = document.getElementById('shapeSelect');
  const tinesSelect = document.getElementById('tinesSelect');
  const speedMulSelect = document.getElementById('speedMulSelect');
  const visualTinesSelect = document.getElementById('visualTinesSelect');
  const manualSpeedSlider = document.getElementById('manualSpeedSlider');
  const manualSpeedValue = document.getElementById('manualSpeedValue');

  // 音量 UI 滑块绑定
  let masterVolume = 0.7; // 默认音量
  const masterVolumeSlider = document.getElementById('masterVolumeSlider');
  const masterVolumeValue = document.getElementById('masterVolumeValue');
  if (masterVolumeSlider && masterVolumeValue) {
    masterVolumeSlider.value = String(masterVolume);
    masterVolumeValue.textContent = Math.round(masterVolume * 100) + '%';
    masterVolumeSlider.addEventListener('input', () => {
      masterVolume = parseFloat(masterVolumeSlider.value);
      masterVolumeValue.textContent = Math.round(masterVolume * 100) + '%';
      if (audioEngine) audioEngine.setVolume(masterVolume);
    });
  }

  if (shapeSelect) {
    shapeSelect.value = settings.shapeType;
    shapeSelect.addEventListener('change', () => {
      settings.shapeType = shapeSelect.value;
      rebuildDisc();
    });
  }

  // 形状大小选择器绑定
  const shapeSizeSelect = document.getElementById('shapeSizeSelect');
  if (shapeSizeSelect) {
    shapeSizeSelect.value = String(settings.shapeSize);
    shapeSizeSelect.addEventListener('change', () => {
      const v = parseFloat(shapeSizeSelect.value);
      settings.shapeSize = isFinite(v) ? v : 1.0;
      rebuildDisc();
    });
  }

  // 音阶模式选择器绑定
  const scaleModeSelect = document.getElementById('scaleModeSelect');
  if (scaleModeSelect) {
    scaleModeSelect.value = status.scaleMode;
    scaleModeSelect.addEventListener('change', () => {
      const modeId = scaleModeSelect.value;
      status.scaleMode = modeId;

      // 调用音频引擎切换模式（会自动应用推荐的 tineCount 和音色）
      if (audioEngine && audioEngine.setScaleMode) {
        const modeInfo = audioEngine.setScaleMode(modeId, true);

        // 同步更新全局 tineCount 和 tinesSelect
        if (modeInfo && modeInfo.recommendedTines) {
          tineCount = modeInfo.recommendedTines;
          if (tinesSelect) {
            tinesSelect.value = String(tineCount);
          }
        }

        // 更新音色状态
        status.preset = audioEngine.getCurrentPresetKey();
      }

      // 重建圆盘
      rebuildDisc();
      renderStatus();
    });
  }

  // 运动模式选择器绑定
  const motionModeSelect = document.getElementById('motionModeSelect');
  if (motionModeSelect) {
    motionModeSelect.value = status.motionMode;
    motionModeSelect.addEventListener('change', () => {
      const modeId = motionModeSelect.value;
      status.motionMode = modeId;

      // 重建圆盘以应用新的运动模式
      rebuildDisc();
      renderStatus();
    });
  }

  // 颜色模式选择器绑定
  const colorModeSelect = document.getElementById('colorModeSelect');
  if (colorModeSelect) {
    colorModeSelect.value = status.colorMode;
    colorModeSelect.addEventListener('change', () => {
      const modeId = colorModeSelect.value;
      status.colorMode = modeId;

      // 重建圆盘以应用新的颜色模式
      rebuildDisc();
    });
  }

  if (tinesSelect) {
    tinesSelect.value = String(tineCount);
    tinesSelect.addEventListener('change', () => {
      const v = parseInt(tinesSelect.value, 10);
      tineCount = Math.min(120, Math.max(24, v)); // 更新最大值为 120
      if (audioEngine && audioEngine.setTineCount) {
        audioEngine.setTineCount(tineCount);
      }
      rebuildDisc();
      renderStatus();
    });
  }
  if (visualTinesSelect) {
    visualTinesSelect.value = String(visualTineCount);
    visualTinesSelect.addEventListener('change', () => {
      const v = parseInt(visualTinesSelect.value, 10);
      visualTineCount = v;
      if (currentMode === 'visual') {
        rebuildDisc();
      }
      renderStatus();
    });
  }
  if (speedMulSelect) {
    speedMulSelect.value = String(settings.speedMultiplier.toFixed(2));
    speedMulSelect.addEventListener('change', () => {
      const v = parseFloat(speedMulSelect.value);
      settings.speedMultiplier = isFinite(v) ? v : 1.0;
      if (disc && disc.setSpeedMultiplier) disc.setSpeedMultiplier(settings.speedMultiplier);
    });
  }
  if (manualSpeedSlider && manualSpeedValue) {
    manualSpeedSlider.value = String(manualSpeed);
    manualSpeedValue.textContent = manualSpeed.toFixed(2);
    manualSpeedSlider.addEventListener('input', () => {
      const v = parseFloat(manualSpeedSlider.value);
      manualSpeed = isFinite(v) ? v : 0.3;
      manualSpeedValue.textContent = manualSpeed.toFixed(2);
    });
  }

  // 用户首次点击页面时启动 AudioContext
  window.addEventListener(
    'click',
    () => {
      if (!audioStarted) {
        Tone.start();
      }
      audioStarted = true;
      status.audioStarted = true;
      renderStatus();
    },
    { once: true },
  );

  // Paper.js 帧循环
  paper.view.onFrame = (ev) => {
    const isVisual = currentMode === 'visual';

    // 视觉模式：使用手动速度，跳过音频处理
    if (isVisual) {
      disc.setSpeed(manualSpeed);
      status.speed = manualSpeed;
      disc.onFrame(ev);
      renderStatus();

      // 视觉模式下如果开启了手势追踪，仍然绘制手势
      if (settings.handTrackingEnabled && handsTrackerRunning) {
        const displayHands = settings.mirrorCamera ? mirrorHands(latestHands) : latestHands;
        const roles = classifyByScreenSide(displayHands, settings);
        drawHands(handsCanvas, roles);
      } else if (handsCanvas) {
        const ctx = handsCanvas.getContext('2d');
        ctx.clearRect(0, 0, handsCanvas.width, handsCanvas.height);
      }
      return;
    }

    // === 音乐模式逻辑 ===
    // 1) 根据镜像设置得到“屏幕坐标”的手部数据
    const displayHands = settings.mirrorCamera ? mirrorHands(latestHands) : latestHands;
    // 2) 按屏幕左右重新判定角色（与镜像开关一致：左边=left、右边=right）
    const roles = classifyByScreenSide(displayHands, settings);
    // 3) 基于角色数据进行映射
    mappedState = mapGestures(roles, mappedState);

    // 2. 使用右手控制旋转速度，或使用拖地条滑块速度
    let rotationSpeed = 0;
    if (settings.handTrackingEnabled && handsTrackerRunning) {
      // 手势追踪开启时，使用手势控制速度
      rotationSpeed = settings.wheelMode
        ? computeWheelSpeed(roles.right)
        : mappedState.right.rotationSpeed;
    } else {
      // 手势追踪关闭时，使用拖地条滑块速度
      rotationSpeed = sliderSpeed;
    }
    disc.setSpeed(rotationSpeed);

    // 3. 使用左手控制移调、音色切换（音量已由 UI 滑块控制）
    if (settings.handTrackingEnabled && mappedState.left.hasHand) {
      audioEngine.setTranspose(mappedState.left.transpose);
      if (mappedState.left.presetChangeTrigger) {
        const nextPreset = audioEngine.cyclePreset();
        status.preset = nextPreset;
      }
    }

    status.transpose = audioEngine.getTranspose();
    status.speed = rotationSpeed;
    renderStatus();

    // 4. 更新 Whitney 圆盘
    notesToTrigger.length = 0;
    disc.onFrame(ev);
    if (notesToTrigger.length > 0) {
      audioEngine.triggerNotesForTines(notesToTrigger);
    }

    // 5. 手势可视化：按角色着色（左=青蓝 / 右=橙黄）
    if (settings.handTrackingEnabled) {
      drawHands(handsCanvas, roles);
    } else if (handsCanvas) {
      const ctx = handsCanvas.getContext('2d');
      ctx.clearRect(0, 0, handsCanvas.width, handsCanvas.height);
    }
  };

  paper.view.draw();
}

// === 手势可视化：在主画面上叠加左右手 21 点 ===
function drawHands(canvas, hands) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = (canvas.width = canvas.clientWidth || canvas.offsetWidth || 200);
  const h = (canvas.height = canvas.clientHeight || canvas.offsetHeight || 200);

  ctx.clearRect(0, 0, w, h);

  const { left, right } = hands || {};

  if (left && left.landmarks) {
    drawSingleHand(ctx, w, h, left.landmarks, '#22d3ee'); // 青蓝
  }
  if (right && right.landmarks) {
    drawSingleHand(ctx, w, h, right.landmarks, '#f97316'); // 橙黄
  }
}

function drawSingleHand(ctx, w, h, landmarks, color) {
  ctx.save();
  const radiusBase = Math.max(3, Math.min(w, h) * 0.008);

  // 1) 画骨架线条（可选）
  if (settings.showHandLines) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.003);
    HAND_CONNECTIONS.forEach(([a, b]) => {
      const p1 = landmarks[a];
      const p2 = landmarks[b];
      if (!p1 || !p2) return;
      ctx.beginPath();
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.stroke();
    });
  }

  // 2) 画关节点和指尖圆环
  landmarks.forEach((p, idx) => {
    const x = p.x * w;
    const y = p.y * h;

    const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;

    // 关节点小圆点
    const jointRadius = radiusBase * 0.35;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)'; // 近白
    ctx.beginPath();
    ctx.arc(x, y, jointRadius, 0, Math.PI * 2);
    ctx.fill();

    // 指尖外圈
    if (isTip) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, radiusBase, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  ctx.restore();
}

function mirrorHands(hands) {
  if (!hands) return hands;
  const mirrorOne = (hand) =>
    hand
      ? {
        landmarks: hand.landmarks.map((p) => ({
          ...p,
          x: 1 - p.x,
        })),
      }
      : null;

  return {
    left: mirrorOne(hands.left),
    right: mirrorOne(hands.right),
  };
}

function classifyByScreenSide(hands, opts) {
  // 从传入对象中提取所有手（忽略之前的标签），基于屏幕坐标的 x 重新判定 left/right
  const all = [];
  if (hands && hands.left && hands.left.landmarks) all.push(hands.left);
  if (hands && hands.right && hands.right.landmarks) all.push(hands.right);

  // 如果底层 SDK 有时只返回一只手，则也能正确判定
  // 计算每只手的平均 x（基于屏幕坐标，已考虑镜像）
  const withAvg = all.map((h) => {
    const ax = h.landmarks.reduce((s, p) => s + p.x, 0) / h.landmarks.length;
    return { hand: h, avgX: ax };
  });

  let left = null;
  let right = null;
  if (withAvg.length === 2) {
    withAvg.sort((a, b) => a.avgX - b.avgX);
    left = withAvg[0].hand;
    right = withAvg[1].hand;
  } else if (withAvg.length === 1) {
    // 单手：按屏幕中线判定
    if (withAvg[0].avgX <= 0.5) {
      left = withAvg[0].hand;
    } else {
      right = withAvg[0].hand;
    }
  }

  // 可选调试输出（避免刷屏，仅在开启时输出）
  if (opts && opts.debugGestures) {
    const lx = left
      ? left.landmarks.reduce((s, p) => s + p.x, 0) / left.landmarks.length
      : null;
    const rx = right
      ? right.landmarks.reduce((s, p) => s + p.x, 0) / right.landmarks.length
      : null;
    // eslint-disable-next-line no-console
    console.debug('[handswhitney] classify roles:', { leftX: lx, rightX: rx });
  }

  return { left, right };
}

function setupToggleButtons(startHandTracking, stopHandTracking) {
  const handBtn = document.getElementById('toggleHandLines');
  const whitneyBtn = document.getElementById('toggleWhitneyLines');
  const mirrorBtn = document.getElementById('toggleMirror');
  const langBtn = document.getElementById('toggleLang');
  const wheelBtn = document.getElementById('toggleWheelMode');
  const handTrackingBtn = document.getElementById('toggleHandTracking');
  const modeBtn = document.getElementById('toggleMode');
  const cpFoldRight = document.getElementById('cpFoldRight');
  const controlPanel = document.querySelector('.control-panel');
  const guidePanel = document.querySelector('.guide-panel');
  const guideFoldRight = document.getElementById('guideFoldRight');
  const guideDockBtn = document.getElementById('guideDockBtn');
  const cpDockBtn = document.getElementById('cpDockBtn');

  toggleStates = [];

  const bind = (btn, initialOn, labelKey, onChange) => {
    if (!btn) return;
    const state = {
      btn,
      on: initialOn,
      labelKey,
      onChange,
      applyState(onOverride) {
        if (typeof onOverride === 'boolean') {
          state.on = onOverride;
        }
        const t = TEXTS[settings.lang];
        const label = t[labelKey];
        const on = state.on;
        const onText = t.onText;
        const offText = t.offText;
        btn.classList.toggle('toggle-on', on);
        btn.classList.toggle('toggle-off', !on);
        btn.textContent = `${label}: ${on ? onText : offText}`;
      },
    };
    state.applyState(initialOn);
    btn.addEventListener('click', () => {
      state.on = !state.on;
      state.applyState();
      onChange(state.on);
    });
    toggleStates.push(state);
  };

  bind(handBtn, settings.showHandLines, 'btnHandLines', (on) => {
    settings.showHandLines = on;
  });

  bind(whitneyBtn, settings.showWhitneyLines, 'btnWhitneyLines', (on) => {
    settings.showWhitneyLines = on;
    if (disc) disc.setLinesVisible(on);
  });

  bind(mirrorBtn, settings.mirrorCamera, 'btnMirror', (on) => {
    settings.mirrorCamera = on;
  });

  bind(wheelBtn, settings.wheelMode, 'btnWheelMode', (on) => {
    settings.wheelMode = on;
    // 重置轮盘状态，避免切换模式时出现跳变
    wheelSpeed = 0;
    prevWheelAngle = null;
  });

  // 手势追踪开关
  bind(handTrackingBtn, settings.handTrackingEnabled, 'btnHandTracking', (on) => {
    settings.handTrackingEnabled = on;
    if (on) {
      // 无论什么模式，只要用户开启就启动手势追踪
      startHandTracking && startHandTracking();
    } else {
      stopHandTracking && stopHandTracking();
    }
    // 更新拖地条可见性
    updateSliderVisibility();
  });

  // 模式切换按钮
  if (modeBtn) {
    const updateModeUI = () => {
      const t = TEXTS[settings.lang];
      const isVisual = currentMode === 'visual';
      modeBtn.textContent = isVisual ? t.modeVisual : t.modeMusic;
      modeBtn.classList.toggle('visual-mode', isVisual);

      // 切换UI元素可见性
      document.querySelectorAll('.cp-music-only').forEach(el => {
        el.style.display = isVisual ? 'none' : '';
      });
      document.querySelectorAll('.cp-visual-only').forEach(el => {
        el.style.display = isVisual ? '' : 'none';
      });
      document.querySelectorAll('.cp-gesture-control').forEach(el => {
        el.style.display = isVisual ? 'none' : '';
      });

      // 更新模式状态显示
      const modeStatus = document.getElementById('modeStatus');
      if (modeStatus) {
        modeStatus.textContent = `${t.statusModeLabel}: ${isVisual ? 'Visual' : 'Music'}`;
      }

      // 更新 tine 数量显示
      renderStatus();
    };

    modeBtn.addEventListener('click', () => {
      const wasVisual = currentMode === 'visual';
      currentMode = wasVisual ? 'music' : 'visual';

      // 切换到视觉模式时停止手势追踪
      if (currentMode === 'visual') {
        stopHandTracking && stopHandTracking();
        settings.handTrackingEnabled = false;
        // 更新手势追踪按钮状态
        const htState = toggleStates.find(s => s.labelKey === 'btnHandTracking');
        if (htState) htState.applyState(false);
      } else {
        // 切换回音乐模式时恢复手势追踪
        settings.handTrackingEnabled = true;
        startHandTracking && startHandTracking();
        const htState = toggleStates.find(s => s.labelKey === 'btnHandTracking');
        if (htState) htState.applyState(true);
      }

      updateModeUI();

      // 更新拖地条可见性
      updateSliderVisibility();

      // 重建圆盘
      if (window._rebuildDisc) {
        window._rebuildDisc();
      }
    });

    // 初始化模式UI
    updateModeUI();
  }

  if (langBtn) {
    langBtn.addEventListener('click', () => {
      settings.lang = settings.lang === 'zh' ? 'en' : 'zh';
      applyLanguage();
    });
  }

  if (cpFoldRight && controlPanel) {
    cpFoldRight.addEventListener('click', () => {
      controlPanel.classList.toggle('folded-right');
      if (cpDockBtn) cpDockBtn.style.display = controlPanel.classList.contains('folded-right') ? 'block' : 'none';
    });
  }
  if (guideFoldRight && guidePanel) {
    guideFoldRight.addEventListener('click', () => {
      guidePanel.classList.toggle('folded-right');
      if (guideDockBtn) guideDockBtn.style.display = guidePanel.classList.contains('folded-right') ? 'block' : 'none';
    });
  }
  if (cpDockBtn && controlPanel) {
    cpDockBtn.addEventListener('click', () => {
      controlPanel.classList.remove('folded-right');
      cpDockBtn.style.display = 'none';
    });
  }
  if (guideDockBtn && guidePanel) {
    guideDockBtn.addEventListener('click', () => {
      guidePanel.classList.remove('folded-right');
      guideDockBtn.style.display = 'none';
    });
  }
}

function applyLanguage() {
  const t = TEXTS[settings.lang];

  document.title = t.title;
  const headerTitle = document.querySelector('.app-header h1');
  if (headerTitle) headerTitle.textContent = t.title;
  const subtitle = document.querySelector('.app-header .subtitle');
  if (subtitle) subtitle.textContent = t.subtitle;

  const cpTitle = document.querySelector('.cp-title');
  if (cpTitle) cpTitle.textContent = t.controlsTitle;

  const langBtn = document.getElementById('toggleLang');
  if (langBtn) langBtn.textContent = t.langButton;

  const shapeLabel = document.getElementById('shapeLabel');
  if (shapeLabel) shapeLabel.textContent = t.shapeLabel;
  const shapeSizeLabel = document.getElementById('shapeSizeLabel');
  if (shapeSizeLabel) shapeSizeLabel.textContent = t.shapeSizeLabel;
  const tinesLabel = document.getElementById('tinesLabel');
  if (tinesLabel) tinesLabel.textContent = t.tinesLabel;
  const speedMulLabel = document.getElementById('speedMulLabel');
  if (speedMulLabel) speedMulLabel.textContent = t.speedMulLabel;

  // 音阶模式标签和选项
  const scaleModeLabel = document.getElementById('scaleModeLabel');
  if (scaleModeLabel) scaleModeLabel.textContent = t.scaleModeLabel;
  const scaleModeSelect = document.getElementById('scaleModeSelect');
  if (scaleModeSelect && t.scaleModes) {
    const options = scaleModeSelect.querySelectorAll('option');
    options.forEach((opt) => {
      const modeId = opt.value;
      if (t.scaleModes[modeId]) {
        opt.textContent = t.scaleModes[modeId];
      }
    });
  }

  // 运动模式标签和选项
  const motionModeLabel = document.getElementById('motionModeLabel');
  if (motionModeLabel) motionModeLabel.textContent = t.motionModeLabel;
  const motionModeSelect = document.getElementById('motionModeSelect');
  if (motionModeSelect && t.motionModes) {
    const options = motionModeSelect.querySelectorAll('option');
    options.forEach((opt) => {
      const modeId = opt.value;
      if (t.motionModes[modeId]) {
        opt.textContent = t.motionModes[modeId];
      }
    });
  }

  // 颜色模式标签和选项
  const colorModeLabel = document.getElementById('colorModeLabel');
  if (colorModeLabel) colorModeLabel.textContent = t.colorModeLabel;
  const colorModeSelect = document.getElementById('colorModeSelect');
  if (colorModeSelect && t.colorModes) {
    const options = colorModeSelect.querySelectorAll('option');
    options.forEach((opt) => {
      const modeId = opt.value;
      if (t.colorModes[modeId]) {
        opt.textContent = t.colorModes[modeId];
      }
    });
  }

  // 指南语言切换
  const guideZh = document.querySelector('.guide-panel .guide-zh');
  const guideEn = document.querySelector('.guide-panel .guide-en');
  if (guideZh && guideEn) {
    if (settings.lang === 'zh') {
      guideZh.style.display = 'block';
      guideEn.style.display = 'none';
    } else {
      guideZh.style.display = 'none';
      guideEn.style.display = 'block';
    }
  }

  // 刷新状态栏与 toggle 按钮文本
  renderStatus();
  toggleStates.forEach((s) => s.applyState());

  // 更新拖地条标签
  updateSliderLabel();
}

function renderStatus() {
  const t = TEXTS[settings.lang];
  const audioEl = document.getElementById('audioStatus');
  const presetEl = document.getElementById('presetStatus');
  const transposeEl = document.getElementById('transposeStatus');
  const speedEl = document.getElementById('speedStatus');
  const tineCountEl = document.getElementById('tineCountStatus');

  if (speedEl) {
    speedEl.textContent = `${t.statusSpeedLabel}: ${status.speed.toFixed(2)}`;
  }

  // Tine 数量显示
  if (tineCountEl) {
    const count = currentMode === 'visual' ? visualTineCount : tineCount;
    tineCountEl.textContent = `${t.statusTinesLabel}: ${count}`;
  }

  // 音乐模式专用状态
  if (audioEl) {
    audioEl.textContent = `${t.statusAudioLabel}: ${status.audioStarted ? t.statusAudioStarted : t.statusAudioWaiting}`;
  }
  if (presetEl) {
    presetEl.textContent = `${t.statusPresetLabel}: ${status.preset}`;
  }
  if (transposeEl) {
    transposeEl.textContent = `${t.statusTransposeLabel}: ${status.transpose} semitones`;
  }

  // 音阶模式状态显示
  const scaleModeStatusEl = document.getElementById('scaleModeStatus');
  if (scaleModeStatusEl && t.scaleModes) {
    const modeName = t.scaleModes[status.scaleMode] || status.scaleMode;
    scaleModeStatusEl.textContent = `${t.statusScaleLabel}: ${modeName}`;
  }

  // 运动模式状态显示
  const motionModeStatusEl = document.getElementById('motionModeStatus');
  if (motionModeStatusEl && t.motionModes) {
    const modeName = t.motionModes[status.motionMode] || status.motionMode;
    motionModeStatusEl.textContent = `${t.statusMotionLabel}: ${modeName}`;
  }
}

function computeWheelSpeed(rightHand) {
  // 没有右手时，缓慢衰减速度
  if (!rightHand || !rightHand.landmarks || rightHand.landmarks.length < 21) {
    wheelSpeed *= 0.9;
    prevWheelAngle = null;
    return wheelSpeed;
  }

  const lm = rightHand.landmarks;
  const wrist = lm[0];
  const middleMcp = lm[9];
  const cx = (wrist.x + middleMcp.x) / 2;
  const cy = (wrist.y + middleMcp.y) / 2;

  // 以画面中心为原点计算角度
  const dx = cx - 0.5;
  const dy = cy - 0.5;
  const angle = Math.atan2(dy, dx); // [-PI, PI]

  if (prevWheelAngle == null) {
    prevWheelAngle = angle;
    return wheelSpeed;
  }

  let delta = angle - prevWheelAngle;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  prevWheelAngle = angle;

  const maxDelta = 0.35; // 每帧最大有效角度变化
  let raw = delta / maxDelta;
  raw = Math.max(-1, Math.min(1, raw));

  // 经验上顺时针与逆时针可以根据手感调整符号，这里假设 delta>0 为逆时针
  const targetSpeed = raw;
  wheelSpeed = wheelSpeed * 0.7 + targetSpeed * 0.3;
  return wheelSpeed;
}

// === 拖地条滑块交互 ===
function setupSpeedSlider() {
  const bar = document.getElementById('speedSliderBar');
  const track = document.getElementById('speedSliderTrack');
  const handle = document.getElementById('speedSliderHandle');
  const valueDisplay = document.getElementById('speedSliderValueDisplay');
  const label = document.getElementById('speedSliderLabel');

  if (!bar || !track || !handle) return;

  const min = -1;
  const max = 1;
  const snapMargin = 0.15; // 中心吸附范围

  function valueToRatio(val) {
    return (val - min) / (max - min);
  }

  function ratioToValue(ratio) {
    return min + ratio * (max - min);
  }

  function snapValue(val) {
    // 在中心附近吸附到 0
    if (val >= -snapMargin && val <= snapMargin) {
      return 0;
    }
    return val;
  }

  function updateUI(val) {
    const ratio = valueToRatio(val);
    handle.style.left = `${ratio * 100}%`;
    if (valueDisplay) {
      valueDisplay.textContent = val.toFixed(2);
    }
  }

  function onSlideStart(clientX) {
    sliderDragging = true;
    handle.classList.add('dragging');
    onSlideMove(clientX);
  }

  function onSlideMove(clientX) {
    if (!sliderDragging) return;
    const rect = track.getBoundingClientRect();
    const offsetX = Math.min(Math.max(0, clientX - rect.left), rect.width);
    const ratio = offsetX / rect.width;
    sliderSpeed = ratioToValue(ratio);
    updateUI(sliderSpeed);
  }

  function onSlideEnd() {
    if (!sliderDragging) return;
    sliderDragging = false;
    handle.classList.remove('dragging');
    // 吸附
    sliderSpeed = snapValue(sliderSpeed);
    updateUI(sliderSpeed);
  }

  // 鼠标事件
  track.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    onSlideStart(ev.clientX);
  });
  document.addEventListener('mousemove', (ev) => {
    onSlideMove(ev.clientX);
  });
  document.addEventListener('mouseup', () => {
    onSlideEnd();
  });

  // 触摸事件
  track.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    if (ev.touches.length > 0) {
      onSlideStart(ev.touches[0].clientX);
    }
  }, { passive: false });
  document.addEventListener('touchmove', (ev) => {
    if (ev.touches.length > 0) {
      onSlideMove(ev.touches[0].clientX);
    }
  }, { passive: false });
  document.addEventListener('touchend', () => {
    onSlideEnd();
  });

  // 初始化显示
  updateUI(sliderSpeed);

  // 暴露更新函数供外部调用
  window._updateSliderUI = updateUI;
}

// 根据模式和手势开关状态更新拖地条可见性
function updateSliderVisibility() {
  const bar = document.getElementById('speedSliderBar');
  if (!bar) return;

  // 音乐模式下：手势追踪关闭时显示拖地条
  // 视觉模式下：始终隐藏（使用控制面板的滑块）
  const shouldShow = currentMode === 'music' && !settings.handTrackingEnabled;
  bar.classList.toggle('hidden', !shouldShow);
}

// 更新拖地条标签语言
function updateSliderLabel() {
  const label = document.getElementById('speedSliderLabel');
  if (label) {
    label.textContent = TEXTS[settings.lang].sliderLabel;
  }
}

init().catch((err) => {
  console.error('Failed to init Hands × Whitney app', err);
});


