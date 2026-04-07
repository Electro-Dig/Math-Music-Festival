import React, { useRef, useEffect, useCallback } from 'react';

interface SimulationCanvasProps {
  m: number;
  n: number;
  particleCount: number;
  speed: number;
  isPlaying: boolean;
  color: string;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ 
  m, 
  n, 
  particleCount, 
  speed,
  isPlaying,
  color
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>();
  
  // Use Float32Array for high-performance particle storage
  // Format: [x1, y1, x2, y2, ...]
  const particlesRef = useRef<Float32Array>(new Float32Array(0));

  // Initialize particles strictly within the 0-1 range
  const initParticles = useCallback((count: number) => {
    const arr = new Float32Array(count * 2);
    for (let i = 0; i < count * 2; i++) {
      arr[i] = Math.random();
    }
    particlesRef.current = arr;
  }, []);

  // Handle Resize and Init
  useEffect(() => {
    if (!particlesRef.current || particlesRef.current.length !== particleCount * 2) {
      initParticles(particleCount);
    }
  }, [particleCount, initParticles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const size = Math.min(container.clientWidth, container.clientHeight);
      // specific logic to keep it square and sharp
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // The Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // optimization
    if (!ctx) return;

    const render = () => {
      if (!isPlaying) {
        animationFrameId.current = requestAnimationFrame(render);
        return;
      }

      // Getting dimensions from style is safer for the logic coordinate system mapping
      const width = parseFloat(canvas.style.width);
      const height = parseFloat(canvas.style.height);
      const size = width; // Square canvas

      // Fading trail effect for smoother visuals
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; 
      ctx.fillRect(0, 0, width, height);
      
      ctx.fillStyle = color;

      const particles = particlesRef.current;
      const count = particles.length / 2;
      const PI = Math.PI;
      
      // Constants for the formula to avoid re-calculation
      const mPi = m * PI;
      const nPi = n * PI;

      // Physics Parameters
      // The "kick" is proportional to amplitude. 
      // Higher vibration = larger random step.
      const movementScale = speed * 0.05; 
      const minJitter = 0.001; // Tiny jitter to prevent getting stuck permanently

      for (let i = 0; i < count; i++) {
        const idx = i * 2;
        let x = particles[idx];
        let y = particles[idx + 1];

        // Chladni Formula: cos(n*pi*x)*cos(m*pi*y) - cos(m*pi*x)*cos(n*pi*y)
        // Note: x and y are normalized [0, 1]
        
        // Calculate Amplitude at current position
        const term1 = Math.cos(nPi * x) * Math.cos(mPi * y);
        const term2 = Math.cos(mPi * x) * Math.cos(nPi * y);
        const amplitude = Math.abs(term1 - term2);

        // Stochastic Movement:
        // Move particle by a random amount proportional to local amplitude.
        // If amplitude is 0 (Node), they barely move.
        // If amplitude is high (Antinode), they jump far away.
        const step = (amplitude * movementScale) + minJitter;

        x += (Math.random() - 0.5) * step;
        y += (Math.random() - 0.5) * step;

        // Boundary Clamping (Bounce logic could be used, but clamping is safer for this math)
        if (x < 0) x = 0;
        if (x > 1) x = 1;
        if (y < 0) y = 0;
        if (y > 1) y = 1;

        particles[idx] = x;
        particles[idx + 1] = y;

        // Draw
        // We draw 1.5x1.5 rects for performance instead of arcs
        ctx.fillRect(x * size, y * size, 1.5, 1.5);
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [m, n, particleCount, speed, isPlaying, color]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-neutral-900 rounded-lg shadow-2xl overflow-hidden border border-neutral-800 relative">
       {/* Simulation Overlay Info */}
      <div className="absolute top-4 right-4 pointer-events-none text-right z-10 opacity-60">
        <p className="text-xs font-mono text-white">MODE</p>
        <p className="text-xl font-bold font-mono text-white">m={m}, n={n}</p>
      </div>

      <canvas 
        ref={canvasRef} 
        className="block touch-none"
      />
    </div>
  );
};

export default SimulationCanvas;