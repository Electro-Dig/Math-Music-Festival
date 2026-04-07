import { HandLandmarker, FilesetResolver } from 'https://esm.sh/@mediapipe/tasks-vision@0.10.14';

/**
 * 手势追踪模块：封装 MediaPipe HandLandmarker
 * 只负责输出左右手 21 点坐标的简化数据结构
 */
export class HandsTracker {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.handLandmarker = null;
    this.lastVideoTime = -1;
    this.running = false;
    this.onHandsUpdate = null;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    );

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      numHands: 2,
      runningMode: 'VIDEO',
    });
  }

  async start(onHandsUpdate) {
    if (!this.handLandmarker) {
      await this.init();
    }
    this.onHandsUpdate = onHandsUpdate;

    // 如果视频流已存在，直接恢复循环
    if (this.videoElement.srcObject) {
      this.running = true;
      this._loop();
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    this.videoElement.srcObject = stream;

    await new Promise((resolve) => {
      this.videoElement.onloadedmetadata = () => resolve();
    });

    // 尝试显式播放视频流，避免某些浏览器不会自动播放导致始终没有新帧
    try {
      await this.videoElement.play();
    } catch (err) {
      console.warn('Webcam video play() failed, but stream is attached:', err);
    }

    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    // 不关闭视频流，只是暂停检测循环
  }

  _loop() {
    if (!this.running) return;
    const video = this.videoElement;
    const nowInMs = performance.now();

    if (video.readyState >= 2 && video.videoWidth > 0) {
      const results = this.handLandmarker.detectForVideo(video, nowInMs);
      const hands = this._normalizeResults(results, video);
      if (this.onHandsUpdate) {
        this.onHandsUpdate(hands);
      }
    }

    requestAnimationFrame(this._loop.bind(this));
  }

  /**
   * 将 MediaPipe 输出转换为左右手结构：
   * { left: { landmarks: [...] } | null, right: { landmarks: [...] } | null }
   */
  _normalizeResults(results, video) {
    const width = video.videoWidth;
    const height = video.videoHeight;

    const hands = [];

    if (results && results.landmarks) {
      for (let i = 0; i < results.landmarks.length; i += 1) {
        const lm = results.landmarks[i];
        const landmarks = lm.map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z ?? 0,
          px: p.x * width,
          py: p.y * height,
        }));

        // 用所有点的平均 x 来区分“左/右”
        const avgX =
          landmarks.reduce((sum, p) => sum + p.x, 0) / landmarks.length;

        hands.push({ avgX, landmarks });
      }
    }

    // 按 x 从小到大排序：注意 MediaPipe x 轴与视觉左/右可能相反
    // 实测中「更大的 avgX」对应屏幕左侧，所以这里有意交换：
    hands.sort((a, b) => a.avgX - b.avgX);

    // hands[0] 更靠一侧，视为视觉右手；hands[1] 视为视觉左手
    const right = hands[0] ? { landmarks: hands[0].landmarks } : null;
    const left = hands[1] ? { landmarks: hands[1].landmarks } : null;

    return { left, right };
  }
}


