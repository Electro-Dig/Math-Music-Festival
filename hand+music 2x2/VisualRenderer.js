/**
 * 可视化渲染器
 * 双层渲染：底层视频 + 上层 Canvas 坐标平面
 */

export class VisualRenderer {
  constructor(canvas, harmonyLength = 8) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.harmonyLength = harmonyLength;
    this.mode = 'grid'; // 'grid' | 'rings'
    
    // 动画状态
    this.harmonyFlashes = new Array(harmonyLength).fill(0);
    this.animatedBars = [];
    this.BAR_LIFE_SECONDS = 1.5;
    this.ringPulses = [];
    
    // 时间追踪
    this.lastTime = 0;
    this.sequenceTime = 0;
    this.lastTriggeredStep = -1;
    
    // 调整画布尺寸
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  setMode(mode) {
    this.mode = mode === 'rings' ? 'rings' : 'grid';
  }
  
  /**
   * 调整画布尺寸
   */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  
  /**
   * 更新动画状态
   */
  update(dt, tempoBPM, rhythmPattern, currentStep, isActive) {
    // 更新和声闪烁效果
    this.harmonyFlashes = this.harmonyFlashes.map(f => Math.max(0, f - dt * 4));
    
    // 更新动画条
    this.animatedBars = this.animatedBars.filter(bar => {
      bar.life -= dt;
      return bar.life > 0;
    });
    this.ringPulses = this.ringPulses.filter(p => {
      p.life -= dt;
      return p.life > 0;
    });
    
    // 更新序列时间
    const sequenceDuration = (60 / tempoBPM) * (16 / 4); // 16 步
    this.sequenceTime = (this.sequenceTime + dt) % sequenceDuration;
    
    // 记录触发步进
    if (currentStep !== this.lastTriggeredStep && isActive) {
      this.lastTriggeredStep = currentStep;
    }
  }
  
  /**
   * 添加和声闪烁效果
   */
  flashHarmony(index) {
    if (index >= 0 && index < this.harmonyFlashes.length) {
      this.harmonyFlashes[index] = 1.0;
    }
  }
  
  /**
   * 添加动画条
   */
  addAnimatedBar(noteIndex, startTime) {
    this.animatedBars.push({
      noteIndex,
      life: this.BAR_LIFE_SECONDS,
      startTime
    });
  }

  /**
   * 圆环模式：添加一次节拍脉冲
   */
  addRingPulse(noteIndex, stepIndex, velocity = 1.0) {
    const steps = 16;
    const ang = (stepIndex / steps) * Math.PI * 2 - Math.PI / 2;
    this.ringPulses.push({
      noteIndex,
      angle: ang,
      intensity: Math.max(0, Math.min(1, velocity)),
      life: this.BAR_LIFE_SECONDS * 0.9,
      totalLife: this.BAR_LIFE_SECONDS * 0.9
    });
  }
  
  /**
   * 渲染主画面
   */
  render(harmonyPattern, rhythmPattern, padPos, handPositions, isRightHandActive, tempoBPM = 120) {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    
    // 清空画布（保留半透明背景以显示底层视频）
    // 注意：透明度由 CSS opacity 控制，这里只设置轻微的背景色
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fillRect(0, 0, w, h);
    
    if (this.mode === 'rings') {
      this.renderRings(harmonyPattern, rhythmPattern, tempoBPM, w, h);
      return;
    }

    // 布局参数
    const harmonyDisplayWidth = 5;
    const mainAreaX = harmonyDisplayWidth + 10;
    const mainAreaWidth = w - mainAreaX - 10;
    const blockHeight = h / this.harmonyLength;
    
    // 1. 绘制节奏背景线
    if (isRightHandActive && rhythmPattern) {
      const stepWidth = mainAreaWidth / 16;
      this.ctx.strokeStyle = '#222222';
      this.ctx.lineWidth = 1;
      
      for (let i = 0; i < 16; i++) {
        if (rhythmPattern[i] === 1) {
          const x = mainAreaX + i * stepWidth + stepWidth / 2;
          this.ctx.beginPath();
          this.ctx.moveTo(x, 0);
          this.ctx.lineTo(x, h);
          this.ctx.stroke();
        }
      }
    }
    
    // 2. 绘制和声块（左侧，从下往上）
    for (let i = 0; i < this.harmonyLength; i++) {
      const y = (this.harmonyLength - 1 - i) * blockHeight;
      
      // 闪烁效果
      if (this.harmonyFlashes[i] > 0) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${this.harmonyFlashes[i]})`;
        this.ctx.fillRect(0, y, harmonyDisplayWidth, blockHeight - 2);
      }
      
      // 和声模式边框
      if (harmonyPattern && harmonyPattern[i] === 1) {
        this.ctx.strokeStyle = '#fff';
      } else {
        this.ctx.strokeStyle = '#333';
      }
      this.ctx.strokeRect(0, y, harmonyDisplayWidth, blockHeight - 2);
    }
    
    // 3. 绘制动画条
    const sequenceDuration = (60 / tempoBPM) * (16 / 4);
    this.animatedBars.forEach(bar => {
      const y = (this.harmonyLength - 1 - bar.noteIndex) * blockHeight;
      const timeSinceStart = (this.sequenceTime - bar.startTime + sequenceDuration) % sequenceDuration;
      const x = mainAreaX + (timeSinceStart / (this.BAR_LIFE_SECONDS / 2)) * mainAreaWidth;
      const alpha = Math.min(1, bar.life / (this.BAR_LIFE_SECONDS * 0.5));
      
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      if (x < mainAreaX + mainAreaWidth && bar.noteIndex < this.harmonyLength) {
        this.ctx.fillRect(x, y, 4, blockHeight - 2);
      }
    });
    
    // 4. 绘制 XY Pad 十字线（如果右手激活）
    if (isRightHandActive) {
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      // X 轴线
      this.ctx.moveTo(padPos.x * w, 0);
      this.ctx.lineTo(padPos.x * w, h);
      // Y 轴线
      this.ctx.moveTo(0, padPos.y * h);
      this.ctx.lineTo(w, padPos.y * h);
      this.ctx.stroke();
    }
    
    // 5. 绘制手部位置指示器（可选，用于调试）
    if (handPositions) {
      // 左手（蓝色）
      if (handPositions.left && handPositions.left.visible) {
        const pos = handPositions.left.position;
        this.ctx.fillStyle = 'rgba(100, 150, 255, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(pos.x * w, pos.y * h, 15, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      // 右手（绿色，如果激活）
      if (handPositions.right && handPositions.right.visible && isRightHandActive) {
        const pos = handPositions.right.position;
        this.ctx.fillStyle = 'rgba(100, 255, 150, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(pos.x * w, pos.y * h, 15, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    
    // 6. 绘制标签
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '16px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('RHYTHM', w / 2, h - 10);
    
    this.ctx.save();
    this.ctx.translate(w - 10, h / 2);
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.fillText('HARMONY', 0, 0);
    this.ctx.restore();
  }
  
  renderRings(harmonyPattern, rhythmPattern, tempoBPM, w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.32;
    const laneGap = 8; // 和声层间距
    
    // 背景圈
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // 16步切分（静态节奏背景）
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2 - Math.PI / 2;
      const inner = radius - 12;
      const outer = radius + 12;
      ctx.strokeStyle = (rhythmPattern && rhythmPattern[i] === 1) ? '#ddd' : '#333';
      ctx.lineWidth = (rhythmPattern && rhythmPattern[i] === 1) ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + inner * Math.cos(ang), cy + inner * Math.sin(ang));
      ctx.lineTo(cx + outer * Math.cos(ang), cy + outer * Math.sin(ang));
      ctx.stroke();
    }
    
    // 和声层（静态）：显示哪些层被启用
    for (let i = 0; i < this.harmonyLength; i++) {
      const r = radius + 24 + i * laneGap;
      ctx.strokeStyle = (harmonyPattern && harmonyPattern[i] === 1) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // 播放头（显示时间进度）
    const sequenceDuration = (60 / tempoBPM) * (16 / 4);
    const progress = (this.sequenceTime % sequenceDuration) / sequenceDuration; // 0..1
    const ang = progress * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (radius + 16) * Math.cos(ang), cy + (radius + 16) * Math.sin(ang));
    ctx.stroke();
    
    // 触发脉冲：在相应和声层与节拍角度处绘制脉冲点
    this.ringPulses.forEach(p => {
      const r = radius + 24 + p.noteIndex * laneGap;
      const alpha = Math.min(1, (p.life / p.totalLife) * p.intensity + 0.2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      const x = cx + r * Math.cos(p.angle);
      const y = cy + r * Math.sin(p.angle);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // radial beam（可选）
      ctx.strokeStyle = `rgba(255,255,255,${alpha*0.65})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + (radius + 16) * Math.cos(p.angle), cy + (radius + 16) * Math.sin(p.angle));
      ctx.lineTo(x, y);
      ctx.stroke();
    });
    
    // 标签
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EUCLIDEAN RINGS', cx, cy - radius - 30);
  }
  
  /**
   * 设置和声长度
   */
  setHarmonyLength(length) {
    this.harmonyLength = length;
    this.harmonyFlashes = new Array(length).fill(0);
  }
}

