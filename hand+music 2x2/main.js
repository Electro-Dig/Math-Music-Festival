/**
 * 主应用入口
 * 整合手势识别、欧几里得算法和音乐生成
 */

import { HandTracker } from './HandTracker.js';
import { EuclideanEngine } from './EuclideanEngine.js';
import { MusicManager } from './MusicManager.js';
import { VisualRenderer } from './VisualRenderer.js';
import { I18nManager } from './i18n.js';

class HandMusicApp {
  constructor() {
    // DOM 元素
    this.videoElement = document.getElementById('videoLayer');
    this.canvasElement = document.getElementById('canvasLayer');
    this.loadingElement = document.getElementById('loading');
    this.errorElement = document.getElementById('error');
    this.leftHandStatus = document.getElementById('leftHandStatus');
    this.rightHandStatus = document.getElementById('rightHandStatus');
    this.padStatus = document.getElementById('padStatus');
    this.opacitySlider = document.getElementById('canvasOpacitySlider');
    this.opacityValue = document.getElementById('opacityValue');
    this.mirrorToggleBtn = document.getElementById('mirrorToggleBtn');
    this.tempoSlider = document.getElementById('tempoSlider');
    this.tempoValue = document.getElementById('tempoValue');
    this.harmonyLengthSlider = document.getElementById('harmonyLengthSlider');
    this.harmonyLengthValue = document.getElementById('harmonyLengthValue');
    this.delayWetSlider = document.getElementById('delayWetSlider');
    this.delayWetValue = document.getElementById('delayWetValue');
    this.delayTimeSlider = document.getElementById('delayTimeSlider');
    this.delayTimeValue = document.getElementById('delayTimeValue');
    this.reverbWetSlider = document.getElementById('reverbWetSlider');
    this.reverbWetValue = document.getElementById('reverbWetValue');
    this.visualModeSelect = document.getElementById('visualModeSelect');
    this.scaleRootSelect = document.getElementById('scaleRootSelect');
    this.scaleModeSelect = document.getElementById('scaleModeSelect');

    // 状态栏元素
    this.statusSynth = document.getElementById('statusSynth');
    this.statusCoords = document.getElementById('statusCoords');
    this.statusNote = document.getElementById('statusNote');
    this.statusTempo = document.getElementById('statusTempo');

    // 核心模块
    this.handTracker = new HandTracker(this.videoElement);
    this.euclideanEngine = new EuclideanEngine();
    this.musicManager = new MusicManager();
    this.visualRenderer = new VisualRenderer(this.canvasElement, 8);
    this.i18n = new I18nManager();

    // 语言切换按钮和折叠按钮
    this.languageToggle = document.getElementById('languageToggle');
    this.collapseBtn = document.getElementById('collapseBtn');
    this.controlPanel = document.getElementById('controlPanel');

    // 状态
    this.isInitialized = false;
    this.isRunning = false;
    this.lastFrameTime = 0;

    // 左手控制状态
    this.leftHandState = {
      visible: false,
      position: { x: 0.5, y: 0.5 },
      isFist: false,
      wasFist: false,
      pinchDistance: 0,
      currentNote: null
    };

    // 右手控制状态
    this.rightHandState = {
      visible: false,
      position: { x: 0.5, y: 0.5 },
      isPinched: false,
      wasPinched: false,
      pinchThreshold: 0.05,
      landmarks: null
    };

    // 音乐播放状态
    this.tempoBPM = 120;
    this.sequenceTime = 0;
    this.lastTriggeredStep = -1;
    this.isPlaying = false;
    this.leftHandVolume = 0.5; // 默认音量

    // 音频调度（Transport Loop）
    this.transportLoop = null;

    // 摄像头镜像状态
    this.isMirrored = true; // 默认镜像（与摄像头一致）

    // 音色名称映射（用于状态栏显示）
    this.synthNames = [
      'DX7 E.PIANO',
      'DX7 BRASS',
      'DX7 MARIMBA',
      'Clean Sine',
      'DX7 SYNTHWAVE',
      'DX7 CRYSTAL',
      'E-BELL SOFT',
      'BR LEAD 80s',
      'KALIMBA',
      'GLASS HARP',
      'THUMB PIANO',
      'WIND CHIME'
    ];

    // 动画循环 ID
    this.animationFrameId = null;

    // 设置透明度控制
    this.setupOpacityControl();

    // 设置镜像切换
    this.setupMirrorToggle();

    // 设置参数调节
    this.setupParameterControls();

    // 设置语言切换
    this.setupLanguageToggle();

    // 设置面板折叠
    this.setupPanelCollapse();

    // 初始化UI文本
    this.updateUIText();

    // 预创建音频调度 Loop（在启动音频后才真正工作）
    this.setupTransportLoop();
  }

  /**
   * 设置语言切换
   */
  setupLanguageToggle() {
    if (this.languageToggle) {
      this.languageToggle.addEventListener('click', () => {
        const currentLang = this.i18n.getCurrentLang();
        const newLang = currentLang === 'zh' ? 'en' : 'zh';
        this.i18n.setLanguage(newLang);
        this.updateLanguageButton();
        this.updateUIText();
        console.log(`🌐 切换到语言: ${newLang}`);
      });
      this.updateLanguageButton();
    }
  }

  /**
   * 更新语言按钮文本
   */
  updateLanguageButton() {
    if (this.languageToggle) {
      const currentLang = this.i18n.getCurrentLang();
      this.languageToggle.textContent = currentLang === 'zh' ? '中文 / EN' : 'EN / 中文';
    }
  }

  /**
   * 设置面板折叠
   */
  setupPanelCollapse() {
    if (this.collapseBtn && this.controlPanel) {
      this.collapseBtn.addEventListener('click', () => {
        this.controlPanel.classList.toggle('collapsed');
        // 更新按钮文本
        this.collapseBtn.textContent = this.controlPanel.classList.contains('collapsed') ? '▶' : '◀';
      });
    }
  }

  /**
   * 更新所有UI文本（根据当前语言）
   */
  updateUIText() {
    // 更新所有带 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.i18n.getText(key);
      if (text !== key) {
        el.textContent = text;
      }
    });

    // 特殊处理：镜像按钮需要根据状态更新
    this.updateMirrorButton();

    // 更新视觉模式选择器
    const visualModeSelect = document.getElementById('visualModeSelect');
    if (visualModeSelect) {
      Array.from(visualModeSelect.options).forEach(opt => {
        const key = opt.getAttribute('data-i18n');
        if (key) {
          const text = this.i18n.getText(key);
          if (text !== key) {
            opt.textContent = text;
          }
        }
      });
    }

    // 更新状态显示文本（需要重新翻译）
    this.updateStatusDisplay();
  }

  /**
   * 更新状态显示文本（翻译）
   */
  updateStatusDisplay() {
    // 左手状态
    if (this.leftHandStatus) {
      const status = this.leftHandStatus.textContent;
      if (status.includes('握拳')) {
        this.leftHandStatus.textContent = status.replace('握拳', this.i18n.getText('status.fist'));
      } else if (status.includes('正常')) {
        const match = status.match(/正常\s*\(([^)]+)\)/);
        if (match) {
          this.leftHandStatus.textContent = `${this.i18n.getText('status.normal')} (${match[1]})`;
        }
      } else if (status.includes('未检测')) {
        this.leftHandStatus.textContent = this.i18n.getText('status.notDetected');
      }
    }

    // 右手状态
    if (this.rightHandStatus) {
      const status = this.rightHandStatus.textContent;
      if (status.includes('捏合中')) {
        this.rightHandStatus.textContent = this.i18n.getText('status.pinching');
      } else if (status.includes('未捏合')) {
        this.rightHandStatus.textContent = this.i18n.getText('status.notPinching');
      } else if (status.includes('未检测')) {
        this.rightHandStatus.textContent = this.i18n.getText('status.notDetected');
      }
    }

    // XY Pad 状态
    if (this.padStatus) {
      const status = this.padStatus.textContent;
      if (status.includes('激活')) {
        const match = status.match(/激活\s*\(([^)]+)\)/);
        if (match) {
          this.padStatus.textContent = `${this.i18n.getText('status.activated')} (${match[1]})`;
        }
      } else if (status.includes('未激活')) {
        this.padStatus.textContent = this.i18n.getText('status.notActivated');
      }
    }
  }

  /**
   * 设置透明度控制
   */
  setupOpacityControl() {
    if (this.opacitySlider && this.opacityValue) {
      // 初始透明度
      const initialOpacity = 50;
      this.canvasElement.style.opacity = initialOpacity / 100;
      this.opacityValue.textContent = `${initialOpacity}%`;

      // 监听滑块变化
      this.opacitySlider.addEventListener('input', (e) => {
        const opacity = parseInt(e.target.value);
        this.canvasElement.style.opacity = opacity / 100;
        this.opacityValue.textContent = `${opacity}%`;
      });
    }
  }

  /**
   * 设置 Tone.Transport 调度
   */
  setupTransportLoop() {
    try {
      if (!this.transportLoop) {
        this.transportLoop = new Tone.Loop((time) => {
          this.onTransportStep(time);
        }, "16n");
        // 先启动，是否发声由 onTransportStep 内部状态判断
        this.transportLoop.start(0);
      }
    } catch (err) {
      console.error('❌ 创建 Transport Loop 失败:', err);
    }
  }

  /**
   * 音频时钟驱动的每步回调
   * 在音频时间线上触发音符，避免被视觉帧抖动影响
   */
  onTransportStep(time) {
    if (!this.isPlaying || !this.rightHandState.isPinched) return;
    if (!this.musicManager.isStarted) return;

    // 【修复】确保音频上下文处于活动状态
    this.musicManager.ensureAudioContext();

    // 当前 16 分音步（0..15）
    const currentStep = Math.floor(Tone.Transport.ticks / (Tone.Transport.PPQ / 4)) % 16;
    const patterns = this.euclideanEngine.getPatterns();
    if (patterns.rhythm[currentStep] !== 1) return;

    // 【修复】确保 velocity 有最小值，避免手远离时声音太弱
    const rawVelocity = patterns.velocity[currentStep] * (this.leftHandVolume || 0.5);
    const velocity = Math.max(0.25, rawVelocity); // 最小 velocity 0.25

    // 左手不可见时无法确定音高，跳过（保留上一帧位置）
    // 【修复】移除 isFist 检查：握拳只触发音色切换，不应阻止发声
    if (!this.leftHandState.visible) return;
    const baseScaleStep = this.musicManager.getScaleStepFromY(this.leftHandState.position.y);

    // 音符时值：基于密度 + 限幅（更短促更清晰）
    const numHits = patterns.rhythm.filter(v => v === 1).length || 1;
    const stepDuration = Tone.Time('16n').toSeconds();
    const avgGap = 16 / numHits; // 平均间隔（步）
    let noteDuration = avgGap * stepDuration * 0.8;
    // 限制在 16n*0.5 到 8n 之间
    const minDur = stepDuration * 0.5;
    const maxDur = stepDuration * 2.0; // 8n
    noteDuration = Math.max(minDur, Math.min(noteDuration, maxDur));

    // 微拨弦：和声音符按索引做 5–12ms 错位
    const microBase = 0.005; // 5ms
    const microStep = 0.004; // 4ms 递增

    // 【调试】追踪音符触发
    let triggeredCount = 0;

    patterns.harmony.forEach((isActive, harmonyIndex) => {
      if (isActive !== 1) return;
      const noteScaleStep = Math.min(this.musicManager.scale.length - 1, baseScaleStep + harmonyIndex);
      const micro = microBase + harmonyIndex * microStep;
      this.musicManager.triggerNote(noteScaleStep, velocity, noteDuration, time + micro);
      triggeredCount++;
      // 可视化
      this.visualRenderer.flashHarmony(harmonyIndex);
      if (this.visualRenderer.mode === 'rings') {
        const stepIndex = Math.floor(Tone.Transport.ticks / (Tone.Transport.PPQ / 4)) % 16;
        this.visualRenderer.addRingPulse(harmonyIndex, stepIndex, velocity);
      } else {
        this.visualRenderer.addAnimatedBar(harmonyIndex, this.sequenceTime);
      }
    });

    // 【调试】如果没有触发任何音符，输出调试信息
    if (triggeredCount === 0) {
      console.warn('⚠️ 没有音符触发！', {
        padPos: patterns.padPos,
        harmony: patterns.harmony,
        velocity,
        leftHandVolume: this.leftHandVolume
      });
    }
  }

  /**
   * 设置镜像切换
   */
  setupMirrorToggle() {
    if (this.mirrorToggleBtn) {
      // 初始状态
      this.updateMirrorButton();

      this.mirrorToggleBtn.addEventListener('click', () => {
        this.isMirrored = !this.isMirrored;
        this.updateVideoMirror();
        this.updateMirrorButton();
        console.log(`🔄 摄像头镜像: ${this.isMirrored ? '开启' : '关闭'}`);
      });
    }
  }

  /**
   * 更新视频镜像
   */
  updateVideoMirror() {
    if (this.videoElement) {
      this.videoElement.style.transform = this.isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
    }
  }

  /**
   * 更新镜像按钮状态
   */
  updateMirrorButton() {
    if (this.mirrorToggleBtn) {
      const mirrorText = this.isMirrored
        ? this.i18n.getText('camera.mirrorOn')
        : this.i18n.getText('camera.mirrorOff');
      this.mirrorToggleBtn.textContent = '🔄 ' + mirrorText;
      if (this.isMirrored) {
        this.mirrorToggleBtn.classList.add('active');
      } else {
        this.mirrorToggleBtn.classList.remove('active');
      }
    }
  }

  /**
   * 设置参数调节
   */
  setupParameterControls() {
    // Tempo 滑块
    if (this.tempoSlider && this.tempoValue) {
      this.tempoSlider.addEventListener('input', (e) => {
        const tempo = parseInt(e.target.value);
        this.tempoBPM = tempo;
        this.musicManager.setTempo(tempo);
        this.tempoValue.textContent = tempo;
        this.updateStatusBar();
      });
    }

    // Harmony Length 滑块
    if (this.harmonyLengthSlider && this.harmonyLengthValue) {
      this.harmonyLengthSlider.addEventListener('input', (e) => {
        const length = parseInt(e.target.value);
        this.euclideanEngine.setHarmonyLength(length);
        this.visualRenderer.setHarmonyLength(length);
        this.harmonyLengthValue.textContent = length;
      });
    }

    // Delay Wet
    if (this.delayWetSlider && this.delayWetValue) {
      this.delayWetSlider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        this.musicManager.setDelayWet(v);
        this.delayWetValue.textContent = v.toFixed(2);
      });
    }
    // Delay Time
    if (this.delayTimeSlider && this.delayTimeValue) {
      this.delayTimeSlider.addEventListener('input', (e) => {
        const i = parseInt(e.target.value);
        this.musicManager.setDelayTimeIndex(i);
        this.delayTimeValue.textContent = this.musicManager.getDelayTimeLabel();
      });
    }
    // Reverb Wet
    if (this.reverbWetSlider && this.reverbWetValue) {
      this.reverbWetSlider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        this.musicManager.setReverbWet(v);
        this.reverbWetValue.textContent = v.toFixed(2);
      });
    }
    // Visual mode
    if (this.visualModeSelect) {
      this.visualModeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        this.visualRenderer.setMode(mode);
      });
    }

    // Scale root/mode
    if (this.scaleRootSelect && this.scaleModeSelect) {
      const applyScale = () => {
        const root = this.scaleRootSelect.value;
        const mode = this.scaleModeSelect.value;
        this.musicManager.setScale(root, mode);
        // 更新状态栏（音阶标签会在左手移动后刷新）
      };
      this.scaleRootSelect.addEventListener('change', applyScale);
      this.scaleModeSelect.addEventListener('change', applyScale);
    }
  }

  /**
   * 初始化应用
   */
  async initialize() {
    try {
      console.log('🚀 开始初始化应用...');
      this.showLoading(this.i18n.getText('loading.initializing'));

      // 初始化手势追踪
      console.log('📹 初始化手势追踪...');
      await this.handTracker.initialize();
      console.log('✅ 手势追踪初始化完成');

      this.showLoading(this.i18n.getText('loading.waitForInteraction'));

      // 启动音频系统（需要用户交互，这里会在用户首次手势时启动）
      // 延迟隐藏加载提示，让用户看到提示信息
      setTimeout(() => {
        this.hideLoading();
      }, 2000);

      // 设置视频镜像
      this.updateVideoMirror();

      this.isInitialized = true;

      console.log('✅ 应用初始化完成');
      console.log('💡 提示：首次手势交互将启动音频系统');

      // 初始化状态栏
      this.updateStatusBar();

      // 开始主循环
      this.start();
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      console.error('错误详情:', error.stack);
      this.showError(`初始化失败: ${error.message}\n\n请检查：\n1. 摄像头权限是否允许\n2. 网络连接是否正常\n3. 浏览器是否支持 WebGL`);
    }
  }

  /**
   * 启动主循环
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();

    // 开始渲染循环
    this.loop();
  }

  /**
   * 主循环
   */
  loop = () => {
    const currentTime = performance.now();
    const dt = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    // 检测手势
    this.updateHands();

    // 处理左手控制
    this.updateLeftHandControl();

    // 处理右手控制
    this.updateRightHandControl();

    // 仅更新视觉的本地时间，音频触发改由 Transport 驱动
    this.updateMusicPlayback(dt);

    // 更新可视化
    this.updateVisualization(dt);

    // 更新 UI
    this.updateUI();

    // 继续循环
    if (this.isRunning) {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  }

  /**
   * 更新手势检测
   */
  updateHands() {
    if (!this.isInitialized) {
      console.warn('⚠️ 应用未初始化，跳过手势检测');
      return;
    }

    const processedHands = this.handTracker.detectHands();
    if (!processedHands) {
      // 静默返回，避免过多日志
      return;
    }

    // 处理左手（索引 0）
    const leftHand = processedHands[0];
    if (leftHand && leftHand.isVisible) {
      this.leftHandState.visible = true;
      this.leftHandState.landmarks = leftHand.landmarks;
      const wasFistBefore = this.leftHandState.isFist;
      this.leftHandState.isFist = leftHand.isFist;
      this.leftHandState.wasFist = wasFistBefore;

      // 获取手部位置
      const videoParams = this.handTracker.getVisibleVideoParameters();
      if (videoParams) {
        const center = this.handTracker.getHandCenter(leftHand.landmarks, videoParams, this.isMirrored);
        if (center) {
          this.leftHandState.position = center;
        } else {
          console.warn('⚠️ 左手位置计算失败');
        }

        // 计算拇指食指距离（音量控制）
        const pinchDistance = this.handTracker.getPinchDistance(leftHand.landmarks);
        if (pinchDistance !== null) {
          this.leftHandState.pinchDistance = pinchDistance;
        }
      } else {
        console.warn('⚠️ 视频参数获取失败');
      }
    } else {
      if (this.leftHandState.visible) {
        // 手部刚消失
        this.leftHandState.visible = false;
      }
    }

    // 处理右手（索引 1）
    const rightHand = processedHands[1];
    if (rightHand && rightHand.isVisible) {
      this.rightHandState.visible = true;
      this.rightHandState.landmarks = rightHand.landmarks;

      // 保存上一帧的捏合状态
      this.rightHandState.wasPinched = this.rightHandState.isPinched;

      // 检测捏合状态
      const isPinched = this.handTracker.isPinched(
        rightHand.landmarks,
        this.rightHandState.pinchThreshold
      );
      this.rightHandState.isPinched = isPinched;

      // 如果捏合，获取手部位置作为 XY Pad 坐标
      if (isPinched) {
        const videoParams = this.handTracker.getVisibleVideoParameters();
        if (videoParams) {
          // 使用捏合中心点作为 XY 坐标
          const center = this.handTracker.getPinchCenter(rightHand.landmarks, videoParams, this.isMirrored)
            || this.handTracker.getHandCenter(rightHand.landmarks, videoParams, this.isMirrored);
          if (center) {
            this.rightHandState.position = center;
          }
        }
      }
    } else {
      this.rightHandState.visible = false;
      this.rightHandState.isPinched = false;
    }
  }

  /**
   * 更新左手控制（音高、音量、音色切换）
   */
  updateLeftHandControl() {
    if (!this.leftHandState.visible) {
      // 左手消失，停止播放
      if (this.isPlaying) {
        this.isPlaying = false;
      }
      return;
    }

    // 确保音频已启动
    if (!this.musicManager.isStarted) {
      this.musicManager.start().catch(err => {
        console.error('❌ 音频启动失败:', err);
      });
      return; // 等待下一帧再继续
    }

    // 【修复】确保音频上下文处于活动状态
    this.musicManager.ensureAudioContext();

    // 1. 检测握拳手势（音色切换）
    if (this.leftHandState.isFist && !this.leftHandState.wasFist) {
      // 刚握拳，切换音色
      try {
        const newIndex = this.musicManager.cycleSynth();
        console.log(`🎹 切换到音色 ${newIndex}`);
        this.updateStatusBar(); // 更新状态栏
      } catch (error) {
        console.error('❌ 音色切换失败:', error);
      }
    }

    // 2. 如果不是握拳，控制音高和音量
    if (!this.leftHandState.isFist) {
      // 音高：Y 坐标映射到音阶
      const scaleStep = this.musicManager.getScaleStepFromY(
        this.leftHandState.position.y
      );
      this.leftHandState.currentNote = this.musicManager.scale[scaleStep];

      // 音量：拇指食指距离
      // 【修复】当手离屏幕远时，归一化距离变小，需要补偿
      // 使用更宽松的系数和更高的最小值
      const normalizedDistance = Math.min(1, this.leftHandState.pinchDistance * 8);
      // 最小音量提高到 0.4，确保远距离时仍有足够音量
      this.leftHandVolume = Math.max(0.4, Math.min(1.0, normalizedDistance));
    } else {
      // 【修复】握拳期间保留最后音高位置，不强制停止播放
      // isPlaying 的控制权完全归右手捏合状态管理
    }
  }

  /**
   * 更新右手控制（XY Pad）
   * 只要捏合就保持在坐标轴中，持续播放
   */
  updateRightHandControl() {
    // 右手捏合状态变化
    const justPinched = this.rightHandState.isPinched && !this.rightHandState.wasPinched;
    const justReleased = !this.rightHandState.isPinched && this.rightHandState.wasPinched;

    if (justPinched) {
      // 刚开始捏合，激活 XY Pad
      console.log('👉 右手捏合激活 XY Pad');
      this.isPlaying = true;

      // 更新 XY Pad 位置
      this.euclideanEngine.setPadPosition(
        this.rightHandState.position.x,
        this.rightHandState.position.y
      );
    } else if (this.rightHandState.isPinched) {
      // 持续捏合：无论是否移动，都保持在坐标轴中并持续更新
      // 更新 XY Pad 位置（即使位置不变也更新，确保模式正确）
      this.euclideanEngine.setPadPosition(
        this.rightHandState.position.x,
        this.rightHandState.position.y
      );
      this.isPlaying = true; // 确保播放状态
    } else if (justReleased) {
      // 刚松开，停止播放
      console.log('👉 右手松开，停止播放');
      this.isPlaying = false;
      this.sequenceTime = 0; // 重置序列时间
      this.lastTriggeredStep = -1;
    }
  }

  /**
   * 更新音乐播放（欧几里得模式）
   * 只要 isPlaying 为 true 且右手捏合，就持续播放
   */
  updateMusicPlayback(dt) {
    // 仅推进可视化用的本地相位，音频触发由 Transport 回调处理
    const sequenceDuration = (60 / this.tempoBPM) * (16 / 4);
    this.sequenceTime = (this.sequenceTime + dt) % sequenceDuration;
  }

  /**
   * 更新可视化
   */
  updateVisualization(dt) {
    const patterns = this.euclideanEngine.getPatterns();
    const currentStep = Math.floor((this.sequenceTime / ((60 / this.tempoBPM) * (16 / 4))) * 16);

    this.visualRenderer.update(
      dt,
      this.tempoBPM,
      patterns.rhythm,
      currentStep,
      this.rightHandState.isPinched && this.isPlaying
    );

    this.visualRenderer.render(
      patterns.harmony,
      patterns.rhythm,
      patterns.padPos,
      {
        left: {
          visible: this.leftHandState.visible,
          position: this.leftHandState.position
        },
        right: {
          visible: this.rightHandState.visible,
          position: this.rightHandState.position
        }
      },
      this.rightHandState.isPinched,
      this.tempoBPM
    );
  }

  /**
   * 更新 UI 状态显示
   */
  updateUI() {
    // 左手状态
    if (this.leftHandState.visible) {
      if (this.leftHandState.isFist) {
        this.leftHandStatus.textContent = this.i18n.getText('status.fist');
      } else {
        this.leftHandStatus.textContent = `${this.i18n.getText('status.normal')} (${this.leftHandState.currentNote || 'N/A'})`;
      }
    } else {
      this.leftHandStatus.textContent = this.i18n.getText('status.notDetected');
    }

    // 右手状态
    if (this.rightHandState.visible) {
      if (this.rightHandState.isPinched) {
        this.rightHandStatus.textContent = this.i18n.getText('status.pinching');
      } else {
        this.rightHandStatus.textContent = this.i18n.getText('status.notPinching');
      }
    } else {
      this.rightHandStatus.textContent = this.i18n.getText('status.notDetected');
    }

    // XY Pad 状态
    if (this.rightHandState.isPinched && this.isPlaying) {
      const pos = this.euclideanEngine.padPos;
      this.padStatus.textContent = `${this.i18n.getText('status.activated')} (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`;
    } else {
      this.padStatus.textContent = this.i18n.getText('status.notActivated');
    }

    // 更新状态栏
    this.updateStatusBar();
  }

  /**
   * 更新状态栏（中间上方）
   */
  updateStatusBar() {
    if (!this.statusSynth || !this.statusCoords || !this.statusNote || !this.statusTempo) {
      return;
    }

    // 音色
    const synthIndex = this.musicManager.getCurrentSynthIndex();
    this.statusSynth.textContent = this.synthNames[synthIndex] || 'Unknown';

    // 坐标
    const patterns = this.euclideanEngine.getPatterns();
    this.statusCoords.textContent = `(${patterns.padPos.x.toFixed(2)}, ${patterns.padPos.y.toFixed(2)})`;

    // 音阶（左手当前音符）
    if (this.leftHandState.visible && this.leftHandState.currentNote) {
      this.statusNote.textContent = this.leftHandState.currentNote;
    } else {
      this.statusNote.textContent = 'N/A';
    }

    // 节拍
    this.statusTempo.textContent = `${this.tempoBPM} BPM`;
  }

  /**
   * 显示加载提示
   */
  showLoading(message) {
    if (this.loadingElement) {
      this.loadingElement.textContent = message || '正在加载...';
      this.loadingElement.classList.remove('hidden');
    }
  }

  /**
   * 隐藏加载提示
   */
  hideLoading() {
    if (this.loadingElement) {
      this.loadingElement.classList.add('hidden');
    }
  }

  /**
   * 显示错误
   */
  showError(message) {
    if (this.errorElement) {
      this.errorElement.textContent = message;
      this.errorElement.classList.remove('hidden');
    }
    this.hideLoading();
  }

  /**
   * 停止应用
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

// 启动应用
let app = null;

document.addEventListener('DOMContentLoaded', async () => {
  app = new HandMusicApp();
  await app.initialize();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (app) {
    app.stop();
  }
});

