/**
 * 国际化文本资源
 */

export const i18n = {
  zh: {
    // 页面标题
    title: 'Hand+Music 2x2 - 手势控制欧几里得音乐',
    
    // 操作指南
    guide: {
      title: '🎮 操作指南',
      leftHand: {
        title: '👈 左手控制',
        moveUpDown: '上下移动：控制音高',
        pinchDistance: '拇指食指距离：控制音量',
        fist: '握拳：切换音色'
      },
      rightHand: {
        title: '👉 右手控制',
        pinch: '拇指+食指捏合：控制 XY Pad',
        release: '松开：脱离控制'
      }
    },
    
    // 状态
    status: {
      title: '📊 状态',
      leftHand: '左手',
      rightHand: '右手',
      xyPad: 'XY Pad',
      notDetected: '未检测',
      normal: '正常',
      pinching: '捏合中',
      notPinching: '未捏合',
      activated: '激活',
      notActivated: '未激活',
      fist: '握拳'
    },
    
    // 画布透明度
    canvasOpacity: {
      title: '🎨 画布透明度'
    },
    
    // 摄像头
    camera: {
      title: '📹 摄像头',
      mirror: '镜像',
      mirrorOn: '镜像 (开)',
      mirrorOff: '镜像 (关)'
    },
    
    // 参数调节
    parameters: {
      title: '🎵 参数调节',
      tempo: 'Tempo',
      chordSize: 'Chord Size'
    },
    
    // 音频效果
    audioEffects: {
      title: '🎚 音频效果',
      delayWet: 'Delay Wet',
      delayTime: 'Delay Time',
      reverbWet: 'Reverb Wet'
    },
    
    // 音阶设置
    scaleSettings: {
      title: '🎼 音阶设置',
      root: '根音',
      mode: '调式'
    },
    
    // 视觉模式
    visualMode: {
      title: '🌀 视觉模式',
      grid: '网格',
      rings: '圆环'
    },
    
    // 状态栏
    statusBar: {
      title: '🎵 当前状态',
      timbre: '音色',
      coords: '坐标',
      note: '音阶',
      tempo: '节拍'
    },
    
    // 加载和错误
    loading: {
      initializing: '正在初始化...',
      waitForInteraction: '初始化完成，等待手势交互启动音频...'
    },
    error: {
      initFailed: '初始化失败',
      checkCamera: '请检查：\n1. 摄像头权限是否允许\n2. 网络连接是否正常\n3. 浏览器是否支持 WebGL'
    }
  },
  
  en: {
    title: 'Hand+Music 2x2 - Gesture-Controlled Euclidean Music',
    
    guide: {
      title: '🎮 Operation Guide',
      leftHand: {
        title: '👈 Left Hand Control',
        moveUpDown: 'Move Up/Down: Control Pitch',
        pinchDistance: 'Thumb-Index Distance: Control Volume',
        fist: 'Fist: Switch Timbre'
      },
      rightHand: {
        title: '👉 Right Hand Control',
        pinch: 'Thumb+Index Pinch: Control XY Pad',
        release: 'Release: Disengage Control'
      }
    },
    
    status: {
      title: '📊 Status',
      leftHand: 'Left Hand',
      rightHand: 'Right Hand',
      xyPad: 'XY Pad',
      notDetected: 'Not Detected',
      normal: 'Normal',
      pinching: 'Pinching',
      notPinching: 'Not Pinching',
      activated: 'Activated',
      notActivated: 'Not Activated',
      fist: 'Fist'
    },
    
    canvasOpacity: {
      title: '🎨 Canvas Opacity'
    },
    
    camera: {
      title: '📹 Camera',
      mirror: 'Mirror',
      mirrorOn: 'Mirror (On)',
      mirrorOff: 'Mirror (Off)'
    },
    
    parameters: {
      title: '🎵 Parameters',
      tempo: 'Tempo',
      chordSize: 'Chord Size'
    },
    
    audioEffects: {
      title: '🎚 Audio Effects',
      delayWet: 'Delay Wet',
      delayTime: 'Delay Time',
      reverbWet: 'Reverb Wet'
    },
    
    scaleSettings: {
      title: '🎼 Scale Settings',
      root: 'Root',
      mode: 'Mode'
    },
    
    visualMode: {
      title: '🌀 Visual Mode',
      grid: 'Grid',
      rings: 'Rings'
    },
    
    statusBar: {
      title: '🎵 Current Status',
      timbre: 'Timbre',
      coords: 'Coords',
      note: 'Note',
      tempo: 'Tempo'
    },
    
    loading: {
      initializing: 'Initializing...',
      waitForInteraction: 'Initialization complete, waiting for gesture interaction to start audio...'
    },
    error: {
      initFailed: 'Initialization Failed',
      checkCamera: 'Please check:\n1. Camera permissions allowed\n2. Network connection normal\n3. Browser supports WebGL'
    }
  }
};

export class I18nManager {
  constructor() {
    this.currentLang = 'zh';
    this.t = i18n[this.currentLang];
  }
  
  setLanguage(lang) {
    if (i18n[lang]) {
      this.currentLang = lang;
      this.t = i18n[lang];
      return true;
    }
    return false;
  }
  
  getText(key) {
    const keys = key.split('.');
    let value = this.t;
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // 返回key作为fallback
      }
    }
    return value || key;
  }
  
  getCurrentLang() {
    return this.currentLang;
  }
}

