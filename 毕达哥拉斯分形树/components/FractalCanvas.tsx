
import React, { useRef, useEffect, useState } from 'react';
import { TreeConfig, FractalStats } from '../types';

interface FractalCanvasProps {
  config: TreeConfig;
  isAnimating: boolean;
  onStatsUpdate: (stats: FractalStats) => void;
}

export const FractalCanvas: React.FC<FractalCanvasProps> = ({
  config,
  isAnimating,
  onStatsUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Animation state
  const animationRef = useRef<number>();
  const progressRef = useRef<number>(0); // 0 to config.maxDepth
  const [dpr, setDpr] = useState(1);

  // Colors
  const getFillColor = (level: number, maxDepth: number, scheme: string, hueOffset: number = 0) => {
    const ratio = level / maxDepth;
    
    // Helper to wrap hue around 360
    const wrapHue = (h: number) => (h + hueOffset + 360) % 360;

    switch (scheme) {
      case 'nature':
        // Brown to Green
        // We only slightly shift nature colors, or it looks weird
        if (ratio < 0.3) return `hsl(${wrapHue(30)}, ${60 - ratio * 50}%, ${20 + ratio * 20}%)`; // Trunk
        return `hsl(${wrapHue(80 + ratio * 60)}, ${60 + ratio * 20}%, ${30 + ratio * 40}%)`; // Leaves
      
      case 'classic':
        // Black and White - Hue shift adds subtle tint
        return `hsl(${hueOffset}, ${Math.abs(hueOffset) > 10 ? 20 : 0}%, ${100 - ratio * 60}%)`;
        
      case 'mono':
        // Base blue 220
        return `hsl(${wrapHue(220)}, 100%, ${50 + ratio * 50}%)`;

      case 'neon':
      default:
        // Orange -> Pink -> Yellow/Green
        if (ratio < 0.2) return `hsl(${wrapHue(10 + ratio * 50)}, 100%, 60%)`; // Orange/Red
        if (ratio < 0.6) return `hsl(${wrapHue(320 + (ratio - 0.2) * 50)}, 80%, 60%)`; // Pink
        return `hsl(${wrapHue(60 + (ratio - 0.6) * 200)}, 90%, 70%)`; // Yellow/Green
    }
  };

  const drawShape = (
    ctx: CanvasRenderingContext2D,
    size: number,
    type: string,
    color: string,
    depth: number,
    maxDepth: number
  ) => {
    // Standard Pythagoras shape assumes drawing a square from (0,-size) to (size,-size)
    // i.e., origin is Bottom-Left, extending Up-Right.
    
    switch (type) {
      case 'wireframe':
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, size * 0.1);
        // Optional: Make deeper levels more transparent in wireframe for depth effect
        if (depth > maxDepth * 0.8) ctx.globalAlpha = 0.6;
        ctx.strokeRect(0, -size, size, size);
        ctx.globalAlpha = 1.0;
        break;

      case 'triangle':
        ctx.fillStyle = color;
        ctx.beginPath();
        // Draw a triangle that fits within the square bounds
        // Bottom-Left (0,0), Bottom-Right (size,0), Top-Center (size/2, -size)
        ctx.moveTo(0, 0);
        ctx.lineTo(size, 0);
        ctx.lineTo(size / 2, -size);
        ctx.closePath();
        ctx.fill();
        break;

      case 'bubble':
        ctx.fillStyle = color;
        ctx.beginPath();
        // Draw circle centered in the square space
        ctx.arc(size / 2, -size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a small highlight for "bubble" effect
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(size / 3, -size / 1.5, size / 6, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'classic':
      default:
        ctx.fillStyle = color;
        ctx.shadowBlur = config.colorScheme === 'neon' ? 10 : 0;
        ctx.shadowColor = color;
        ctx.fillRect(0, -size, size, size);
        ctx.shadowBlur = 0; // Reset
        break;
    }
  };

  const drawTree = (
    ctx: CanvasRenderingContext2D,
    size: number,
    depth: number,
    maxDepth: number,
    leftAngleRad: number,
    rightAngleRad: number
  ) => {
    // Base case
    if (depth > maxDepth || size < 1) return;

    const color = getFillColor(depth, config.maxDepth, config.colorScheme, config.hueOffset);
    
    // Draw the shape for this level
    drawShape(ctx, size, config.treeType, color, depth, config.maxDepth);
    
    // Animation / Recursion Limit Logic
    const isLastLevel = depth === Math.floor(maxDepth);
    const scaleModifier = isLastLevel ? (maxDepth % 1) : 1;
    const finalScale = scaleModifier === 0 ? 1 : scaleModifier;
    
    if (depth >= maxDepth) return;

    const leftScale = Math.cos(leftAngleRad);
    
    // Note: Strict Pythagoras Geometry assumes R = 90 - L.
    // We calculate the right scale to match the geometry gap.
    const rightScaleFactor = Math.sin(leftAngleRad); 

    // LEFT BRANCH
    ctx.save();
    ctx.translate(0, -size); // Move to top-left corner
    ctx.rotate(-leftAngleRad); // Rotate left
    ctx.scale(leftScale * finalScale, leftScale * finalScale);
    drawTree(ctx, size, depth + 1, maxDepth, leftAngleRad, rightAngleRad);
    ctx.restore();

    // RIGHT BRANCH
    ctx.save();
    // Standard Pythagoras move:
    ctx.translate(0, -size); // Top Left
    ctx.rotate(-leftAngleRad); 
    ctx.translate(size * leftScale, 0); // Move along hypotenuse to Apex
    ctx.rotate(90 * Math.PI / 180); // Rotate 90 deg to face the right leg direction
    ctx.scale(rightScaleFactor * finalScale, rightScaleFactor * finalScale);
    drawTree(ctx, size, depth + 1, maxDepth, leftAngleRad, rightAngleRad);
    ctx.restore();
  };

  const render = (timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle Resize
    const parent = containerRef.current;
    if (parent) {
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
    }

    // Update Animation Progress
    if (isAnimating) {
        if (progressRef.current < config.maxDepth) {
            progressRef.current += 0.05 * config.animationSpeed;
        } else {
           progressRef.current = config.maxDepth;
        }
    } else {
        const diff = config.maxDepth - progressRef.current;
        if (Math.abs(diff) > 0.01) {
            progressRef.current += diff * 0.2;
        } else {
            progressRef.current = config.maxDepth;
        }
    }
    
    // Stats
    const nodeCount = Math.pow(2, Math.floor(progressRef.current) + 1) - 1;
    onStatsUpdate({
        nodeCount,
        currentDepth: parseFloat(progressRef.current.toFixed(2))
    });

    // Setup Drawing Context
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    
    ctx.save();
    // MANUAL POSITION ADJUSTMENT
    // Was -60, Changed to -100 as requested to move tree more to the left
    ctx.translate(width / 2 - 100, height - 50);
    
    // Apply wind/asymmetry
    ctx.rotate(config.asymmetry * 0.2);

    const baseSize = Math.min(width, height) * config.sizeRatio;
    
    // Convert degrees to radians & apply asymmetry to angle
    const lRad = config.leftAngle * (Math.PI / 180);
    const effectiveL = lRad + (config.asymmetry * 0.5);
    
    // Blend Mode for cooler effects in certain modes
    if (config.treeType === 'wireframe' || config.treeType === 'bubble') {
        ctx.globalCompositeOperation = 'screen'; // Makes overlapping lines/circles glow
    } else {
        ctx.globalCompositeOperation = 'source-over';
    }

    drawTree(
        ctx, 
        baseSize, 
        0, 
        progressRef.current, 
        effectiveL, 
        (Math.PI / 2) - effectiveL
    );
    
    ctx.restore();

    animationRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
  }, []);

  useEffect(() => {
    if (isAnimating && progressRef.current >= config.maxDepth) {
        progressRef.current = 0;
    }
  }, [isAnimating]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(render);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [config, isAnimating, dpr]);

  return (
    <div ref={containerRef} className="w-full h-full bg-zinc-950 relative overflow-hidden">
      {/* Grid Background Effect */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
            backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
        }}
      />
      <canvas
        ref={canvasRef}
        className="block w-full h-full relative z-10"
      />
    </div>
  );
};
