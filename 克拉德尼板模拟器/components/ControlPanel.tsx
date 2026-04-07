import React from 'react';

type AudioMode = 'MANUAL' | 'SYNTH' | 'MIC' | 'REC' | 'HAND';

interface ControlPanelProps {
  m: number;
  setM: (val: number) => void;
  n: number;
  setN: (val: number) => void;
  speed: number;
  setSpeed: (val: number) => void;
  particleCount: number;
  setParticleCount: (val: number) => void;
  isPlaying: boolean;
  setIsPlaying: (val: boolean) => void;
  reset: () => void;
  audioMode: AudioMode;
  setAudioMode: (mode: AudioMode) => void;
  volumeLevel: number;
  // Rec mode props
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  hasRecording: boolean;
  playRecording: () => void;
  pauseRecording: () => void;
  isPlayingRecording: boolean;
}

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  description?: string;
  disabled?: boolean;
}> = ({ label, value, min, max, step = 1, onChange, description, disabled }) => (
  <div className={`mb-6 transition-opacity ${disabled ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
    <div className="flex justify-between items-end mb-2">
      <label className="text-sm font-medium text-gray-300 font-mono">{label}</label>
      <span className="text-sm font-bold text-cyan-400 font-mono">{value.toFixed(1)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-colors disabled:cursor-not-allowed"
    />
    {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
  </div>
);

const ModeButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}> = ({ active, onClick, label, icon }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2 px-1 rounded-md text-[10px] sm:text-xs font-bold transition-all border ${
      active
        ? 'bg-cyan-900/40 text-cyan-400 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
        : 'bg-neutral-800 text-gray-400 border-transparent hover:bg-neutral-700 hover:text-gray-200'
    }`}
  >
    <div className="text-base sm:text-lg mb-1">{icon}</div>
    {label}
  </button>
);

const ControlPanel: React.FC<ControlPanelProps> = ({
  m,
  setM,
  n,
  setN,
  speed,
  setSpeed,
  particleCount,
  setParticleCount,
  isPlaying,
  setIsPlaying,
  reset,
  audioMode,
  setAudioMode,
  volumeLevel,
  isRecording,
  startRecording,
  stopRecording,
  hasRecording,
  playRecording,
  pauseRecording,
  isPlayingRecording
}) => {
  
  const isAudioDriven = audioMode === 'MIC' || audioMode === 'REC' || audioMode === 'HAND';

  return (
    <div className="h-full bg-neutral-900 border-r border-neutral-800 p-6 flex flex-col overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Chladni<br/><span className="text-cyan-500">Resonance</span></h1>
        <p className="text-xs text-gray-400 leading-relaxed">
          Sound-Matter Interaction Simulator
        </p>
      </div>

      {/* Main Play/Pause */}
      <div className="space-y-2 mb-6">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`w-full py-3 px-4 rounded font-bold text-sm tracking-wide transition-all ${
            isPlaying 
              ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' 
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/20'
          }`}
        >
          {isPlaying 
            ? (audioMode === 'MIC' ? 'STOP LISTENING' : (audioMode === 'REC' ? 'STOP SYSTEM' : (audioMode === 'HAND' ? 'STOP CAMERA' : 'PAUSE SIMULATION'))) 
            : (audioMode === 'MIC' ? 'START MIC INPUT' : (audioMode === 'REC' ? 'START SYSTEM' : (audioMode === 'HAND' ? 'START GESTURE' : 'START SIMULATION')))
          }
        </button>
      </div>

      <div className="flex-1">
        
        {/* Audio Modes */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Input Source</h3>
          <div className="flex gap-1.5">
            <ModeButton 
              active={audioMode === 'MANUAL'} 
              onClick={() => setAudioMode('MANUAL')} 
              label="MANUAL" 
              icon="🎚️"
            />
            <ModeButton 
              active={audioMode === 'SYNTH'} 
              onClick={() => setAudioMode('SYNTH')} 
              label="SYNTH" 
              icon="🔊"
            />
            <ModeButton 
              active={audioMode === 'MIC'} 
              onClick={() => setAudioMode('MIC')} 
              label="MIC" 
              icon="🎙️"
            />
            <ModeButton 
              active={audioMode === 'REC'} 
              onClick={() => setAudioMode('REC')} 
              label="REC" 
              icon="⏺️"
            />
            <ModeButton 
              active={audioMode === 'HAND'} 
              onClick={() => setAudioMode('HAND')} 
              label="HAND" 
              icon="✋"
            />
          </div>

          {/* MIC/HAND Visualization */}
          {(audioMode === 'MIC' || audioMode === 'HAND') && isPlaying && (
            <div className="mt-3 bg-neutral-800 p-2 rounded border border-neutral-700 animate-in fade-in duration-300">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>INPUT LEVEL</span>
                <span>{(volumeLevel * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-cyan-500 h-full transition-all duration-75" 
                  style={{ width: `${Math.min(100, volumeLevel * 100 * 1.5)}%` }}
                />
              </div>
            </div>
          )}

          {/* REC Control Interface */}
          {audioMode === 'REC' && (
            <div className="mt-3 bg-neutral-800 p-3 rounded border border-neutral-700 animate-in fade-in duration-300">
              <div className="flex flex-col gap-2">
                {!hasRecording && !isRecording && (
                   <p className="text-[10px] text-gray-400 text-center mb-1">Record a sound to loop it.</p>
                )}
                
                {isRecording ? (
                  <button 
                    onClick={stopRecording}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2 animate-pulse"
                  >
                    <div className="w-3 h-3 bg-white rounded-sm"></div> STOP RECORDING
                  </button>
                ) : (
                   <div className="flex gap-2">
                     <button 
                       onClick={startRecording}
                       className={`flex-1 ${hasRecording ? 'bg-neutral-700' : 'bg-red-900/50 text-red-400 border border-red-500/30'} hover:bg-red-800 hover:text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors`}
                     >
                       <div className="w-3 h-3 bg-red-500 rounded-full"></div> {hasRecording ? 'NEW REC' : 'RECORD'}
                     </button>
                     
                     {hasRecording && (
                       <button 
                         onClick={isPlayingRecording ? pauseRecording : playRecording}
                         disabled={!isPlaying}
                         className={`flex-1 ${isPlayingRecording ? 'bg-cyan-600' : 'bg-cyan-900/50 text-cyan-400 border border-cyan-500/30'} hover:bg-cyan-600 hover:text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50`}
                       >
                         {isPlayingRecording ? 'PAUSE LOOP' : 'PLAY LOOP'}
                       </button>
                     )}
                   </div>
                )}
                {hasRecording && !isRecording && !isPlaying && (
                  <p className="text-[10px] text-yellow-500 text-center mt-1">Start Simulation to hear loop.</p>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="p-4 bg-neutral-800/50 rounded-lg border border-neutral-700/50 mb-6 relative">
           {isAudioDriven && (
             <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
               <span className="text-xs font-bold text-cyan-400 bg-black/50 px-3 py-1.5 rounded border border-cyan-500/30 shadow-lg backdrop-blur-md">
                 {audioMode === 'HAND' ? 'Controlled by Gesture' : (audioMode === 'REC' ? 'Controlled by Loop' : 'Controlled by Voice')}
               </span>
             </div>
           )}
           <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider border-b border-gray-700 pb-2">Resonance Modes</h3>
           <Slider
            label="Frequency M"
            value={m}
            min={1}
            max={20}
            onChange={setM}
            description="Horizontal standing wave"
            disabled={isAudioDriven}
          />
          <Slider
            label="Frequency N"
            value={n}
            min={1}
            max={20}
            onChange={setN}
            description="Vertical standing wave"
            disabled={isAudioDriven}
          />
        </div>

        <div className="p-4 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
           <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider border-b border-gray-700 pb-2">Physics Props</h3>
          <Slider
            label="Vibration Intensity"
            value={speed}
            min={0.1}
            max={3.0}
            step={0.1}
            onChange={setSpeed}
            description={isAudioDriven ? "Controlled by volume" : "Speed of particle convergence"}
            disabled={isAudioDriven}
          />
          <Slider
            label="Particle Count"
            value={particleCount}
            min={1000}
            max={30000}
            step={1000}
            onChange={setParticleCount}
            description="Higher count = sharper resolution"
          />
        </div>
      </div>
       
      <div className="mt-4 pt-4 border-t border-neutral-800">
         <button
          onClick={reset}
          className="w-full py-2 px-4 rounded font-medium text-xs tracking-wide text-gray-400 hover:text-white border border-neutral-700 hover:border-gray-500 transition-colors"
        >
          RESET PARTICLES
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;