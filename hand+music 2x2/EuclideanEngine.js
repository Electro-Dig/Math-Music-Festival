/**
 * 欧几里得算法引擎
 * 从 euclidean_xy_pad.html 提取并重构
 */

export class EuclideanEngine {
  constructor() {
    // 常量
    this.RHYTHM_STEPS = 16;
    this.HIGH_VELOCITY = 1.0;
    this.LOW_VELOCITY = 0.5; // 拉大强弱对比
    
    // 节奏预设：{ events: 事件数, accents: 重音数 }
    this.RHYTHM_PRESETS = [
      { e: 3, a: 1 },
      { e: 4, a: 1 },
      { e: 5, a: 2 },
      { e: 6, a: 2 },
      { e: 7, a: 3 },
      { e: 8, a: 3 },
      { e: 9, a: 4 },
      { e: 11, a: 5 },
      { e: 16, a: 16 }
    ];
    
    // 状态
    this.harmonyLength = 8;
    this.padPos = { x: 0.5, y: 0.5 };
    
    // 模式
    this.harmonyPattern = [];
    this.rhythmPattern = [];
    this.velocityPattern = [];
  }
  
  /**
   * 欧几里得算法：生成均匀分布的模式
   * @param {number} events - 事件数量
   * @param {number} length - 模式长度
   * @returns {Array<number>} 模式数组（1 表示事件，0 表示空）
   */
  generateEuclidean(events, length) {
    const k = Math.round(events);
    const n = Math.round(length);
    
    if (k > n || k <= 0 || n <= 0) {
      return new Array(n > 0 ? n : 0).fill(0);
    }
    
    const pattern = [];
    for (let i = 0; i < n; i++) {
      pattern.push(
        Math.floor(i * k / n) !== Math.floor((i - 1) * k / n)
      );
    }
    
    return pattern.map(v => v ? 1 : 0);
  }
  
  /**
   * 更新模式：根据 XY Pad 位置生成和声和节奏模式
   */
  updatePatterns() {
    // Y 轴 -> 和声复杂度（向上 = 更多音符）
    // 翻转 Y 轴，使得向上时和声更复杂
    const harmonyEvents = Math.floor((1 - this.padPos.y) * (this.harmonyLength - 1)) + 1;
    this.harmonyPattern = this.generateEuclidean(harmonyEvents, this.harmonyLength);
    
    // X 轴 -> 节奏预设
    const rhythmIndex = Math.floor(this.padPos.x * this.RHYTHM_PRESETS.length);
    const preset = this.RHYTHM_PRESETS[Math.min(rhythmIndex, this.RHYTHM_PRESETS.length - 1)];
    
    // 生成节奏模式
    this.rhythmPattern = this.generateEuclidean(preset.e, this.RHYTHM_STEPS);
    
    // 生成重音模式
    const accentEuclidean = this.generateEuclidean(preset.a, preset.e);
    
    // 应用重音到速度模式
    this.velocityPattern = new Array(this.RHYTHM_STEPS).fill(0);
    let hitCounter = 0;
    
    for (let i = 0; i < this.RHYTHM_STEPS; i++) {
      if (this.rhythmPattern[i] === 1) {
        if (preset.e > 0 && 
            accentEuclidean.length > 0 && 
            accentEuclidean[hitCounter % accentEuclidean.length] === 1) {
          this.velocityPattern[i] = this.HIGH_VELOCITY;
        } else {
          this.velocityPattern[i] = this.LOW_VELOCITY;
        }
        hitCounter++;
      }
    }
  }
  
  /**
   * 设置 XY Pad 位置
   */
  setPadPosition(x, y) {
    this.padPos.x = Math.max(0, Math.min(1, x));
    this.padPos.y = Math.max(0, Math.min(1, y));
    this.updatePatterns();
  }
  
  /**
   * 设置和声长度
   */
  setHarmonyLength(length) {
    this.harmonyLength = Math.max(2, Math.min(16, length));
    this.updatePatterns();
  }
  
  /**
   * 获取当前模式
   */
  getPatterns() {
    return {
      harmony: this.harmonyPattern,
      rhythm: this.rhythmPattern,
      velocity: this.velocityPattern,
      padPos: { ...this.padPos }
    };
  }
}

