/**
 * 手势识别模块
 * 从 arpeggiator-remix 提取并重构
 */

import { HandLandmarker, FilesetResolver } from 'https://esm.sh/@mediapipe/tasks-vision@0.10.14';

export class HandTracker {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.handLandmarker = null;
    this.lastVideoTime = -1;
    this.lastLandmarkPositions = [[], []]; // 存储两只手的上一帧位置
    this.smoothingFactor = 0.7; // 平滑系数
    
    // 手势状态缓存
    this.hands = [
      { landmarks: null, isFist: false, wasFist: false },
      { landmarks: null, isFist: false, wasFist: false }
    ];
  }
  
  /**
   * 初始化手势追踪
   */
  async initialize() {
    try {
      // 初始化 MediaPipe
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        numHands: 2,
        runningMode: 'VIDEO'
      });
      
      console.log('✅ HandLandmarker 初始化成功');
      console.log('📊 配置信息:', {
        numHands: 2,
        runningMode: 'VIDEO',
        delegate: 'GPU'
      });
      
      // 设置视频流
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 }
        }
      });
      
      this.videoElement.srcObject = stream;
      
      // 等待视频准备就绪
      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = resolve;
      });
      
      console.log('✅ 视频流准备就绪');
      console.log(`📹 视频尺寸: ${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`);
      return true;
    } catch (error) {
      console.error('❌ HandTracker 初始化失败:', error);
      console.error('错误详情:', error.stack);
      if (error.name === 'NotAllowedError') {
        throw new Error('摄像头访问被拒绝，请允许摄像头权限后刷新页面');
      } else if (error.name === 'NotFoundError') {
        throw new Error('未找到摄像头设备，请检查摄像头连接');
      } else if (error.message && error.message.includes('超时')) {
        throw new Error('摄像头访问超时，请检查摄像头是否被其他应用占用');
      } else {
        throw new Error(`摄像头初始化失败: ${error.message}`);
      }
    }
  }
  
  /**
   * 检测手部并返回 landmarks
   */
  detectHands() {
    if (!this.handLandmarker || !this.videoElement.srcObject) {
      return null;
    }
    
    const videoTime = this.videoElement.currentTime;
    if (videoTime <= this.lastVideoTime) {
      return null; // 跳过重复帧
    }
    
    this.lastVideoTime = videoTime;
    
    try {
      const results = this.handLandmarker.detectForVideo(
        this.videoElement,
        performance.now()
      );
      
      // 处理并平滑 landmarks
      // fix: 用 handedness 标签分配槽位，避免顺序不稳定导致左右手混淆
      const processedHands = [
        { landmarks: null, isFist: false, wasFist: false, isVisible: false },
        { landmarks: null, isFist: false, wasFist: false, isVisible: false }
      ];

      if (results.landmarks) {
        results.landmarks.forEach((rawLandmarks, detectedIdx) => {
          // MediaPipe: 'Left' = 人的左手 -> slot 0; 'Right' = 人的右手 -> slot 1
          const handednessArr = results.handedness && results.handedness[detectedIdx];
          const category = (handednessArr && handednessArr[0] && handednessArr[0].categoryName) || '';
          const slotIndex = (category === 'Left') ? 0 : 1;

          const smoothedLandmarks = this._smoothLandmarks(slotIndex, rawLandmarks);
          this.lastLandmarkPositions[slotIndex] = smoothedLandmarks.map(lm => ({ ...lm }));

          const isFist = this._isFist(smoothedLandmarks);
          const wasFist = this.hands[slotIndex].isFist;
          this.hands[slotIndex].isFist = isFist;
          this.hands[slotIndex].wasFist = wasFist;

          processedHands[slotIndex] = {
            landmarks: smoothedLandmarks,
            isFist,
            wasFist,
            isVisible: true
          };
        });
      }

      return processedHands;
    } catch (error) {
      console.error('手势检测错误:', error);
      return null;
    }
  }
  
  /**
   * 平滑处理 landmarks
   */
  _smoothLandmarks(handIndex, currentLandmarks) {
    if (!this.lastLandmarkPositions[handIndex] || 
        this.lastLandmarkPositions[handIndex].length !== currentLandmarks.length) {
      // 初始化
      return currentLandmarks.map(lm => ({ ...lm }));
    }
    
    return currentLandmarks.map((lm, index) => {
      const prevLm = this.lastLandmarkPositions[handIndex][index];
      return {
        x: this.smoothingFactor * lm.x + (1 - this.smoothingFactor) * prevLm.x,
        y: this.smoothingFactor * lm.y + (1 - this.smoothingFactor) * prevLm.y,
        z: this.smoothingFactor * lm.z + (1 - this.smoothingFactor) * prevLm.z
      };
    });
  }
  
  /**
   * 检测是否握拳
   * 【修复】使用相对阈值：distance / handSize，消除手远近造成的误判
   */
  _isFist(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;

    // 用腕关节(0)→中指MCP(9)距离作为"手的尺寸"基准
    const wrist  = landmarks[0];
    const midMCP = landmarks[9];
    const hsDx = midMCP.x - wrist.x;
    const hsDy = midMCP.y - wrist.y;
    const handSize = Math.sqrt(hsDx * hsDx + hsDy * hsDy);
    if (handSize < 0.01) return false; // 手太小，数据不可靠

    const palmCenter = landmarks[9];
    const fingertipsIndices = [4, 8, 12, 16, 20];
    const fistThreshold = 0.55; // 相对于手的尺寸（约55%以内算握拳）

    for (const tipIndex of fingertipsIndices) {
      const tip = landmarks[tipIndex];
      const dx = tip.x - palmCenter.x;
      const dy = tip.y - palmCenter.y;
      const relDist = Math.sqrt(dx * dx + dy * dy) / handSize;

      if (relDist > fistThreshold) {
        return false; // 至少一个手指张开
      }
    }

    return true; // 所有指尖都靠近手掌
  }

  
  /**
   * 获取拇指和食指的距离（用于检测捏合）
   */
  getPinchDistance(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;
    
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance;
  }
  
  /**
   * 检测是否捏合（拇指和食指距离小于阈值）
   * 【修复】使用相对阈值：pinchDist / handSize，消除手远近造成的误判
   */
  isPinched(landmarks, threshold = 0.05) {
    if (!landmarks || landmarks.length < 21) return false;

    // 计算手的尺寸（腕关节→中指MCP）
    const wrist  = landmarks[0];
    const midMCP = landmarks[9];
    const hsDx = midMCP.x - wrist.x;
    const hsDy = midMCP.y - wrist.y;
    const handSize = Math.sqrt(hsDx * hsDx + hsDy * hsDy);

    const absDistance = this.getPinchDistance(landmarks);
    if (absDistance === null) return false;

    if (handSize < 0.01) {
      // 手太小时退化为绝对阈值
      return absDistance < threshold;
    }

    // 相对阈值：实际捏合约 0.10~0.20，未捏合 > 0.40
    const relDistance = absDistance / handSize;
    return relDistance < 0.30;
  }

  
  /**
   * 获取手部中心点在视频中的归一化坐标 (0-1)
   * @param {boolean} isMirrored - 是否镜像模式（影响 X 轴翻转）
   */
  getHandCenter(landmarks, videoParams, isMirrored = true) {
    if (!landmarks || !videoParams) return null;
    
    const palm = landmarks[9]; // 中指 MCP 作为手掌中心
    const lmOriginalX = palm.x * videoParams.videoNaturalWidth;
    const lmOriginalY = palm.y * videoParams.videoNaturalHeight;
    
    let normX = (lmOriginalX - videoParams.offsetX) / videoParams.visibleWidth;
    const normY = (lmOriginalY - videoParams.offsetY) / videoParams.visibleHeight;
    
    // 根据镜像设置决定是否翻转 X 轴
    if (isMirrored) {
      normX = 1 - normX;
    }
    
    return {
      x: Math.max(0, Math.min(1, normX)),
      y: Math.max(0, Math.min(1, normY))
    };
  }

  /**
   * 获取捏合位置（拇指与食指中点）的归一化坐标 (0-1)
   */
  getPinchCenter(landmarks, videoParams, isMirrored = true) {
    if (!landmarks || !videoParams) return null;
    const thumb = landmarks[4];
    const index = landmarks[8];
    if (!thumb || !index) return null;
    const midX = (thumb.x + index.x) * 0.5 * videoParams.videoNaturalWidth;
    const midY = (thumb.y + index.y) * 0.5 * videoParams.videoNaturalHeight;
    let normX = (midX - videoParams.offsetX) / videoParams.visibleWidth;
    const normY = (midY - videoParams.offsetY) / videoParams.visibleHeight;
    if (isMirrored) normX = 1 - normX;
    return {
      x: Math.max(0, Math.min(1, normX)),
      y: Math.max(0, Math.min(1, normY))
    };
  }
  
  /**
   * 计算视频可见区域参数
   */
  getVisibleVideoParameters() {
    if (!this.videoElement || 
        this.videoElement.videoWidth === 0 || 
        this.videoElement.videoHeight === 0) {
      return null;
    }
    
    const vNatW = this.videoElement.videoWidth;
    const vNatH = this.videoElement.videoHeight;
    const rW = this.videoElement.clientWidth;
    const rH = this.videoElement.clientHeight;
    
    if (vNatW === 0 || vNatH === 0 || rW === 0 || rH === 0) return null;
    
    const videoAR = vNatW / vNatH;
    const renderAR = rW / rH;
    
    let offsetX, offsetY, visibleWidth, visibleHeight;
    
    if (videoAR > renderAR) {
      // 视频更宽，按高度缩放
      const scale = rH / vNatH;
      const scaledVideoWidth = vNatW * scale;
      const totalCroppedPixelsX = (scaledVideoWidth - rW) / scale;
      
      offsetX = totalCroppedPixelsX / 2;
      offsetY = 0;
      visibleWidth = vNatW - totalCroppedPixelsX;
      visibleHeight = vNatH;
    } else {
      // 视频更高，按宽度缩放
      const scale = rW / vNatW;
      const scaledVideoHeight = vNatH * scale;
      const totalCroppedPixelsY = (scaledVideoHeight - rH) / scale;
      
      offsetX = 0;
      offsetY = totalCroppedPixelsY / 2;
      visibleWidth = vNatW;
      visibleHeight = vNatH - totalCroppedPixelsY;
    }
    
    return {
      videoNaturalWidth: vNatW,
      videoNaturalHeight: vNatH,
      offsetX,
      offsetY,
      visibleWidth,
      visibleHeight
    };
  }
}

