
import React, { useState, useCallback } from 'react';
import { FractalCanvas } from './components/FractalCanvas';
import { Controls } from './components/Controls';
import { PoseController } from './components/PoseController';
import { TreeConfig, DEFAULT_CONFIG, FractalStats } from './types';

const App: React.FC = () => {
  const [config, setConfig] = useState<TreeConfig>(DEFAULT_CONFIG);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMotionControlActive, setIsMotionControlActive] = useState(false);
  const [stats, setStats] = useState<FractalStats>({ nodeCount: 0, currentDepth: 0 });

  const handleConfigChange = useCallback((newConfig: TreeConfig) => {
    setConfig(newConfig);
  }, []);

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setIsAnimating(false);
    setIsMotionControlActive(false);
  }, []);

  const toggleAnimation = useCallback(() => {
    setIsAnimating(prev => !prev);
  }, []);

  const toggleMotionControl = useCallback(() => {
    setIsMotionControlActive(prev => !prev);
    // Reset AI influenced params when turning off
    if (isMotionControlActive) {
        setConfig(prev => ({ 
          ...prev, 
          asymmetry: 0,
          hueOffset: 0
          // We don't reset angle/sizeRatio/depth to keep the user's manual settings or last state
        }));
    }
  }, [isMotionControlActive]);

  const handlePoseUpdate = useCallback((params: { 
      asymmetry: number, 
      angle: number, 
      sizeRatio: number, 
      hueOffset: number,
      depth: number 
    }) => {
    setConfig(prev => ({
        ...prev,
        asymmetry: params.asymmetry,
        leftAngle: params.angle,
        rightAngle: params.angle,
        sizeRatio: params.sizeRatio,
        hueOffset: params.hueOffset,
        maxDepth: params.depth
    }));
  }, []);

  return (
    <div className="relative w-screen h-screen bg-zinc-950 overflow-hidden flex font-sans text-zinc-200">
      
      {/* Sidebar Controls */}
      <Controls 
        config={config} 
        onChange={handleConfigChange} 
        onReset={handleReset}
        isAnimating={isAnimating}
        toggleAnimation={toggleAnimation}
        isMotionControlActive={isMotionControlActive}
        toggleMotionControl={toggleMotionControl}
      />

      {/* AI Pose Controller (Invisible until active, but renders the small overlay) */}
      <PoseController 
        isActive={isMotionControlActive} 
        onUpdate={handlePoseUpdate} 
      />

      {/* Main Canvas Area */}
      <main className="flex-1 relative h-full">
        <FractalCanvas 
          config={config} 
          isAnimating={isAnimating}
          onStatsUpdate={setStats}
        />
        
        {/* Overlay Stats */}
        <div className="absolute bottom-6 left-6 flex gap-6 text-xs font-mono text-zinc-500 pointer-events-none z-20">
          <div className="flex flex-col">
            <span className="uppercase tracking-widest text-zinc-700">Squares</span>
            <span className="text-emerald-500 text-lg">{stats.nodeCount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="uppercase tracking-widest text-zinc-700">Current Depth</span>
            <span className="text-blue-500 text-lg">{stats.currentDepth.toFixed(1)}</span>
          </div>
          <div className="flex flex-col">
            <span className="uppercase tracking-widest text-zinc-700">Motion Sync</span>
            <span className={`text-lg transition-colors ${isMotionControlActive ? 'text-green-500 animate-pulse' : 'text-zinc-700'}`}>
              {isMotionControlActive ? 'ACTIVE' : 'OFF'}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
