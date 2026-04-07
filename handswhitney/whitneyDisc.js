import paper from 'https://esm.sh/paper@0.12.15?bundle';

/**
 * Whitney 圆盘与 tine 实现（简化自 whitney-master）
 * 支持两种运动模式：
 * - circular: 传统圆周运动，穿过 12 点钟时触发
 * - tusiCouple: 图西双圆，沿直径往返振荡，穿过圆心时触发
 */

// 运动模式枚举
export const MOTION_MODES = {
  CIRCULAR: 'circular',      // 圆周运动
  TUSI_COUPLE: 'tusiCouple', // 图西双圆（穿心振荡）
};

// 颜色模式枚举
export const COLOR_MODES = {
  RAINBOW: 'rainbow',           // 经典彩虹
  SHUTTLE: 'shuttle',           // 穿梭感（单色系明暗渐变，随时间流动）
  CYBERPUNK: 'cyberpunk',       // 赛博朋克（霓虹粉/紫/青）
  OSCILLOSCOPE: 'oscilloscope', // 示波器（经典磷光绿）
  FIREWORKS: 'fireworks',       // 音乐烟花（金橙+紫蓝双色）
  AURORA: 'aurora',             // 极光（冷色调流动）
};

/**
 * 根据颜色模式生成初始颜色数组
 */
export function createColors(steps, colorMode = COLOR_MODES.RAINBOW) {
  const colors = [];

  switch (colorMode) {
    case COLOR_MODES.SHUTTLE:
      // 穿梭感：单色系（青色），明暗渐变
      for (let i = 0; i < steps; i++) {
        const brightness = 0.4 + 0.6 * (i / (steps - 1));
        colors.push(new paper.Color({
          hue: 180, // 青色基调
          saturation: 0.8,
          brightness: brightness,
          alpha: 1,
        }));
      }
      break;

    case COLOR_MODES.CYBERPUNK:
      // 赛博朋克：霓虹粉/紫/青循环
      const cyberHues = [320, 280, 180, 200]; // 粉、紫、青、蓝绿
      for (let i = 0; i < steps; i++) {
        const hue = cyberHues[i % cyberHues.length];
        colors.push(new paper.Color({
          hue: hue,
          saturation: 1,
          brightness: 0.9 + 0.1 * Math.sin(i * 0.5),
          alpha: 1,
        }));
      }
      break;

    case COLOR_MODES.OSCILLOSCOPE:
      // 示波器：经典磷光绿
      for (let i = 0; i < steps; i++) {
        const brightness = 0.5 + 0.5 * (i / (steps - 1));
        colors.push(new paper.Color({
          hue: 120, // 绿色
          saturation: 0.9,
          brightness: brightness,
          alpha: 1,
        }));
      }
      break;

    case COLOR_MODES.FIREWORKS:
      // 音乐烟花：金橙到紫蓝双色渐变
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        // 从暖色（金橙）到冷色（紫蓝）
        const hue = 30 + t * 240; // 30(橙) → 270(紫)
        colors.push(new paper.Color({
          hue: hue,
          saturation: 0.9,
          brightness: 0.8 + 0.2 * Math.sin(t * Math.PI),
          alpha: 1,
        }));
      }
      break;

    case COLOR_MODES.AURORA:
      // 极光：冷色调流动（青/蓝/紫）
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        // 从青色到紫色
        const hue = 160 + t * 100; // 160(青) → 260(紫)
        colors.push(new paper.Color({
          hue: hue,
          saturation: 0.7 + 0.3 * Math.sin(t * Math.PI),
          brightness: 0.6 + 0.4 * Math.cos(t * Math.PI * 2),
          alpha: 1,
        }));
      }
      break;

    case COLOR_MODES.RAINBOW:
    default:
      // 经典彩虹
      const minHue = 0;
      const maxHue = 330;
      for (let i = 0; i < steps; i++) {
        colors.push(new paper.Color({
          hue: minHue + (maxHue - minHue) * (1 - i / (steps - 1)),
          saturation: 1,
          brightness: 1,
          alpha: 1,
        }));
      }
      break;
  }

  return colors;
}

export class Tine {
  constructor(id, parent, radius, size, fillColor, speedFactor, fixedAngle = 0) {
    this.id = id;
    this.parent = parent;
    this.radius = radius;
    this.size = size;
    this.fillColor = fillColor;
    this.speedFactor = speedFactor;

    // 圆周运动模式的角度
    this.angle = 0;

    // Tusi Couple 模式的属性
    this.fixedAngle = fixedAngle;  // 固定的发射角度（弧度）
    this.phase = 0;                 // 当前振荡相位
    this.prevCosPhase = 1;          // 上一帧的 cos(phase)，用于检测过零点

    this.path = this._buildPath();
    this._updatePosition();
  }

  _buildPath() {
    const r = this.size / 2;
    let path;
    switch (this.parent && this.parent.shapeType) {
      case 'triangle':
        path = new paper.Path.RegularPolygon(new paper.Point(0, 0), 3, r);
        break;
      case 'square':
        path = new paper.Path.RegularPolygon(new paper.Point(0, 0), 4, r);
        break;
      case 'hexagon':
        path = new paper.Path.RegularPolygon(new paper.Point(0, 0), 6, r);
        break;
      case 'circle':
      default:
        path = new paper.Path.Circle(new paper.Point(0, 0), r);
        break;
    }
    path.fillColor = this.fillColor;
    path.applyMatrix = false;
    return path;
  }

  /**
   * 根据当前运动模式更新位置
   */
  _updatePosition() {
    const motionMode = this.parent && this.parent.motionMode;

    if (motionMode === MOTION_MODES.TUSI_COUPLE) {
      // Tusi Couple 模式：沿固定角度的直径做简谐振动
      // 所有球使用相同的最大半径，只是方向和速度不同
      // 位置 = R_max * cos(phase) * (cos(fixedAngle), sin(fixedAngle))
      const maxRadius = this.parent.radius * 0.95; // 使用 Disc 的最大半径
      const r = maxRadius * Math.cos(this.phase);
      this.path.position = new paper.Point(
        r * Math.cos(this.fixedAngle),
        r * Math.sin(this.fixedAngle)
      ).add(this.parent.center);
    } else {
      // 圆周运动模式
      this.path.position = new paper.Point(this.radius, 0)
        .rotate(this.angle)
        .add(this.parent.center);
    }
  }

  /**
   * 圆周运动模式：设置角度
   */
  setAngle(newAngle) {
    if (newAngle >= 360 || newAngle < 0) {
      this._onZero();
    }
    this.angle = newAngle >= 0 ? newAngle % 360 : 360 + newAngle;
    this._updatePosition();
  }

  /**
   * Tusi Couple 模式：设置相位
   */
  setPhase(newPhase) {
    const currentCos = Math.cos(newPhase);

    // 检测是否穿过圆心（cos 从正变负或从负变正）
    // 只在速度不为零时检测，避免静止时误触发
    if (this.parent.speed !== 0) {
      if ((this.prevCosPhase > 0 && currentCos <= 0) ||
        (this.prevCosPhase < 0 && currentCos >= 0)) {
        this._onZero();
      }
    }

    this.prevCosPhase = currentCos;
    this.phase = newPhase;
    this._updatePosition();
  }

  onFrame(ev) {
    if (this.parent.speed === 0) return;

    const motionMode = this.parent && this.parent.motionMode;
    const speedMul = this.parent.speedMultiplier || 1;

    if (motionMode === MOTION_MODES.TUSI_COUPLE) {
      // Tusi Couple 模式：相位随时间变化
      // 使用 2π 作为一个完整周期
      const deltaPhase = ev.delta * Math.PI * 2 * this.parent.speed * speedMul * this.speedFactor;
      this.setPhase(this.phase + deltaPhase);
    } else {
      // 圆周运动模式
      this.setAngle(
        this.angle +
        ev.delta * 360 * this.parent.speed * speedMul * this.speedFactor,
      );
    }

    // 动态颜色更新（仅在非视觉模式下）
    if (!this.parent.isVisualMode && this.parent.colorMode) {
      this._updateDynamicColor(ev);
    }
  }

  /**
   * 根据颜色模式动态更新颜色
   */
  _updateDynamicColor(ev) {
    const colorMode = this.parent.colorMode;
    const time = this.parent._colorTime || 0;
    const count = this.parent.tines.length;
    const normalizedId = (this.id - 1) / Math.max(1, count - 1);

    try {
      switch (colorMode) {
        case COLOR_MODES.SHUTTLE:
          // 穿梭感：色相随时间和速度流动（减慢速度）
          const shuttleHue = (180 + time * 8 + normalizedId * 60) % 360;
          const shuttleBrightness = 0.7 + 0.25 * Math.sin(time * 0.5 + this.speedFactor * 0.1);
          this.path.fillColor = new paper.Color({
            hue: shuttleHue,
            saturation: 0.8,
            brightness: shuttleBrightness,
            alpha: 1,
          });
          break;

        case COLOR_MODES.CYBERPUNK:
          // 赛博朋克：霓虹闪烁效果（减慢闪烁）
          const cyberHues = [320, 280, 180, 200];
          const cyberIndex = Math.floor((time * 0.5 + this.id * 0.1) % cyberHues.length);
          const cyberHue = cyberHues[cyberIndex];
          const cyberFlicker = 0.85 + 0.15 * Math.sin(time * 2 + this.id * 0.5);
          this.path.fillColor = new paper.Color({
            hue: cyberHue,
            saturation: 1,
            brightness: cyberFlicker,
            alpha: 1,
          });
          break;

        case COLOR_MODES.OSCILLOSCOPE:
          // 示波器：磷光辉光效果（减慢呼吸）
          const oscBrightness = 0.75 + 0.2 * Math.sin(time * 0.8 + this.speedFactor * 0.05);
          const oscSaturation = 0.8 + 0.2 * Math.cos(time * 0.5);
          this.path.fillColor = new paper.Color({
            hue: 120,
            saturation: oscSaturation,
            brightness: oscBrightness,
            alpha: 1,
          });
          break;

        case COLOR_MODES.FIREWORKS:
          // 音乐烟花：双色爆发（减慢变化）
          const fwPhase = (time * 0.15 + normalizedId) % 1;
          const fwHue = fwPhase < 0.5
            ? 30 + fwPhase * 2 * 60   // 金橙
            : 240 + (fwPhase - 0.5) * 2 * 60; // 紫蓝
          const fwBrightness = 0.8 + 0.2 * Math.abs(Math.sin(time * 1.0 + this.speedFactor * 0.2));
          this.path.fillColor = new paper.Color({
            hue: fwHue,
            saturation: 0.9,
            brightness: fwBrightness,
            alpha: 1,
          });
          break;

        case COLOR_MODES.AURORA:
          // 极光：冷色调波动（减慢流动）
          const auroraHue = 160 + 100 * (0.5 + 0.5 * Math.sin(time * 0.15 + normalizedId * Math.PI * 2));
          const auroraBrightness = 0.7 + 0.25 * Math.sin(time * 0.4 + this.id * 0.02);
          this.path.fillColor = new paper.Color({
            hue: auroraHue,
            saturation: 0.75,
            brightness: auroraBrightness,
            alpha: 1,
          });
          break;

        // RAINBOW 模式保持静态颜色，不更新
        default:
          break;
      }
    } catch (e) {
      // 忽略颜色更新错误
    }
  }

  _onZero() {
    // 视觉模式下跳过动画和回调以提高性能
    if (this.parent && this.parent.isVisualMode) {
      return;
    }

    this.path.tween(
      {
        fillColor: '#fff',
        scaling: new paper.Point(1.25, 1.25),
      },
      {
        fillColor: this.fillColor.toCSS(),
        scaling: new paper.Point(1, 1),
      },
      {
        duration: 400,
        easing: 'easeInQuad',
      },
    );
    this.parent.onZero(this);
  }
}

export class Disc {
  constructor(center, radius, tineCount, colors, showLines = false, shapeType = 'circle', isVisualMode = false, sizeMultiplier = 1.0, motionMode = MOTION_MODES.CIRCULAR, colorMode = COLOR_MODES.RAINBOW) {
    this.center = center;
    this.radius = radius;
    this.showLines = showLines;
    this.shapeType = shapeType;
    this.speed = 0;
    this.speedMultiplier = 1.0;
    this.zeroCallbacks = [];
    this.isVisualMode = isVisualMode;
    this.sizeMultiplier = sizeMultiplier; // 形状大小倍数
    this.motionMode = motionMode; // 运动模式
    this.colorMode = colorMode; // 颜色模式
    this._colorTime = 0; // 颜色动画时间

    this.tines = this._createTines(tineCount, colors);
    this.lines = this.showLines ? Disc._createLines(tineCount) : null;
    this.zeroPath = this._createZeroPath();
  }

  /**
   * 创建零点标记线（圆周模式）或中心点（Tusi Couple 模式）
   */
  _createZeroPath() {
    if (this.motionMode === MOTION_MODES.TUSI_COUPLE) {
      // Tusi Couple 模式：在中心画一个小圆点作为触发点标识
      const centerDot = new paper.Path.Circle(this.center, 4);
      centerDot.fillColor = 'rgba(255, 255, 255, 0.5)';
      centerDot.strokeColor = '#fff';
      centerDot.strokeWidth = 1;
      return centerDot;
    } else {
      // 圆周运动模式：画12点钟方向的参考线
      return Disc._createZero(this.center, this.radius);
    }
  }

  _createTines(count, colors) {
    const tines = [];
    const baseSize = (this.radius / count) * 2;

    // 视觉模式下使用更小的尺寸范围
    const minSizeFactor = this.isVisualMode ? 0.3 : 0.5;
    const maxSizeFactor = this.isVisualMode ? 1.5 : 4;
    const minR = (baseSize * minSizeFactor) / 2;
    const maxR = this.radius - (baseSize * maxSizeFactor) / 2;

    // 穿心模式下的统一球大小基准
    const tusiUniformSize = baseSize * 2.0; // 统一使用中等大小

    for (let i = 0; i < count; i += 1) {
      const sizeFactor =
        minSizeFactor +
        ((maxSizeFactor - minSizeFactor) / (count - 1)) * i;
      const r = minR + ((maxR - minR) / (count - 1)) * i;
      const speedFactor = i + 1;
      const color = colors[i % colors.length];

      // 根据运动模式决定球的大小
      let actualSize;
      if (this.motionMode === MOTION_MODES.TUSI_COUPLE) {
        // 穿心模式：所有球使用统一大小，可通过 sizeMultiplier 调整
        actualSize = tusiUniformSize * this.sizeMultiplier;
      } else {
        // 圆周模式：保持渐变大小
        actualSize = baseSize * sizeFactor * this.sizeMultiplier;
      }

      // 计算 Tusi Couple 模式的固定发射角度
      // 使用"玫瑰花"模式：每个点沿不同角度的直径振动
      const fixedAngle = (2 * Math.PI / count) * i;

      const t = new Tine(i + 1, this, r, actualSize, color, speedFactor, fixedAngle);

      // --- 2.5D 假深度：一次性设置颜色/透明（低负载） ---
      // 视觉模式下简化颜色处理以提高性能
      if (!this.isVisualMode) {
        const z = 1 - (i / Math.max(1, count - 1)); // 外圈更近、内圈更远
        if (t.path && t.path.fillColor) {
          try {
            const c = color.clone ? color.clone() : new paper.Color(color);
            // 亮度与饱和度略随深度变化
            if (typeof c.brightness === 'number') {
              c.brightness = Math.min(1, Math.max(0, c.brightness * (0.85 + 0.15 * (1 - z))));
            }
            if (typeof c.saturation === 'number') {
              c.saturation = Math.min(1, Math.max(0, c.saturation * (0.90 + 0.10 * (1 - z))));
            }
            t.path.fillColor = c;
            t.path.opacity = 0.95 - 0.35 * z; // 远处更透明
          } catch (e) {
            // ignore color ops
          }
        }
      } else {
        // 视觉模式：简单的透明度渐变
        if (t.path) {
          t.path.opacity = 0.7 + 0.3 * (i / Math.max(1, count - 1));
        }
      }
      tines.push(t);
    }
    return tines;
  }

  onFrame(ev) {
    // 更新颜色时间（用于动态颜色效果）
    this._colorTime += ev.delta;

    this.tines.forEach((tine) => tine.onFrame(ev));
    if (this.showLines && this.lines) {
      this._moveLines();
    }
  }

  onZero(tine) {
    this.zeroCallbacks.forEach((cb) => cb(tine.id));
  }

  addZeroListener(cb) {
    this.zeroCallbacks.push(cb);
  }

  dispose() {
    if (this.tines) {
      this.tines.forEach(t => {
        if (t.path && t.path.remove) t.path.remove();
      });
      this.tines = [];
    }
    if (this.lines) {
      this.lines.forEach(l => l && l.remove && l.remove());
      this.lines = null;
    }
    if (this.zeroPath) {
      this.zeroPath.remove();
      this.zeroPath = null;
    }
  }

  setLinesVisible(show) {
    this.showLines = show;
    if (this.lines) {
      this.lines.forEach((line) => {
        line.visible = show;
      });
    }
  }

  setSpeedMultiplier(mul) {
    const m = Number.isFinite(mul) ? mul : 1.0;
    this.speedMultiplier = m;
  }

  setSpeed(speed) {
    this.speed = speed * (1 / (this.tines.length * 2));
  }

  _moveLines() {
    this.tines.forEach((tine, i) => {
      if (!this.lines) return;
      if (i !== 0) {
        this.lines[i - 1].segments[1].point = tine.path.position;
      }
      if (i !== this.tines.length - 1) {
        this.lines[i].segments[0].point = tine.path.position;
      }
    });
  }

  static _createZero(center, radius) {
    const path = new paper.Path.Line(
      center,
      center.add(new paper.Point(radius, 0)),
    );
    path.strokeColor = '#fff';
    return path;
  }

  static _createLines(count) {
    const lines = [];
    for (let i = 0; i < count; i += 1) {
      lines.push(
        new paper.Path.Line({
          from: [0, 0],
          to: [1, 1],
          strokeColor: '#fff',
          strokeWidth: 1,
        }),
      );
    }
    return lines;
  }
}

export function createRainbowColors(steps) {
  const colors = [];
  const minHue = 0;
  const maxHue = 330;
  for (let i = 0; i < steps; i += 1) {
    colors.push(
      new paper.Color({
        hue: minHue + (maxHue - minHue) * (1 - i / (steps - 1)),
        saturation: 1,
        brightness: 1,
        alpha: 1,
      }),
    );
  }
  return colors;
}

export { paper };


