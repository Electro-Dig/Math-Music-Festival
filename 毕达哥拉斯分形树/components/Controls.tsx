
import React, { useState } from 'react';
import { TreeConfig, TreeType } from '../types';
import { 
  Play, 
  RotateCcw, 
  Settings2, 
  Palette, 
  TreeDeciduous, 
  Square, 
  BoxSelect, 
  Triangle, 
  Circle,
  Shapes,
  Camera,
  Scan,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

interface ControlsProps {
  config: TreeConfig;
  onChange: (newConfig: TreeConfig) => void;
  onReset: () => void;
  isAnimating: boolean;
  toggleAnimation: () => void;
  isMotionControlActive: boolean;
  toggleMotionControl: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  config,
  onChange,
  onReset,
  isAnimating,
  toggleAnimation,
  isMotionControlActive,
  toggleMotionControl
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleChange = (key: keyof TreeConfig, value: number | string) => {
    onChange({ ...config, [key]: value });
  };

  const renderShapeButton = (type: TreeType, Icon: React.ElementType, label: string) => (
    <button
      onClick={() => handleChange('treeType', type)}
      className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all ${
        config.treeType === type
          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
      }`}
      title={label}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] uppercase font-medium">{label}</span>
    </button>
  );

  const getLabelWithAI = (label: string) => (
    <div className="flex justify-between items-center w-full">
        <label className="text-zinc-300">{label}</label>
        {isMotionControlActive && (
            <span className="flex items-center gap-1 text-[9px] text-blue-400 font-bold uppercase tracking-wider bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                <Scan className="w-3 h-3" />
                AI
            </span>
        )}
    </div>
  );

  // w-80 is 20rem. We add a bit of padding/gap logic for the slide out.
  // When collapsed, we move it right by approx 20rem, leaving just the button visible.
  
  return (
    <div 
        className={`absolute top-4 transition-all duration-500 ease-in-out z-50 flex items-start ${isCollapsed ? '-right-[19.5rem]' : 'right-4'}`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="mt-1 mr-3 p-2 bg-zinc-900/90 border border-zinc-800 text-zinc-400 rounded-l-lg hover:text-white hover:bg-zinc-800 transition-colors shadow-lg backdrop-blur-md z-10"
        title={isCollapsed ? "Expand Controls" : "Collapse Controls"}
      >
        {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Main Panel Content */}
      <div className="w-80 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl p-5 shadow-2xl flex flex-col gap-6 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
            <TreeDeciduous className="w-6 h-6 text-orange-500" />
            <div>
            <h1 className="font-bold text-zinc-100 text-lg">毕达哥拉斯树</h1>
            <p className="text-xs text-zinc-500">Fractal Tree Generator</p>
            </div>
        </div>

        {/* Motion Control Toggle */}
        <button
            onClick={toggleMotionControl}
            className={`relative group flex items-center justify-between px-4 py-3 rounded-lg border transition-all overflow-hidden ${
                isMotionControlActive
                ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'
            }`}
            >
            <div className="flex items-center gap-3 relative z-10">
                <div className={`p-1.5 rounded-md ${isMotionControlActive ? 'bg-blue-500 text-black' : 'bg-zinc-700'}`}>
                    <Camera className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start text-left">
                    <span className="font-bold text-xs tracking-wide">体感控制 (MOTION)</span>
                    <span className="text-[10px] opacity-70">
                        {isMotionControlActive ? 'AI Vision Active' : 'Click to Enable'}
                    </span>
                </div>
            </div>
            <div className={`w-2 h-2 rounded-full relative z-10 ${isMotionControlActive ? 'bg-blue-400 animate-pulse shadow-[0_0_8px_currentColor]' : 'bg-zinc-600'}`} />
            
            {/* Active BG Effect */}
            {isMotionControlActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent animate-pulse" />
            )}
        </button>

        {/* Main Actions */}
        <div className="grid grid-cols-2 gap-3">
            <button
            onClick={toggleAnimation}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isAnimating
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
            }`}
            >
            <Play className={`w-4 h-4 ${isAnimating ? 'fill-current' : ''}`} />
            {isAnimating ? '停止生长' : '开始生长'}
            </button>
            <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700"
            >
            <RotateCcw className="w-4 h-4" />
            重置
            </button>
        </div>

        {/* Shape Selection */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-zinc-400">
            <Shapes className="w-4 h-4" />
            <span className="font-semibold uppercase tracking-wider text-xs">基础形状 (Base Shape)</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
            {renderShapeButton('classic', Square, '实心')}
            {renderShapeButton('wireframe', BoxSelect, '线框')}
            {renderShapeButton('triangle', Triangle, '晶体')}
            {renderShapeButton('bubble', Circle, '细胞')}
            </div>
        </div>

        {/* Parameters Section */}
        <div className="space-y-5 border-t border-zinc-800 pt-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Settings2 className="w-4 h-4" />
            <span className="font-semibold uppercase tracking-wider text-xs">几何参数 (Geometry)</span>
            </div>

            {/* Recursion Depth */}
            <div className="space-y-2">
            <div className="flex justify-between">
                {getLabelWithAI("生长层数 (Depth)")}
                <span className={`font-mono ${isMotionControlActive ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {config.maxDepth.toFixed(1)}
                </span>
            </div>
            <input
                type="range"
                min="1"
                max="12"
                step="0.1"
                disabled={isMotionControlActive}
                value={config.maxDepth}
                onChange={(e) => handleChange('maxDepth', parseFloat(e.target.value))}
                className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                    isMotionControlActive 
                        ? 'bg-zinc-800 cursor-not-allowed accent-zinc-600' 
                        : 'bg-zinc-700 accent-emerald-500'
                }`}
            />
            </div>

            {/* Angle */}
            <div className="space-y-2">
            <div className="flex justify-between">
                {getLabelWithAI("张开角度 (Angle)")}
                <span className={`font-mono ${isMotionControlActive ? 'text-blue-400' : 'text-emerald-400'}`}>{Math.round(config.leftAngle)}°</span>
            </div>
            <input
                type="range"
                min="0"
                max="90"
                disabled={isMotionControlActive}
                value={config.leftAngle}
                onChange={(e) => {
                const val = parseInt(e.target.value);
                onChange({ ...config, leftAngle: val, rightAngle: val });
                }}
                className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                    isMotionControlActive 
                        ? 'bg-zinc-800 cursor-not-allowed accent-zinc-600' 
                        : 'bg-zinc-700 accent-emerald-500'
                }`}
            />
            </div>

            {/* Asymmetry */}
            <div className="space-y-2">
            <div className="flex justify-between">
                {getLabelWithAI("不对称性 (Wind)")}
                <span className={`font-mono ${isMotionControlActive ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {config.asymmetry.toFixed(2)}
                </span>
            </div>
            <input
                type="range"
                min="-0.5"
                max="0.5"
                step="0.01"
                disabled={isMotionControlActive}
                value={config.asymmetry}
                onChange={(e) => handleChange('asymmetry', parseFloat(e.target.value))}
                className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                    isMotionControlActive 
                        ? 'bg-zinc-800 cursor-not-allowed accent-zinc-600' 
                        : 'bg-zinc-700 accent-emerald-500'
                }`}
            />
            </div>

            {/* Size Ratio */}
            <div className="space-y-2">
            <div className="flex justify-between">
                {getLabelWithAI("基础大小 (Base Size)")}
                <span className={`font-mono ${isMotionControlActive ? 'text-blue-400' : 'text-emerald-400'}`}>{Math.round(config.sizeRatio * 100)}%</span>
            </div>
            <input
                type="range"
                min="0.05"
                max="0.25"
                step="0.01"
                disabled={isMotionControlActive}
                value={config.sizeRatio}
                onChange={(e) => handleChange('sizeRatio', parseFloat(e.target.value))}
                className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                    isMotionControlActive 
                        ? 'bg-zinc-800 cursor-not-allowed accent-zinc-600' 
                        : 'bg-zinc-700 accent-emerald-500'
                }`}
            />
            </div>
        </div>

        {/* Appearance Section */}
        <div className="space-y-4 border-t border-zinc-800 pt-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Palette className="w-4 h-4" />
            <span className="font-semibold uppercase tracking-wider text-xs">外观 (Appearance)</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
            {['neon', 'nature', 'classic', 'mono'].map((scheme) => (
                <button
                key={scheme}
                onClick={() => handleChange('colorScheme', scheme)}
                className={`px-3 py-2 rounded text-xs font-medium capitalize transition-all ${
                    config.colorScheme === scheme
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-transparent'
                }`}
                >
                {scheme}
                </button>
            ))}
            </div>
        </div>

        {/* Explanation */}
        <div className="mt-2 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
            <h4 className="text-xs font-bold text-zinc-300 mb-1 flex items-center gap-1">
                体感操作指南 / Motion Guide
            </h4>
            <ul className="text-[10px] text-zinc-500 space-y-1.5">
                <li className="flex items-start gap-1">
                    <span className="text-blue-500 font-bold">MODE 1:</span>
                    <span className="text-zinc-400">双掌张开 (Open Hands) → 调整大小 (Size)</span>
                </li>
                <li className="flex items-start gap-1">
                    <span className="text-purple-500 font-bold">MODE 2:</span>
                    <span className="text-zinc-400">双手握拳 (Fists) → 调整层数 (Layers)</span>
                </li>
                <li className="border-t border-zinc-800 my-1 pt-1 opacity-50"></li>
                <li className="flex items-start gap-1">
                    <span className="text-emerald-500">•</span>
                    <span><b>双臂高举 (Height):</b> 开合角度 (Angle)</span>
                </li>
                <li className="flex items-start gap-1">
                    <span className="text-orange-500">•</span>
                    <span><b>上下倾斜 (Tilt):</b> 树的倾斜 (Wind)</span>
                </li>
            </ul>
        </div>
      </div>
    </div>
  );
};
