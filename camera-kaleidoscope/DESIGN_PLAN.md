# 📷 Real-time Camera Kaleidoscope Design Plan

## 1. 项目概述 (Project Overview)
打造一个基于 WebGL 的高性能实时摄像头万花筒应用。不同于 `handsornament` 的手势绘画，本项目专注于**视频流的实时几何变换**，实现物理万花筒般的沉浸式视觉体验。

## 2. 核心功能 (Core Features)

### A. 四大视觉模式 (Visual Modes)
根据您提供的参考图，我们将实现以下四种通过 Shader 渲染的核心模式：

1.  **Rosette (圆心/玫瑰)**:
    *   经典万花筒效果，将视频切片进行径向镜像复制。
    *   *参数*: 分段数 (Segments), 旋转角度 (Rotation).
    
2.  **Prism / Tiling (平面/棱镜)**:
    *   参考图2。模拟三棱镜折射，形成无缝铺满屏幕的三角形/六边形网格。
    *   *算法*: Wallpaper Group (墙纸群) 变换，实现平面对称。

3.  **Spherical (球面)**:
    *   参考图1。将画面映射到球体表面，呈现鱼眼/水晶球般的立体感。
    *   *效果*: 视觉中心隆起，边缘收缩，配合旋转如同转动水晶球。

4.  **Hyperbolic (双曲)**:
    *   参考图3。基于庞加莱圆盘 (Poincaré Disk) 的非欧几何变换。
    *   *效果*: 越靠近边缘图案越密集无限重复，产生深邃的空间感。

### B. 交互控制 (Interaction)
UI 将保持与 `handsornament` 一致的高级感（Sunset/Dark 主题），提供以下控制：
*   **输入源变换**: 缩放 (Zoom)、平移 (Pan X/Y)、旋转 (Input Rotation)。
*   **对称参数**: 分段数量 (Segments 3-24)。
*   **截图/录制**: 支持保存高清当前帧。

## 3. 技术架构 (Technical Architecture)

### 核心栈
*   **HTML5/CSS3**: 界面布局，沿用 Grid 布局和 Glassmorphism (毛玻璃) 风格。
*   **Vanilla JS**: 应用逻辑控制。
*   **WebGL (GLSL)**: 核心渲染引擎。视频处理将在 GPU 片元着色器 (Fragment Shader) 中完成，以保证 60fps 的流畅度。

### 文件结构
```
camera-kaleidoscope/
├── index.html        # 主界面
├── styles.css        # 样式表 (复用 handsornament 的设计语言)
├── main.js           # 主程序入口 & UI 逻辑
└── shaders/          # GLSL 着色器代码
    ├── common.glsl   # 通用函数
    ├── rosette.glsl  # 圆心模式
    ├── tiling.glsl   # 平铺模式
    ├── sphere.glsl   # 球面模式
    └── hyperbolic.glsl # 双曲模式
```

## 4. 开发计划 (Development Steps)

1.  **基础框架搭建**:
    *   创建 WebGL 上下文。
    *   实现摄像头纹理加载 (Video Texture)。
    *   复用 `handsornament` 的 UI 框架。

2.  **Shader 开发**:
    *   实现坐标映射 (UV Mapping) 算法。
    *   依次攻克 Rosette, Tiling, Spherical, Hyperbolic 四种算法。

3.  **交互绑定**:
    *   鼠标/触摸拖拽改变视野。
    *   参数滑块实时更新 Uniforms。

4.  **优化与打磨**:
    *   性能优化 (高分辨率支持)。
    *   UI 细节 (图标、反馈动画)。

---

## 5. 视觉风格 (Visual Identity)
保持 `handsornament` 的 **Sunset (浅米黄)** 和 **Dark (深黑)** 主题，界面元素悬浮于全屏画布之上，强调沉浸感。
