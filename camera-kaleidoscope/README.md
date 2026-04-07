# Camera Kaleidoscope 镜头万花筒

A real-time WebGL kaleidoscope effect using your live camera feed.
基于 WebGL 的实时摄像头万花筒效果。

## Features (功能)
- **4 Visual Modes (四种模式)**:
  - ✦ **Rosette (圆心)**: Radial symmetry with adjustable segments (3-24).
  - ▦ **Prism (平面)**: Infinite planar tiling using recursive folding.
  - 🔮 **Spherical (球面)**: Fisheye crystal ball effect.
  - 🌀 **Hyperbolic (双曲)**: Poincaré disk style infinite zoom.
- **Transform Controls**: Zoom, Rotate, Pan X/Y.
- **Theming**: Dark and Sunset themes.
- **Screenshot**: Capture high-res images.

## How to Run (如何运行)
1. **Local Server (Recommendation)**:
   Since this app accesses the Camera and WebGL, it requires a secure context (localhost or https).
   Use `http-server` or VS Code "Live Server".

   ```bash
   npx http-server .
   ```

2. **Open Browser**:
   Navigate to `http://localhost:8080` (or the port shown).
   Allow Camera access when prompted.

## Controls
- **Toggle Panel**: Click the arrow on the right.
- **Modes**: Click the icons to switch geometry.
- **Sliders**: Adjust the visual parameters in real-time.
