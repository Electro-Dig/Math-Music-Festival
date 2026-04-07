/**
 * 音乐管理器（简化版）
 * 保留 arpeggiator-remix 的音色库，适配欧几里得模式
 */

export class MusicManager {
  constructor() {
    this.polySynth = null;
    this.reverb = null;
    this.delay = null;
    this.analyser = null;
    this.isStarted = false;

    // 音色预设（从 arpeggiator-remix 保留）
    this.synthPresets = [
      // Preset 0: DX7 E.PIANO 1 - Classic Electric Piano
      {
        harmonicity: 14,
        modulationIndex: 4.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 1.2 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.8 },
        effects: { reverbWet: 0.2, delayWet: 0.05 }
      },
      // Preset 1: DX7 BRASS 1 - Classic Brass Sound
      {
        harmonicity: 2,
        modulationIndex: 12,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.6 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.05, decay: 0.1, sustain: 0.6, release: 0.4 },
        effects: { reverbWet: 0.15, delayWet: 0.02 }
      },
      // Preset 2: DX7 MARIMBA - Classic Mallet Percussion
      {
        harmonicity: 3,
        modulationIndex: 6,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.8 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.005, decay: 0.3, sustain: 0.05, release: 0.6 },
        effects: { reverbWet: 0.25, delayWet: 0.08 }
      },
      // Preset 3: Original Clean Sine Wave
      {
        harmonicity: 4,
        modulationIndex: 3,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 1.0 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.1, decay: 0.01, sustain: 1, release: 0.5 },
        effects: { reverbWet: 0.3, delayWet: 0.1 }
      },
      // Preset 4: DX7 SYNTHWAVE LEAD
      {
        harmonicity: 1.5,
        modulationIndex: 15,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.8 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.02, decay: 0.05, sustain: 0.8, release: 0.3 },
        effects: { reverbWet: 0.1, delayWet: 0.15 }
      },
      // Preset 5: DX7 CRYSTAL PLUCK
      {
        harmonicity: 7,
        modulationIndex: 8,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.3, sustain: 0.15, release: 0.5 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.4 },
        effects: { reverbWet: 0.3, delayWet: 0.12 }
      },
      // Preset 6: E-BELL SOFT
      {
        harmonicity: 4.5,
        modulationIndex: 12,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 1.2, sustain: 0.0, release: 2.0 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.001, decay: 1.0, sustain: 0.0, release: 1.5 },
        effects: { reverbWet: 0.35, delayWet: 0.08 }
      },
      // Preset 7: BR LEAD 80s
      {
        harmonicity: 1.0,
        modulationIndex: 11,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.08, decay: 0.25, sustain: 0.9, release: 1.2 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.9 },
        effects: { reverbWet: 0.25, delayWet: 0.15 }
      },
      // Preset 8: KALIMBA - 卡林巴，温暖拨弦，余韵自然飘散
      {
        harmonicity: 3.5,
        modulationIndex: 5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.6, sustain: 0.0, release: 1.8 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0.0, release: 1.2 },
        effects: { reverbWet: 0.45, delayWet: 0.15 }
      },
      // Preset 9: GLASS HARP - 玻璃琴，晶莹剔透，持续飘逸
      {
        harmonicity: 6,
        modulationIndex: 2.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.08, decay: 0.4, sustain: 0.6, release: 2.5 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 2.0 },
        effects: { reverbWet: 0.55, delayWet: 0.08 }
      },
      // Preset 10: THUMB PIANO SOFT - 软拨弦，圆润轻盈
      {
        harmonicity: 2.5,
        modulationIndex: 3.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.5, sustain: 0.05, release: 1.4 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.001, decay: 0.35, sustain: 0.02, release: 1.0 },
        effects: { reverbWet: 0.4, delayWet: 0.22 }
      },
      // Preset 11: WIND CHIME - 风铃，空灵短促，飘渺清脆
      {
        harmonicity: 9,
        modulationIndex: 7,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.25, sustain: 0.0, release: 1.2 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.001, decay: 0.18, sustain: 0.0, release: 0.9 },
        effects: { reverbWet: 0.6, delayWet: 0.28 }
      }
    ];

    this.currentSynthIndex = 0;

    // 音阶（用于左手控制音高）
    this.scale = [];
    this.scaleRoot = 'C';
    this.scaleMode = 'minorPentatonic';

    // 延迟参数
    this.delayTimes = ['16n', '8n', '4n', '2n', '1n'];
    this.delayTimeIndex = 1; // 默认 8n
    this.delayWet = 0.20;

    // 初始化默认音阶
    this.setScale(this.scaleRoot, this.scaleMode);
  }

  /**
   * 启动音频系统
   */
  async start() {
    if (this.isStarted) return;

    await Tone.start();

    // 创建主限幅器
    const masterLimiter = new Tone.Limiter(-1);
    Tone.Destination.chain(masterLimiter);

    // 创建混响
    this.reverb = new Tone.Reverb({
      decay: 5,
      preDelay: 0.0,
      wet: 0.22 // 降低混响湿度，增强清晰度
    }).toDestination();

    // 创建分析器
    this.analyser = new Tone.Analyser('waveform', 1024);

    // 创建延迟并连接到混响
    this.delay = new Tone.FeedbackDelay(this.delayTimes[this.delayTimeIndex], 0.35).connect(this.reverb);
    this.delay.wet.value = this.delayWet;

    // 创建合成器
    this.polySynth = new Tone.PolySynth(
      Tone.FMSynth,
      this.synthPresets[this.currentSynthIndex]
    );

    // 【修复】完善信号链路：
    // 1. 干信号直接到混响（确保始终有声音）
    // 2. 湿信号通过延迟效果器
    this.polySynth.connect(this.reverb);          // 干信号路径
    this.polySynth.connect(this.delay);           // 湿信号路径（延迟效果）
    this.polySynth.connect(this.analyser);        // 分析器（可视化用）
    this.polySynth.volume.value = -12;

    // 设置节拍
    Tone.Transport.bpm.value = 120;
    Tone.Transport.start();

    this.isStarted = true;
    console.log('✅ MusicManager 已启动');
    console.log('🔊 信号链路：Synth -> [Reverb + Delay + Analyser]');
  }

  /**
   * 切换音色
   */
  cycleSynth() {
    if (!this.polySynth || !this.isStarted) return this.currentSynthIndex;

    try {
      // 【修复】先保存旧合成器引用，标记为待销毁
      const oldSynth = this.polySynth;
      this._pendingDispose = oldSynth;

      // 停止所有正在播放的音符
      try {
        oldSynth.releaseAll();
      } catch (e) {
        // 忽略 releaseAll 错误
      }

      // 切换到下一个音色
      this.currentSynthIndex = (this.currentSynthIndex + 1) % this.synthPresets.length;
      const newPreset = this.synthPresets[this.currentSynthIndex];

      // 【修复】先创建新合成器并完成连接，再标记旧的可销毁
      const newSynth = new Tone.PolySynth(Tone.FMSynth, newPreset);
      newSynth.volume.value = -12;

      // 【修复】完整连接新合成器到所有目标
      newSynth.connect(this.reverb);   // 干信号
      newSynth.connect(this.delay);    // 湿信号
      newSynth.connect(this.analyser); // 分析器

      // 新合成器就位后再更新引用
      this.polySynth = newSynth;

      // 更新效果参数
      if (newPreset.effects && this.reverb) {
        this.reverb.wet.value = newPreset.effects.reverbWet || 0.4;
      }

      // 【修复】延长 dispose 时间，确保旧音符完全释放
      setTimeout(() => {
        if (this._pendingDispose === oldSynth) {
          try {
            oldSynth.disconnect();
            oldSynth.dispose();
          } catch (error) {
            // 静默处理，不输出警告
          }
          this._pendingDispose = null;
        }
      }, 300); // 延长到 300ms

      console.log(`🎹 切换到音色预设: ${this.currentSynthIndex}`);
      return this.currentSynthIndex;
    } catch (error) {
      console.error('❌ 音色切换错误:', error);
      return this.currentSynthIndex;
    }
  }

  /**
   * 【修复】检查并恢复音频上下文
   */
  async ensureAudioContext() {
    if (Tone.context.state === 'suspended') {
      console.log('🔄 音频上下文已暂停，正在恢复...');
      await Tone.context.resume();
      console.log('✅ 音频上下文已恢复');
    }
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
      console.log('▶️ Transport 已重新启动');
    }
  }

  /**
   * 触发音符（用于欧几里得模式）
   * @param {number} scaleStep - 音阶中的步进（0-based）
   * @param {number} velocity - 力度 (0-1)
   * @param {number} duration - 持续时间（秒）
   * @param {number} time - 触发时间（Tone.js 时间）
   */
  triggerNote(scaleStep, velocity, duration, time) {
    // 【修复】检查合成器状态
    if (!this.polySynth) {
      console.warn('⚠️ 合成器未初始化');
      return;
    }

    // 【修复】检查是否正在切换音色
    if (this._pendingDispose === this.polySynth) {
      console.warn('⚠️ 合成器正在切换，跳过此音符');
      return;
    }

    if (scaleStep < 0 || scaleStep >= this.scale.length) {
      return;
    }

    const note = this.scale[scaleStep];
    const clampedVelocity = Math.max(0.1, Math.min(1.0, velocity));

    try {
      this.polySynth.triggerAttackRelease(
        note,
        duration || 0.2,
        time || Tone.now(),
        clampedVelocity
      );
    } catch (error) {
      // 【修复】捕获触发错误，避免崩溃
      if (error.message && error.message.includes('disposed')) {
        console.warn('⚠️ 合成器已销毁，跳过音符');
      } else {
        console.error('❌ 音符触发错误:', error.message);
      }
    }
  }

  /**
   * 根据归一化 Y 坐标获取音阶步进
   */
  getScaleStepFromY(normalizedY) {
    const noteIndex = Math.floor((1 - normalizedY) * this.scale.length);
    return Math.max(0, Math.min(this.scale.length - 1, noteIndex));
  }

  /**
   * 获取当前音色索引
   */
  getCurrentSynthIndex() {
    return this.currentSynthIndex;
  }

  /**
   * 设置节拍
   */
  setTempo(bpm) {
    if (Tone.Transport.state === 'started') {
      Tone.Transport.bpm.rampTo(bpm, 0.1);
    } else {
      Tone.Transport.bpm.value = bpm;
    }
  }

  /**
   * 获取节拍
   */
  getTempo() {
    return Tone.Transport.bpm.value;
  }

  /**
   * 设置延迟湿度（0..1）
   */
  setDelayWet(value) {
    this.delayWet = Math.max(0, Math.min(1, value));
    if (this.delay) this.delay.wet.value = this.delayWet;
  }

  /**
   * 设置延迟时间（通过索引映射到音符时值）
   */
  setDelayTimeIndex(idx) {
    const i = Math.max(0, Math.min(this.delayTimes.length - 1, idx | 0));
    this.delayTimeIndex = i;
    if (this.delay) this.delay.delayTime.value = this.delayTimes[i];
  }

  /**
   * 设置混响湿度（0..1）
   */
  setReverbWet(value) {
    const v = Math.max(0, Math.min(1, value));
    if (this.reverb) this.reverb.wet.value = v;
  }

  getDelayWet() { return this.delayWet; }
  getDelayTimeLabel() { return this.delayTimes[this.delayTimeIndex] || '8n'; }

  /**
   * 设置音阶根音与调式，并生成 3~6 八度的音阶列表
   */
  setScale(root = 'C', mode = 'minorPentatonic') {
    this.scaleRoot = root;
    this.scaleMode = mode;
    const intervals = this.getModeIntervals(mode);
    const rootMidi = this.noteNameToMidi(`${root}3`); // 从 3 八度开始
    const notes = [];
    for (let oct = 0; oct <= 3; oct++) { // 3..6 八度
      const base = rootMidi + oct * 12;
      intervals.forEach(semi => {
        const midi = base + semi;
        const note = Tone.Frequency(midi, 'midi').toNote();
        notes.push(note);
      });
    }
    // 去重并排序（保证从低到高）
    this.scale = notes;
  }

  /** 调式到半音间隔 */
  getModeIntervals(mode) {
    const modes = {
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10], // 自然小调
      dorian: [0, 2, 3, 5, 7, 9, 10],
      phrygian: [0, 1, 3, 5, 7, 8, 10],
      lydian: [0, 2, 4, 6, 7, 9, 11],
      mixolydian: [0, 2, 4, 5, 7, 9, 10],
      locrian: [0, 1, 3, 5, 6, 8, 10],
      majorPentatonic: [0, 2, 4, 7, 9],
      minorPentatonic: [0, 3, 5, 7, 10],
      chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    };
    return modes[mode] || modes.minorPentatonic;
  }

  /** 根音名映射到 midi（给 3 八度使用） */
  noteNameToMidi(name) {
    return Tone.Frequency(name).toMidi();
  }
}

