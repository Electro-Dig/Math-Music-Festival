/**
 * 将左右手的 21 点坐标映射成控制信号：
 * - 左手：transpose (-12..12), presetChangeTrigger (boolean)  ← 音量已移至 UI 滑块
 * - 右手：rotationSpeed (-1..1), confidence (0..1)
 */

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function mapGestures(hands, prevState = null) {
  const { left, right } = hands || {};

  const result = {
    left: {
      hasHand: !!left,
      // volume 已移至 UI 滑块，此处不再由手势决定
      transpose: prevState?.left?.transpose ?? 0,
      isFist: false,
      presetChangeTrigger: false,
    },
    right: {
      hasHand: !!right,
      rotationSpeed: prevState?.right?.rotationSpeed ?? 0,
      confidence: 0,
    },
  };

  // 左手：移调 + 握拳检测（动态阈值 + 滞后 + 冷却）
  // 注意：音量已移至控制面板 UI 滑块，不再使用大拇指-食指距离控制
  if (left && left.landmarks && left.landmarks.length >= 21) {
    const lm = left.landmarks;

    // 手掌中心（腕 + 中指 MCP）
    const wrist = lm[0];
    const middleMcp = lm[9];
    const centerY = (wrist.y + middleMcp.y) / 2;
    // y=0 顶部, y=1 底部 → 反转后映射到 [-12, 12]
    const yNorm = clamp(centerY, 0, 1);
    const transpose = Math.round(lerp(12, -12, yNorm));
    const prevTranspose = prevState?.left?.transpose ?? transpose;
    const smoothTranspose = Math.abs(transpose - prevTranspose) <= 1
      ? prevTranspose
      : transpose;
    result.left.transpose = smoothTranspose;

    // --- 握拳判定（动态阈值 + 滞后 + 冷却） ---
    // 动态度量：平均(指尖→手腕) / (手腕→中指MCP)
    const tipsIdx = [8, 12, 16, 20];
    let tipSum = 0;
    tipsIdx.forEach((idx) => { tipSum += dist2D(lm[idx], wrist); });
    const avgTipDist = tipSum / tipsIdx.length;
    const palmNorm = Math.max(1e-6, dist2D(wrist, middleMcp)); // 归一化尺度
    const fistMetric = avgTipDist / palmNorm; // 越小越像握拳
    // 阈值（可根据体验微调）
    const enterTh = 0.55;
    const exitTh  = 0.65;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const prevLeft = prevState?.left || {};
    const wasFist = prevLeft.isFist ?? false;
    const lastToggleAt = prevLeft._fistLastToggleAt ?? 0;
    const enterStartAt = prevLeft._fistEnterStartAt ?? 0;
    const cooldownMs = 600;
    const holdMs = 120;

    let isFist = wasFist;
    let presetChangeTrigger = false;
    if (!wasFist) {
      // 未握拳 → 进入判定区域
      if (fistMetric < enterTh) {
        const start = enterStartAt || now;
        const held = now - start >= holdMs;
        if (held && (now - lastToggleAt) >= cooldownMs) {
          isFist = true;
          presetChangeTrigger = true; // 触发切换
        }
        result.left._fistEnterStartAt = start; // 保留进入起点
      } else {
        result.left._fistEnterStartAt = 0; // 离开进入区域，清零
      }
    } else {
      // 已握拳 → 退出判定区域
      if (fistMetric > exitTh) {
        if ((now - lastToggleAt) >= cooldownMs) {
          isFist = false;
          // 不在松拳时切换音色，只在进入握拳时切换
        }
      }
    }
    // 更新状态
    result.left.isFist = isFist;
    result.left.presetChangeTrigger = presetChangeTrigger;
    result.left._fistLastToggleAt = presetChangeTrigger ? now : lastToggleAt;
  }

  // 右手：旋转速度
  if (right && right.landmarks && right.landmarks.length >= 21) {
    const lm = right.landmarks;
    const indexMcp = lm[5]; // 食指掌关节
    const pinkyMcp = lm[17]; // 小指掌关节

    // 估计掌根方向向量
    const vx = pinkyMcp.x - indexMcp.x;
    const vy = pinkyMcp.y - indexMcp.y;
    const angle = Math.atan2(vy, vx); // [-PI, PI]

    // 中性角：水平向右
    const neutral = 0;
    let delta = angle - neutral;
    // 归一化到 [-PI, PI]
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;

    // 倾斜角映射（带死区与非线性），最大速度 1.5
    const deadDeg = 4;            // 死区：小于 4° 不响应
    const maxDeg = 60;            // 最大映射角度
    const maxSpeed = 1.5;         // 目标最大速度
    const deg = Math.abs(delta) * 180 / Math.PI;

    let target = 0;
    if (deg > deadDeg) {
      const t = clamp((deg - deadDeg) / (maxDeg - deadDeg), 0, 1);
      // 非线性增强中低速分辨率
      const eased = Math.pow(t, 0.7);
      target = Math.sign(delta) * (maxSpeed * eased);

      // 轻度吸附到 0.5、1.0、1.5 三个速度档位，便于体感控制
      const snaps = [0.5, 1.0, 1.5];
      for (const snap of snaps) {
        if (Math.abs(Math.abs(target) - snap) < 0.12) {
          target = Math.sign(target) * snap;
          break;
        }
      }
    }

    // 指数平滑，降低抖动
    const prevSpeed = prevState?.right?.rotationSpeed ?? 0;
    const smooth = lerp(prevSpeed, target, 0.25);
    result.right.rotationSpeed = smooth;

    // 置信度：基于向量长度粗略估计
    const len = Math.sqrt(vx * vx + vy * vy);
    result.right.confidence = clamp(len * 4, 0, 1);
  } else {
    // 没有右手时，渐进式衰减速度到 0
    const prevSpeed = prevState?.right?.rotationSpeed ?? 0;
    result.right.rotationSpeed = prevSpeed * 0.9;
    result.right.confidence = 0;
  }

  return result;
}


