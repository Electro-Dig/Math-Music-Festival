import React, { useState, useEffect, useRef } from 'react';
import ThreeScene, { sequencePresetKeys } from './components/ThreeScene';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

export type Version = 'NEON_STATIC' | 'NEON_DANCE' | 'WAVE_DANCE' | 'FUNCTION_MORPH' | 'FUNCTION_FUSION' | 'AUDIO_WAVE';
export type ChoreographyMode = 'Off' | 'Ensemble' | 'Rippling Waves' | 'Counterpoint' | 'Helix Twist' | 'Radial Star' | 'Accordion' | 'Vortex' | 'Sphere Wrap';
export type AudioReactionMode = 'Spectrum' | 'Voltage' | 'Heartbeat';

const versionDescriptions: Record<Version, string> = {
  NEON_STATIC: 'Version 1: Static y = x² lines with a neon bloom effect.',
  NEON_DANCE: 'Version 2: The lines dance by animating their vertices to a sine wave.',
  WAVE_DANCE: 'Version 3: The lines perform a "wave dance" by animating their scale.',
  FUNCTION_MORPH: 'Version 4: The lines smoothly morph between different mathematical functions.',
  FUNCTION_FUSION: 'Version 5: Two parent functions fuse to create a child function in real-time.',
  AUDIO_WAVE: 'Version 6: The lines react to real-time audio. Configure the wave shape below.',
};

const customPresets = [
    { name: 'Parabola', formula: '(x*x)/5 - 4' },
    { name: 'Sine', formula: 'sin(x)' },
    { name: 'Gaussian', formula: 'exp(-x*x)*4' },
    { name: 'Sinc', formula: 'sin(x*3)/(x*3)*4' },
    { name: 'Ripple', formula: 'sin(x*3) * exp(-abs(x)/2)*3' },
    { name: 'Stairs', formula: 'floor(x)' },
    { name: 'Sigmoid', formula: '10/(1+exp(-x)) - 5' },
    { name: 'Abs', formula: 'abs(x) - 2' },
    { name: 'Tan', formula: 'tan(x/2)' },
];

// --- Hand Controller Component ---
interface HandControllerProps {
    onUpdate: (data: { amplitude: number; frequency: number; cameraX: number }) => void;
    isActive: boolean;
}

const HandController: React.FC<HandControllerProps> = ({ onUpdate, isActive }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const requestRef = useRef<number>(0);

    useEffect(() => {
        if (!isActive) return;

        const startWebcam = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
                landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2
                });
                setIsLoaded(true);

                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.addEventListener("loadeddata", predictWebcam);
                }
            } catch (err) {
                console.error("Webcam/MediaPipe error:", err);
            }
        };

        startWebcam();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            }
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            landmarkerRef.current?.close();
        };
    }, [isActive]);

    const predictWebcam = () => {
        if (!videoRef.current || !canvasRef.current || !landmarkerRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        
        if (video.currentTime > 0 && !video.paused && !video.ended) {
            const results = landmarkerRef.current.detectForVideo(video, performance.now());
            
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            
            // HUD Styling
            if(ctx) {
                ctx.strokeStyle = "#00FFFF";
                ctx.lineWidth = 1;
            }

            let amp = 1;
            let freq = 1;
            let camX = 0;

            if (results.landmarks) {
                for (const landmarks of results.landmarks) {
                   // Simple Drawing
                   // We use raw coordinates for speed, drawing rudimentary skeleton
                   const connect = (i: number, j: number) => {
                       const p1 = landmarks[i]; const p2 = landmarks[j];
                       ctx?.beginPath(); ctx?.moveTo(p1.x * canvas.width, p1.y * canvas.height); 
                       ctx?.lineTo(p2.x * canvas.width, p2.y * canvas.height); ctx?.stroke();
                   };
                   
                   // Thumb to Index logic for pinch
                   const thumbTip = landmarks[4];
                   const indexTip = landmarks[8];
                   const wrist = landmarks[0];
                   
                   // Distance
                   const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
                   
                   // Determine "Left" vs "Right" roughly by screen position (Video is mirrored usually)
                   // Left side of screen = Right Hand (User's perspective) -> Amplitude
                   // Right side of screen = Left Hand (User's perspective) -> Frequency
                   const isRightHand = wrist.x < 0.5; 

                   if (isRightHand) { // Screen Left
                       // Map pinch (approx 0.02 to 0.2) to Amplitude (0.5 to 3.0)
                       amp = 0.5 + Math.min(1, Math.max(0, (pinchDist - 0.02) * 5)) * 2.5;
                       
                       // Draw Amplitude Indicator
                       if(ctx) {
                           ctx.fillStyle = "rgba(0, 255, 255, 0.5)";
                           ctx.fillRect(thumbTip.x * canvas.width, thumbTip.y * canvas.height - 20, 5, -amp * 10);
                           ctx.fillText("AMP", thumbTip.x * canvas.width, thumbTip.y * canvas.height - 30);
                       }
                   } else { // Screen Right
                       // Map pinch to Frequency (0.5 to 3.0)
                       freq = 0.5 + Math.min(1, Math.max(0, (pinchDist - 0.02) * 5)) * 2.5;
                       
                       // Draw Frequency Indicator
                       if(ctx) {
                           ctx.fillStyle = "rgba(255, 0, 255, 0.5)";
                           ctx.fillRect(thumbTip.x * canvas.width, thumbTip.y * canvas.height - 20, 5, -freq * 10);
                           ctx.fillText("FREQ", thumbTip.x * canvas.width, thumbTip.y * canvas.height - 30);
                       }
                   }
                   
                   // Camera Control: Average X position
                   // Center is 0.5. Map 0.2-0.8 to -0.05 to +0.05 rotation speed
                   camX += (wrist.x - 0.5) * 0.05; 
                   
                   // Draw skeleton connections (Thumb, Index, Pinky, Wrist)
                   ctx!.strokeStyle = isRightHand ? "cyan" : "magenta";
                   connect(0, 1); connect(1, 4);
                   connect(0, 5); connect(5, 8);
                   connect(0, 17); connect(17, 20);
                }
            }

            onUpdate({ amplitude: amp, frequency: freq, cameraX: camX });
        }
        
        requestRef.current = requestAnimationFrame(predictWebcam);
    };

    return (
        <div className="relative w-40 h-32 border border-cyan-800 bg-black/50 rounded-lg overflow-hidden animate-in fade-in zoom-in duration-300">
             {!isLoaded && <div className="absolute inset-0 flex items-center justify-center text-xs text-cyan-500 animate-pulse">Initializing Neural Net...</div>}
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-60" autoPlay playsInline muted />
            <canvas ref={canvasRef} width={320} height={240} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute top-1 left-1 text-[8px] text-cyan-400 bg-black/80 px-1 rounded">SYS.HAND_TRACKING</div>
        </div>
    );
};


const App: React.FC = () => {
  const [version, setVersion] = useState<Version>('AUDIO_WAVE');
  const [formulaText, setFormulaText] = useState('');
  
  // Global Controls State
  const [isMouseInteractionOn, setMouseInteraction] = useState(true);
  const [isBreathingCameraOn, setBreathingCamera] = useState(true);
  const [cameraSpeed, setCameraSpeed] = useState(0.2);
  const [choreographyMode, setChoreographyMode] = useState<ChoreographyMode>('Off');
  const [isPanelCollapsed, setPanelCollapsed] = useState(false);
  const [lineCount, setLineCount] = useState(5);
  const [activeSequenceKey, setActiveSequenceKey] = useState<string>('Chaos Theory');
  const [isRandomMode, setRandomMode] = useState(false);
  const [reseedTrigger, setReseedTrigger] = useState(0);
  
  // Audio Controls
  const [isAudioActive, setAudioActive] = useState(false);
  const [audioReactionMode, setAudioReactionMode] = useState<AudioReactionMode>('Spectrum');
  const [audioGain, setAudioGain] = useState(1.0);
  
  // Custom Formula Controls
  const [isCustomFormulaMode, setCustomFormulaMode] = useState(false);
  const [customFormula, setCustomFormula] = useState('sin(x) * x');

  // Gesture Controls
  const [isHandControlActive, setHandControlActive] = useState(false);
  const [gestureState, setGestureState] = useState({ amplitude: 1, frequency: 1, cameraX: 0 });

  const VersionButton: React.FC<{ label: string; versionKey: Version }> = ({ label, versionKey }) => (
    <button
      onClick={() => setVersion(versionKey)}
      className={`px-3 py-1.5 text-xs md:text-sm border rounded-md transition-all duration-200 w-full text-left ${
        version === versionKey
          ? 'bg-cyan-400 text-black border-cyan-400'
          : 'bg-black bg-opacity-20 border-gray-600 hover:bg-gray-800 hover:border-gray-500'
      }`}
    >
      {label}
    </button>
  );
  
  const ToggleButton: React.FC<{ label: string; isOn: boolean; onClick: () => void; activeColor?: string }> = ({ label, isOn, onClick, activeColor = 'bg-green-500 border-green-500' }) => (
     <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs md:text-sm border rounded-md transition-all duration-200 w-full text-left ${
        isOn
          ? `${activeColor} text-black`
          : 'bg-black bg-opacity-20 border-gray-600 hover:bg-gray-800 hover:border-gray-500'
      }`}
    >
      {label}: {isOn ? 'On' : 'Off'}
    </button>
  );


  return (
    <div className="relative w-screen h-screen bg-black text-white font-mono overflow-hidden">
      <ThreeScene 
        version={version} 
        onFormulaChange={setFormulaText} 
        isMouseInteractionEnabled={isMouseInteractionOn}
        isBreathingCameraEnabled={isBreathingCameraOn}
        cameraSpeed={cameraSpeed}
        choreographyMode={choreographyMode}
        lineCount={lineCount}
        activeSequenceKey={activeSequenceKey}
        isRandomMode={isRandomMode}
        reseedTrigger={reseedTrigger}
        isAudioActive={isAudioActive}
        audioReactionMode={audioReactionMode}
        audioGain={audioGain}
        isCustomFormulaMode={isCustomFormulaMode}
        customFormula={customFormula}
        gestureAmplitude={isHandControlActive ? gestureState.amplitude : 1}
        gestureFrequency={isHandControlActive ? gestureState.frequency : 1}
        gestureCameraX={isHandControlActive ? gestureState.cameraX : 0}
      />
      
      {(version === 'FUNCTION_MORPH' || version === 'FUNCTION_FUSION') && (
        <div id="formula-text" className="absolute top-24 md:top-16 left-1/2 -translate-x-1/2 text-white text-xl md:text-3xl font-mono pointer-events-none p-2 bg-black bg-opacity-25 rounded-lg text-center">
          {formulaText}
        </div>
      )}

      <div className="absolute top-0 left-0 p-4 md:p-8 pointer-events-none max-w-lg z-10">
        <h1 className="text-2xl md:text-4xl font-bold text-shadow-lg">Math Function Dancer</h1>
        <p className="mt-2 text-sm md:text-base text-gray-300">Drag to rotate. Scroll to zoom.</p>
        <p className="mt-1 text-xs md:text-sm text-gray-400">{versionDescriptions[version]}</p>
      </div>

       <div className={`absolute bottom-4 left-4 md:bottom-8 md:left-8 flex flex-col gap-4 pointer-events-auto w-52 md:w-60 bg-black bg-opacity-60 backdrop-blur-md p-3 rounded-xl border border-gray-800 transition-transform duration-500 z-20 max-h-[75vh] overflow-y-auto custom-scrollbar ${isPanelCollapsed ? '-translate-x-[150%]' : 'translate-x-0'}`}>
        <button onClick={() => setPanelCollapsed(!isPanelCollapsed)} className="absolute -right-8 top-0 bg-gray-800 bg-opacity-70 p-2 rounded-r-lg text-lg">
          {isPanelCollapsed ? '›' : '‹'}
        </button>
        
        {/* Gesture Control Toggle & HUD */}
        <div className="mb-2">
            <h3 className="text-sm md:text-base font-bold mb-2 text-cyan-400">Gesture Control</h3>
            <ToggleButton 
                label="Hand Tracking" 
                isOn={isHandControlActive} 
                onClick={() => setHandControlActive(v => !v)} 
                activeColor="bg-cyan-500 border-cyan-500 text-black"
            />
            {isHandControlActive && (
                <div className="mt-2 flex justify-center">
                    <HandController isActive={isHandControlActive} onUpdate={setGestureState} />
                </div>
            )}
            {isHandControlActive && (
                <div className="mt-1 text-[10px] text-gray-400 text-center">
                    <span className="text-cyan-400">Right Pinch:</span> Amp | <span className="text-magenta-400 text-fuchsia-400">Left Pinch:</span> Freq | Move: Cam
                </div>
            )}
        </div>

        <div>
          <h3 className="text-sm md:text-base font-bold mb-2">Modes</h3>
          <div className="flex flex-col gap-2">
            <VersionButton label="Neon Static" versionKey="NEON_STATIC" />
            <VersionButton label="Neon Dance" versionKey="NEON_DANCE" />
            <VersionButton label="Wave Dance" versionKey="WAVE_DANCE" />
            <VersionButton label="Function Morph" versionKey="FUNCTION_MORPH" />
            <VersionButton label="Function Fusion" versionKey="FUNCTION_FUSION" />
            <VersionButton label="Audio Wave" versionKey="AUDIO_WAVE" />
          </div>
        </div>
        
        <div>
          <h3 className="text-sm md:text-base font-bold mb-2">Animation</h3>
           <div className="flex flex-col gap-3">
             <div className="flex flex-col gap-2">
                <label htmlFor="sequence-select" className="text-xs text-gray-400">Function Sequence:</label>
                <select id="sequence-select" value={activeSequenceKey} onChange={(e) => setActiveSequenceKey(e.target.value)} className="bg-gray-800 border border-gray-600 rounded-md p-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400">
                    {sequencePresetKeys.map(key => <option key={key} value={key}>{key}</option>)}
                </select>
             </div>
             <ToggleButton label="Random Mode" isOn={isRandomMode} onClick={() => setRandomMode(v => !v)} />
             {isRandomMode && (
                <button onClick={() => setReseedTrigger(c => c + 1)} className="px-3 py-1.5 text-xs md:text-sm border rounded-md transition-all duration-200 w-full bg-indigo-600 border-indigo-500 hover:bg-indigo-500 flex items-center justify-center gap-2">
                    <span>🎲</span>
                    <span>Reseed</span>
                </button>
             )}
          </div>
        </div>

        <div>
          <h3 className="text-sm md:text-base font-bold mb-2">Global Settings</h3>
           <div className="flex flex-col gap-3">
            
            {/* Wave Configuration - Only for AUDIO_WAVE */}
            {version === 'AUDIO_WAVE' && (
                <div className="flex flex-col gap-2 p-2 border border-cyan-500/30 rounded-md bg-cyan-900/10 animate-in fade-in">
                    <label className="text-xs text-cyan-400 font-bold uppercase tracking-wider">Wave Configuration</label>
                    <div className="flex gap-1 bg-gray-800 p-1 rounded-md">
                        <button 
                            onClick={() => setCustomFormulaMode(false)}
                            className={`flex-1 text-xs py-1 rounded transition-colors ${!isCustomFormulaMode ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Sequence
                        </button>
                        <button 
                            onClick={() => setCustomFormulaMode(true)}
                            className={`flex-1 text-xs py-1 rounded transition-colors ${isCustomFormulaMode ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Custom
                        </button>
                    </div>
                    
                    {isCustomFormulaMode && (
                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                            <input 
                                type="text" 
                                value={customFormula}
                                onChange={(e) => setCustomFormula(e.target.value)}
                                placeholder="e.g. sin(x) * x"
                                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 placeholder-gray-600"
                            />
                            <div className="grid grid-cols-3 gap-1">
                                {customPresets.map(preset => (
                                    <button 
                                        key={preset.name}
                                        onClick={() => setCustomFormula(preset.formula)}
                                        className="bg-gray-800 hover:bg-gray-700 active:bg-cyan-900 border border-gray-600 rounded px-1 py-1 text-[10px] text-gray-300 transition-colors"
                                        title={preset.formula}
                                    >
                                        {preset.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Microphone Settings */}
            <ToggleButton 
                label="Microphone" 
                isOn={isAudioActive} 
                onClick={() => setAudioActive(v => !v)} 
                activeColor="bg-red-500 border-red-500 text-white"
            />
            {isAudioActive && (
                <div className="pl-2 border-l-2 border-red-500 flex flex-col gap-2 animate-in fade-in slide-in-from-left-4">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="audio-mode-select" className="text-xs text-gray-400">Audio Mode:</label>
                        <select 
                            id="audio-mode-select" 
                            value={audioReactionMode} 
                            onChange={(e) => setAudioReactionMode(e.target.value as AudioReactionMode)} 
                            className="bg-gray-800 border border-gray-600 rounded-md p-1 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                            <option value="Spectrum">📊 Spectrum</option>
                            <option value="Voltage">⚡ Voltage</option>
                            <option value="Heartbeat">💓 Heartbeat</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label htmlFor="gain-slider" className="text-xs text-gray-400">Sensitivity: {audioGain.toFixed(1)}</label>
                        <input 
                            id="gain-slider"
                            type="range" 
                            min="0.5" 
                            max="5.0" 
                            step="0.1" 
                            value={audioGain}
                            onChange={(e) => setAudioGain(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                    </div>
                </div>
            )}

             <div className={`flex flex-col gap-2 transition-opacity duration-300 ${version === 'FUNCTION_FUSION' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <label htmlFor="line-count-slider" className="text-xs text-gray-400">Line Count: {lineCount}</label>
                <input 
                  id="line-count-slider"
                  type="range" 
                  min="1" 
                  max="10" 
                  step="1" 
                  value={lineCount}
                  onChange={(e) => setLineCount(parseInt(e.target.value, 10))}
                  disabled={version === 'FUNCTION_FUSION'}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
             </div>
            <ToggleButton label="Mouse FX" isOn={isMouseInteractionOn} onClick={() => setMouseInteraction(v => !v)} />
            <ToggleButton label="Camera FX" isOn={isBreathingCameraOn} onClick={() => setBreathingCamera(v => !v)} />
            {isBreathingCameraOn && (
                 <div className="flex flex-col gap-2">
                    <label htmlFor="camera-speed-slider" className="text-xs text-gray-400">Camera Speed: {cameraSpeed.toFixed(1)}</label>
                    <input 
                      id="camera-speed-slider"
                      type="range" 
                      min="0.1" 
                      max="1.5" 
                      step="0.1" 
                      value={cameraSpeed}
                      onChange={(e) => setCameraSpeed(parseFloat(e.target.value))}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            )}
            <div className="flex flex-col gap-2">
                <label htmlFor="choreography-select" className="text-xs text-gray-400">Choreography:</label>
                <select 
                    id="choreography-select" 
                    value={choreographyMode} 
                    onChange={(e) => setChoreographyMode(e.target.value as ChoreographyMode)} 
                    className="bg-gray-800 border border-gray-600 rounded-md p-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                    <option value="Off">Off</option>
                    <option value="Ensemble">Ensemble</option>
                    <option value="Rippling Waves">Rippling Waves</option>
                    <option value="Counterpoint">Counterpoint</option>
                    <option value="Helix Twist">Helix Twist (DNA)</option>
                    <option value="Radial Star">Radial Star</option>
                    <option value="Accordion">Accordion</option>
                    <option value="Vortex">🌪️ Vortex</option>
                    <option value="Sphere Wrap">🌐 Sphere Wrap</option>
                </select>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;