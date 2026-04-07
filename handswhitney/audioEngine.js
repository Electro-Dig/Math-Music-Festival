import * as Tone from 'https://esm.sh/tone';

// 多种基础音色预设：钢琴、Clean Sine、DX7 E.Piano、Bell（基于 FMSynth）
// 注意：release 时间已优化，避免过长导致复音堆积
const SYNTH_PRESETS = {
  piano: {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.15, release: 0.3 },
    modulation: { type: 'triangle' },
    modulationEnvelope: { attack: 0.02, decay: 0.1, sustain: 0.15, release: 0.25 },
    volume: -6
  },
  cleanSine: {
    harmonicity: 4,
    modulationIndex: 3,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.4 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.05, decay: 0.01, sustain: 0.5, release: 0.3 },
    volume: -8
  },
  dx7EPiano: {
    harmonicity: 14,
    modulationIndex: 4.5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.3, release: 0.5 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.15, release: 0.4 },
    effects: { chorusWet: 0.2 },
    volume: -7
  },
  bell: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.0, release: 0.8 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.02, decay: 0.3, sustain: 0.0, release: 0.6 },
    volume: -12
  },
  // 为泛音列模式优化的纯净正弦波
  pureHarmonic: {
    harmonicity: 1,
    modulationIndex: 0,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.4 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.3 },
    volume: -10
  },
  // 为微分音模式优化的幽微音色
  ethereal: {
    harmonicity: 2,
    modulationIndex: 1,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.35, sustain: 0.3, release: 0.6 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.03, decay: 0.2, sustain: 0.2, release: 0.5 },
    effects: { chorusWet: 0.15 },
    volume: -9
  },
  // 为科幻模式优化的脉冲低音
  sciFiPulse: {
    harmonicity: 0.5,
    modulationIndex: 8,
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.08, release: 0.15 },
    modulation: { type: 'square' },
    modulationEnvelope: { attack: 0.01, decay: 0.08, sustain: 0.1, release: 0.1 },
    volume: -14
  },
};

/**
 * 音阶模式定义
 * - classic: 传统钢琴音阶（12-TET，半音递增）
 * - harmonics20Hz: 物理泛音列，基频 20Hz，第 n 颗点 = 20 * n Hz
 * - microtones: 48-TET 微分音，基频 C2，极小音程丝滑过渡
 * - sciFiReversed: 120 点翻转映射，内圈快=低音，外圈慢=高泛音
 */
export const SCALE_MODES = {
  classic: {
    id: 'classic',
    name: 'Classic (12-TET)',
    nameZh: '经典钢琴音阶',
    description: 'Standard piano scale, semitone increments',
    descriptionZh: '标准钢琴音阶，半音递增',
    recommendedTines: 48,
    recommendedPreset: 'piano',
  },
  harmonics20Hz: {
    id: 'harmonics20Hz',
    name: 'Harmonics 20Hz',
    nameZh: '基础共振版',
    description: 'Physical harmonic series, base frequency 20Hz',
    descriptionZh: '物理泛音列，20Hz为基频，纯净共鸣',
    recommendedTines: 48,
    recommendedPreset: 'pureHarmonic',
    baseFrequency: 20,
  },
  microtones: {
    id: 'microtones',
    name: 'Microtones (48-TET)',
    nameZh: '幽微感微分音',
    description: '48-tone equal temperament, silky smooth transitions',
    descriptionZh: '48平均律微分音，音程极小如水流般丝滑',
    recommendedTines: 48,
    recommendedPreset: 'ethereal',
    baseFrequency: 65.41, // C2
    divisions: 48,
  },
  sciFiReversed: {
    id: 'sciFiReversed',
    name: 'Sci-Fi Reversed',
    nameZh: '科幻感高密度版',
    description: '120 tines, reversed mapping - fast inner = low bass',
    descriptionZh: '120点翻转映射，内圈快速低音产生未来感',
    recommendedTines: 120,
    recommendedPreset: 'sciFiPulse',
    baseFrequency: 30, // 稍高一点避免过于低沉
  },
};

export class WhitneyAudioEngine {
  constructor(tineCount = 48, baseNote = 'A2') {
    this.tineCount = tineCount;
    this.baseNote = baseNote;
    this.transposeSemitones = 0;

    this.currentPresetKey = 'piano';
    this.currentScaleMode = 'classic'; // 当前音阶模式

    // 音符管理：跟踪活跃音符和上次触发时间
    this.activeNotes = new Set(); // 当前活跃的音符
    this.lastTriggerTime = 0; // 上次触发时间戳
    this.minTriggerInterval = 30; // 最小触发间隔（毫秒）
    this.noteCleanupInterval = null; // 定期清理的定时器

    // 输出链：PolySynth → Chorus → MasterGain → Limiter → Destination
    // Limiter 防止在高复音下发生明显削波爆音
    this.limiter = new Tone.Limiter(-3).toDestination();
    // master 音量节点，方便全局控制
    this.masterGain = new Tone.Gain(1).connect(this.limiter);
    // 合唱（Pad/EPiano 需要），默认 wet=0 即无感
    this.chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 2.5, depth: 0.3, wet: 0.0 })
      .start()
      .connect(this.masterGain);

    // 使用 FMSynth，设置较高的 maxPolyphony 以避免 Note dropped
    // 使用 tineCount * 3 来容纳多帧重叠的音符
    const maxPoly = Math.max(64, this.tineCount * 3);
    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: maxPoly,
    }).connect(this.chorus);

    this.scale = this._buildScale();
    this._updateOutputGain();
    this._applyPreset(this.currentPresetKey);

    // 启动定期清理机制（每 2 秒清理一次可能卡住的音符）
    this._startNoteCleanup();
  }

  /**
   * 启动定期音符清理，防止音符堆积
   */
  _startNoteCleanup() {
    if (this.noteCleanupInterval) {
      clearInterval(this.noteCleanupInterval);
    }
    this.noteCleanupInterval = setInterval(() => {
      // 如果活跃音符过多，强制释放所有音符
      if (this.activeNotes.size > this.tineCount) {
        this._releaseAllNotes();
      }
    }, 2000);
  }

  /**
   * 释放所有当前活跃的音符
   */
  _releaseAllNotes() {
    try {
      this.synth.releaseAll();
      this.activeNotes.clear();
    } catch (e) {
      // ignore errors during cleanup
    }
  }

  /**
   * 根据当前音阶模式构建频率数组
   */
  _buildScale() {
    const result = [];
    const mode = SCALE_MODES[this.currentScaleMode] || SCALE_MODES.classic;

    for (let i = 0; i < this.tineCount; i += 1) {
      const tineId = i + 1; // 1-based
      let freq;

      switch (this.currentScaleMode) {
        case 'harmonics20Hz':
          // 物理泛音列：频率 = 20 * tine_id
          freq = (mode.baseFrequency || 20) * tineId;
          break;

        case 'microtones':
          // 48-TET 微分音：频率 = 基频 * 2^(tine_id / 48)
          freq = (mode.baseFrequency || 65.41) * Math.pow(2, i / (mode.divisions || 48));
          break;

        case 'sciFiReversed':
          // 翻转映射：id 最大的点（内圈快）对应最低频率
          // 频率 = 基频 * (tineCount + 1 - tine_id)
          freq = (mode.baseFrequency || 30) * (this.tineCount + 1 - tineId);
          break;

        case 'classic':
        default:
          // 经典 12-TET：基于 baseNote 的半音递增
          freq = Tone.Frequency(this.baseNote).transpose(
            i + this.transposeSemitones,
          );
          break;
      }

      result.push(freq);
    }
    return result;
  }

  _applyPreset(key) {
    const preset = SYNTH_PRESETS[key];
    if (!preset) return;
    this.currentPresetKey = key;
    try {
      this.synth.set(preset);
    } catch (e) {
      // 向后兼容：某些字段（effects 等）不被 set 接受时忽略
      const safe = { ...preset };
      delete safe.effects;
      this.synth.set(safe);
    }
    // 应用效果
    try {
      const chorusWet = preset.effects && typeof preset.effects.chorusWet === 'number'
        ? preset.effects.chorusWet
        : 0.0;
      if (this.chorus) this.chorus.wet.value = chorusWet;
    } catch (e) {
      // ignore effect errors
    }
  }

  /**
   * 根据 tine 数量动态调节总输出增益，数量越多整体越小，降低爆音风险
   */
  _updateOutputGain() {
    if (!this.masterGain) return;
    const baseVoices = 24; // 参考基准：24 根 tine 时增益接近 1
    const ratio = baseVoices / this.tineCount;
    // 线性缩放（比平方根更快收敛），并限制在 [0.08, 1] 区间
    // 120 tine 对应系数 = 24/120 = 0.2，加上科幻模式的额外衰减，实际得到更低增益
    let scale = Math.max(0.08, Math.min(1, ratio));
    // 科幻模式额外衰减：-6dB ≈ 乘以 0.5
    if (this.currentScaleMode === 'sciFiReversed' || this.tineCount >= 120) {
      scale *= 0.5;
    }
    this.masterGain.gain.value = scale;
  }

  /**
   * 设置音阶模式
   * @param {string} modeId - 模式 ID（classic, harmonics20Hz, microtones, sciFiReversed）
   * @param {boolean} autoApplyPreset - 是否自动应用推荐的音色预设
   * @returns {Object} 模式信息
   */
  setScaleMode(modeId, autoApplyPreset = true) {
    const mode = SCALE_MODES[modeId];
    if (!mode) {
      console.warn(`Unknown scale mode: ${modeId}`);
      return SCALE_MODES[this.currentScaleMode];
    }

    this.currentScaleMode = modeId;

    // 如果模式有推荐的 tineCount，自动调整
    if (mode.recommendedTines && mode.recommendedTines !== this.tineCount) {
      this.tineCount = mode.recommendedTines;
      this._updateOutputGain();
      // 调整复音上限，使用 tineCount * 3 以避免 Note dropped
      if (this.synth) {
        try {
          this.synth.maxPolyphony = Math.max(64, this.tineCount * 3);
        } catch (e) {
          // ignore
        }
      }
      // 释放现有音符避免切换时的卡顿
      this._releaseAllNotes();
    }

    // 重建音阶
    this.scale = this._buildScale();

    // 自动应用推荐的音色预设
    if (autoApplyPreset && mode.recommendedPreset) {
      this._applyPreset(mode.recommendedPreset);
    }

    return mode;
  }

  /**
   * 获取当前音阶模式
   */
  getScaleMode() {
    return this.currentScaleMode;
  }

  /**
   * 获取所有可用的音阶模式
   */
  static getAvailableScaleModes() {
    return SCALE_MODES;
  }

  cyclePreset() {
    const keys = Object.keys(SYNTH_PRESETS);
    const idx = keys.indexOf(this.currentPresetKey);
    const nextKey = keys[(idx + 1) % keys.length];
    this._applyPreset(nextKey);
    return nextKey;
  }

  setPreset(key) {
    if (SYNTH_PRESETS[key]) {
      this._applyPreset(key);
      return key;
    }
    return this.currentPresetKey;
  }

  setVolume(normalized) {
    // normalized: 0..1 → 增益或 dB
    const value = Math.max(0, Math.min(1, normalized));
    const db = Tone.gainToDb(value || 0.0001);
    this.synth.volume.value = db;
  }

  setTranspose(semitones) {
    const clamped = Math.max(-24, Math.min(24, Math.round(semitones)));
    if (clamped === this.transposeSemitones) return;
    this.transposeSemitones = clamped;
    this.scale = this._buildScale();
  }

  getTranspose() {
    return this.transposeSemitones;
  }

  getCurrentPresetKey() {
    return this.currentPresetKey;
  }

  setTineCount(count) {
    const c = Math.max(1, Math.floor(count));
    if (c === this.tineCount) return;
    this.tineCount = c;
    this.scale = this._buildScale();
    this._updateOutputGain();
    // 调整复音上限，使用 tineCount * 3 以避免 Note dropped
    if (this.synth) {
      try {
        this.synth.maxPolyphony = Math.max(64, this.tineCount * 3);
      } catch (e) {
        // ignore
      }
    }
    // 释放现有音符避免切换时的卡顿
    this._releaseAllNotes();
  }

  getTineCount() {
    return this.tineCount;
  }

  /**
   * 根据 Whitney 的 tine ID 数组触发音符
   * @param {number[]} tineIds 1-based 索引
   */
  triggerNotesForTines(tineIds) {
    if (!tineIds || tineIds.length === 0) return;

    // 触发频率限制：避免过于频繁的触发导致复音堆积
    const now = performance.now();
    if (now - this.lastTriggerTime < this.minTriggerInterval) {
      // 如果距离上次触发时间太短，跳过本次
      return;
    }
    this.lastTriggerTime = now;

    // 收集有效音符
    const notes = [];
    for (const id of tineIds) {
      const idx = id - 1;
      if (idx >= 0 && idx < this.scale.length) {
        notes.push(this.scale[idx]);
      }
    }

    if (notes.length === 0) return;

    // 动态计算每帧最大音符数：基于当前 tineCount 和模式
    // 较少的音符数 = 更稳定的音频，避免复音超限
    let maxNotesPerTick;
    if (this.currentScaleMode === 'sciFiReversed') {
      maxNotesPerTick = 8; // 120 tines 模式使用更严格的限制
    } else if (this.tineCount > 72) {
      maxNotesPerTick = 12;
    } else if (this.tineCount > 48) {
      maxNotesPerTick = 16;
    } else {
      maxNotesPerTick = 20;
    }

    // 如果音符数超过限制，进行均匀采样
    let notesToPlay = notes;
    if (notes.length > maxNotesPerTick) {
      const step = Math.ceil(notes.length / maxNotesPerTick);
      notesToPlay = notes.filter((_, idx) => idx % step === 0);
    }

    // 如果活跃音符过多，先释放所有音符
    if (this.activeNotes.size > this.tineCount * 2) {
      this._releaseAllNotes();
    }

    // 根据模式选择音符时值：更短的时值 = 更快释放 = 更少复音堆积
    let duration;
    if (this.currentScaleMode === 'sciFiReversed') {
      duration = '32n'; // 极短脉冲
    } else if (this.currentScaleMode === 'harmonics20Hz') {
      duration = '16n'; // 泛音模式用短音符
    } else if (this.currentScaleMode === 'microtones') {
      duration = '8n'; // 微分音保持中等长度以重叠
    } else {
      duration = '8n'; // 经典模式
    }

    // 触发音符，使用 try-catch 防止错误中断
    try {
      this.synth.triggerAttackRelease(notesToPlay, duration);
      // 更新活跃音符集合
      notesToPlay.forEach(note => this.activeNotes.add(String(note)));
    } catch (e) {
      // 如果触发失败，尝试释放所有音符后重试
      console.warn('Note trigger failed, releasing all notes:', e.message);
      this._releaseAllNotes();
    }
  }

  /**
   * 清理资源（组件卸载时调用）
   */
  dispose() {
    if (this.noteCleanupInterval) {
      clearInterval(this.noteCleanupInterval);
      this.noteCleanupInterval = null;
    }
    this._releaseAllNotes();
    if (this.synth) {
      this.synth.dispose();
    }
    if (this.chorus) {
      this.chorus.dispose();
    }
    if (this.masterGain) {
      this.masterGain.dispose();
    }
    if (this.limiter) {
      this.limiter.dispose();
    }
  }
}
