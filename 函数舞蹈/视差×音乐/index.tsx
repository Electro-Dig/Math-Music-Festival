import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

// --- Noise Utility ---
const PERLIN_SIZE = 4095;
const perlin = new Float32Array(PERLIN_SIZE + 1);
for (let i = 0; i < PERLIN_SIZE + 1; i++) {
  perlin[i] = Math.random();
}

const noise = (x: number, y: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const n00 = perlin[(xi + (yi * 57)) & PERLIN_SIZE];
  const n01 = perlin[(xi + ((yi + 1) * 57)) & PERLIN_SIZE];
  const n10 = perlin[((xi + 1) + (yi * 57)) & PERLIN_SIZE];
  const n11 = perlin[((xi + 1) + ((yi + 1) * 57)) & PERLIN_SIZE];
  const x1 = n00 + u * (n10 - n00);
  const x2 = n01 + u * (n11 - n01);
  return x1 + v * (x2 - x1);
};

const mapRange = (value: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number) => {
  return ((value - inputMin) * (outputMax - outputMin)) / (inputMax - inputMin) + outputMin;
};

// --- Configurations ---
const MODES = [
  // Classic Modes
  { id: 'CYBER_GLITCH', name: 'CYBER GLITCH', type: 'noise_radial',   note: 'High Freq Static' },
  { id: 'NEURO_FLOW',   name: 'NEURO FLOW',   type: 'stepped_radial', note: 'Original C++ Step' }, 
  { id: 'SONIC_RIPPLE', name: 'SONIC RIPPLE', type: 'ring_radial',    note: 'Diffusing Waves' },
  { id: 'DATA_STORM',   name: 'DATA STORM',   type: 'point',          note: 'Quantum Particles' },
  
  // Scene Modes
  { id: 'HELIX_DUAL',   name: 'HELIX DUALITY',type: 'spiral',         note: 'Symmetric DNA' },
  { id: 'QUANTUM_TIDE', name: 'QUANTUM TIDE', type: 'wave',           note: 'Cosmic Ocean' },
  { id: 'DIGITAL_RAIN', name: 'DIGITAL RAIN', type: 'rain',           note: 'Matrix Fall' },
  { id: 'VOID_VORTEX',  name: 'VOID VORTEX',  type: 'tunnel',         note: 'Deep Gravity' },
  
  // New Crazy Mode
  { id: 'PURE_SPECTRUM',name: 'PURE SPECTRUM',type: 'spectrum',       note: '1:1 Frequency Map' },
];

const PALETTES = [
  { id: 'NEON', name: 'NEON', range: [160, 320], note: 'Cyan / Magenta' },
  { id: 'INFERNO', name: 'INFERNO', range: [0, 60], note: 'Red / Gold' },
  { id: 'VENOM', name: 'VENOM', range: [80, 160], note: 'Toxic Green' },
  { id: 'SPECTRA', name: 'SPECTRA', range: [0, 360], note: 'Full Spectrum' },
  { id: 'ICE', name: 'ICE', range: [180, 240], note: 'Deep Blue' },
  { id: 'MONO', name: 'MONOCHROME', range: [0, 0], note: 'Black & White' }, 
];

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // UI State
  const [activeModeIndex, setActiveModeIndex] = useState(1);
  const [activePaletteIndex, setActivePaletteIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  
  // Data Drive State
  const [driveMode, setDriveMode] = useState<'ALGO' | 'DATA'>('ALGO');
  
  // Audio State UI
  const [audioSourceType, setAudioSourceType] = useState<'GEN' | 'MIC' | 'FILE'>('GEN');
  const [isAudioRunning, setIsAudioRunning] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string>('');

  // Audio System Refs (Solves Closure & Async Issues)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const audioDataRef = useRef<Uint8Array>(new Uint8Array(0));

  // Parameters
  const [speed, setSpeed] = useState(40);           
  const [amplitude, setAmplitude] = useState(50);   
  const [noiseScale, setNoiseScale] = useState(30); 
  const [density, setDensity] = useState(50);       
  const [rotationSpeed, setRotationSpeed] = useState(10); 

  const paramsRef = useRef({
    modeIndex: 1,
    paletteIndex: 0,
    speed: 0.4,
    amplitude: 0.5,
    noiseScale: 0.3,
    density: 0.5,
    rotationSpeed: 0.1,
    audioSourceType: 'GEN' as 'GEN' | 'MIC' | 'FILE',
    driveMode: 'ALGO' as 'ALGO' | 'DATA',
  });

  // Sync state
  useEffect(() => {
    paramsRef.current.modeIndex = activeModeIndex;
    paramsRef.current.paletteIndex = activePaletteIndex;
    paramsRef.current.speed = speed / 100;
    paramsRef.current.amplitude = amplitude / 100;
    paramsRef.current.noiseScale = noiseScale / 100;
    paramsRef.current.density = density / 100;
    paramsRef.current.rotationSpeed = (rotationSpeed - 50) / 50; 
    paramsRef.current.audioSourceType = audioSourceType;
    paramsRef.current.driveMode = driveMode;
  }, [activeModeIndex, activePaletteIndex, speed, amplitude, noiseScale, density, rotationSpeed, audioSourceType, driveMode]);

  // --- Audio System Logic ---
  const initAudio = () => {
    if (audioCtxRef.current) return { ctx: audioCtxRef.current, analyser: analyserRef.current };
    
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ana = ctx.createAnalyser();
    ana.fftSize = 2048; 
    ana.smoothingTimeConstant = 0.8; // Slightly faster response for RAW DATA mode
    
    // Set Refs immediately
    audioCtxRef.current = ctx;
    analyserRef.current = ana;
    audioDataRef.current = new Uint8Array(ana.frequencyBinCount);
    
    return { ctx, analyser: ana };
  };

  const cleanupSource = () => {
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  };

  const startMic = async () => {
    try {
      const { ctx, analyser } = initAudio();
      if (!ctx || !analyser) return;
      await ctx.resume();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      cleanupSource();

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      setAudioSourceType('MIC');
      setIsAudioRunning(true);
      // Auto switch to DATA drive for better effect when MIC starts
      if (driveMode === 'ALGO') setDriveMode('DATA'); 
    } catch (e) {
      console.error("Mic Error:", e);
      alert("Microphone access denied or error.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { ctx, analyser } = initAudio();
    if (!ctx || !analyser) return;
    await ctx.resume();

    setCurrentFileName(file.name);
    
    const fileUrl = URL.createObjectURL(file);
    const audioEl = new Audio(fileUrl);
    audioEl.loop = true;
    audioEl.play();
    
    cleanupSource();
    const source = ctx.createMediaElementSource(audioEl);
    source.connect(analyser);
    source.connect(ctx.destination); 
    sourceRef.current = source;
    
    setAudioSourceType('FILE');
    setIsAudioRunning(true);
    // Auto switch to DATA drive
    if (driveMode === 'ALGO') setDriveMode('DATA');
  };

  const switchToGen = () => {
    setAudioSourceType('GEN');
    setIsAudioRunning(false);
  };

  // Keyboard Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setActiveModeIndex(prev => (prev + 1) % MODES.length);
      if (e.key.toLowerCase() === 'c') setActivePaletteIndex(prev => (prev + 1) % PALETTES.length);
      if (e.key.toLowerCase() === 'h') setShowControls(prev => !prev);
      if (e.key.toLowerCase() === 'd') setDriveMode(prev => prev === 'ALGO' ? 'DATA' : 'ALGO');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Animation Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let frame = 0;
    let currentRotation = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      frame++;
      
      const params = paramsRef.current;
      const currentMode = MODES[params.modeIndex];
      const currentPalette = PALETTES[params.paletteIndex];
      const w = canvas.width;
      const h = canvas.height;

      // 1. Audio Data Acquisition
      let audioBass = 0; 
      let audioMid = 0;  
      let audioHigh = 0; 
      
      const analyser = analyserRef.current;
      const hasAudio = params.audioSourceType !== 'GEN' && analyser;
      
      if (hasAudio) {
          const data = audioDataRef.current;
          analyser.getByteFrequencyData(data);
          
          const getAvg = (start: number, end: number) => {
             let sum = 0;
             for(let i=start; i<end; i++) sum += data[i];
             return sum / (end - start) / 255;
          };
          
          audioBass = getAvg(2, 20); // Deep bass
          audioMid = getAvg(20, 150); // Mids
          audioHigh = getAvg(150, 600); // Highs
      } else {
          const t = frame * 0.02 * (params.speed * 2.0 + 0.1);
          audioBass = (Math.sin(t * 2) * 0.5 + 0.5) * 0.3; 
          audioMid = (Math.cos(t * 3) * 0.5 + 0.5) * 0.2;
          audioHigh = (noise(frame * 0.05, 0) * 0.5 + 0.5) * 0.1; 
      }

      // 2. Global Time
      let timeMult = 1.0;
      if (currentMode.type === 'tunnel') timeMult = 0.4;
      if (currentMode.type === 'rain') timeMult = 1.2;
      
      const time = frame * 0.02 * (params.speed * 2.0 + 0.1) * timeMult;
      
      // Dynamic Amplitude (Global Scale)
      let beat = 0;
      if (params.audioSourceType === 'GEN') {
         beat = Math.pow((Math.sin(time * 3) + 1) / 2, 4) * params.amplitude; 
      } else {
         const bassClean = Math.max(0, audioBass - 0.15) * 1.2;
         beat = bassClean * (params.amplitude * 3.5); 
      }

      // Clear
      ctx.globalCompositeOperation = 'source-over';
      const fade = currentMode.type === 'point' ? 0.2 : 0.12; 
      ctx.fillStyle = `rgba(0, 0, 0, ${fade})`; 
      ctx.fillRect(0, 0, w, h);

      // Setup Drawing
      ctx.globalCompositeOperation = 'lighter';
      ctx.save();
      ctx.translate(w * 0.5, h * 0.5);
      
      // --- ROTATION ---
      const userRotSpeed = params.rotationSpeed * 0.05; 
      const audioKick = params.audioSourceType === 'GEN' ? 0 : (audioBass * 0.05);
      currentRotation += (userRotSpeed + audioKick);
      
      ctx.rotate(currentRotation); 

      // Ray Count Logic - UPDATED LOWER BOUND TO 6
      let rayCount = 36;
      const dFactor = params.density; 
      
      if (currentMode.type.includes('radial') || currentMode.type === 'stepped_radial') {
        rayCount = Math.floor(mapRange(dFactor, 0, 1, 6, 72));
      } else if (currentMode.type === 'point') {
        rayCount = Math.floor(mapRange(dFactor, 0, 1, 12, 150));
      } else if (currentMode.type === 'spiral') {
        rayCount = Math.floor(mapRange(dFactor, 0, 1, 6, 120));
      } else if (currentMode.type === 'rain') {
        rayCount = Math.floor(mapRange(dFactor, 0, 1, 8, 80));
      } else if (currentMode.type === 'wave') {
        rayCount = Math.floor(mapRange(dFactor, 0, 1, 5, 60));
      } else if (currentMode.type === 'tunnel') {
        rayCount = Math.floor(mapRange(dFactor, 0, 1, 6, 48));
      } else if (currentMode.type === 'spectrum') {
        rayCount = Math.floor(mapRange(dFactor, 0, 1, 32, 180));
      }

      for (let i = 0; i < rayCount; i++) {
        ctx.save();
        const iNorm = i / rayCount; 
        
        let baseX = 0, baseY = 0, angle = 0, lineLength = 350;
        let startD = 0;

        // Geometry Setup
        if (currentMode.type === 'noise_radial' || 
            currentMode.type === 'stepped_radial' || 
            currentMode.type === 'ring_radial' ||
            currentMode.type === 'point' ||
            currentMode.type === 'spectrum') {
           angle = iNorm * Math.PI * 2;
           baseY = -50 - (beat * 15); 
           lineLength = 320;
        }
        else if (currentMode.type === 'spiral') {
           const arm = i % 2; 
           const twist = 4;
           angle = (iNorm * Math.PI * twist) + (arm * Math.PI) + (time * 0.1);
           const r = iNorm * 300 + 40 + (beat * 20);
           baseX = Math.cos(angle) * r;
           baseY = Math.sin(angle) * r;
           lineLength = 100;
           angle += Math.PI / 2;
        }
        else if (currentMode.type === 'rain') {
           const spread = w * 0.8;
           const xPos = mapRange(iNorm, 0, 1, -spread/2, spread/2);
           ctx.translate(xPos, -h * 0.6);
           angle = Math.PI; 
           lineLength = h * 1.2;
        }
        else if (currentMode.type === 'wave') {
           angle = Math.PI / 2;
           const spread = h * 0.8;
           baseX = mapRange(iNorm, 0, 1, -spread/2, spread/2);
           baseY = w * 0.6; // offscreen
           lineLength = w * 1.2;
        }
        else if (currentMode.type === 'tunnel') {
           angle = iNorm * Math.PI * 2 + time * 0.2;
           baseY = -40;
           lineLength = 500;
        }

        ctx.rotate(angle);

        // --- Color Logic ---
        let hueBase = 0;
        if (currentPalette.id === 'MONO') {
             ctx.strokeStyle = `rgba(255,255,255, ${0.4 + params.amplitude * 0.4})`;
             ctx.fillStyle = `rgba(255,255,255, 0.8)`;
        } else {
             hueBase = mapRange(iNorm, 0, 1, currentPalette.range[0], currentPalette.range[1]);
             if (currentMode.type === 'spiral') hueBase += (i % 2) * 60; 
             
             let colorBeat = params.audioSourceType === 'GEN' ? beat * 30 : audioBass * 100;
             let hue = (hueBase + frame * 0.5 + colorBeat) % 360;
             
             let sat = 80;
             let light = 60;

             // Only calculate noise solo logic if using ALGO drive to save perf, 
             // or keep it for DATA drive for color variance? Let's keep it.
             const isSolo = noise(i * 10, time * 0.5) > 0.6;
             if (isSolo) { sat = 100; light = 80; }
             
             if (params.audioSourceType !== 'GEN') {
                 light += audioHigh * 40; 
                 sat -= audioBass * 10;
             }
             
             ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
             ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
             
             if (currentMode.type === 'stepped_radial' || currentMode.type === 'spectrum') {
                 ctx.lineWidth = isSolo ? 2.5 : 1.5;
             } else {
                 ctx.lineWidth = isSolo ? 2.5 : 1;
             }
        }
        
        if (currentMode.type === 'wave') {
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1.5;
        }

        // --- Drawing Loop ---
        if (currentMode.type !== 'point') ctx.beginPath();

        let step = 3; 
        if (currentMode.type === 'stepped_radial') step = 2; 
        if (currentMode.type === 'rain') step = 4;
        if (currentMode.type === 'point') step = 8;
        if (currentMode.type === 'noise_radial') step = 3; 
        if (currentMode.type === 'spectrum') step = 2;
        // DATA drive needs finer steps to look like spectrum
        if (params.driveMode === 'DATA') step = 2;

        // PURE SPECTRUM MODE SCALAR (Global for the whole ray)
        let spectrumScalar = 0;
        if (currentMode.type === 'spectrum') {
            if (hasAudio) {
                const halfRays = Math.floor(rayCount / 2);
                const maxBin = 120; 
                let binIndex = i <= halfRays 
                    ? Math.floor(mapRange(i, 0, halfRays, 0, maxBin))
                    : Math.floor(mapRange(i, halfRays, rayCount, maxBin, 0));
                
                spectrumScalar = (audioDataRef.current[binIndex] || 0) / 255.0; 
            } else {
                // Gen sim
                const halfRays = rayCount / 2;
                const normalizedI = i <= halfRays ? i / halfRays : (rayCount - i) / halfRays;
                spectrumScalar = (Math.sin(normalizedI * 10 + time * 2) * 0.5 + 0.5) * (Math.sin(time) * 0.3 + 0.7);
            }
        }

        for (let d = startD; d <= lineLength; d += step) {
           let lx = baseX;
           let ly = baseY - d; 

           // Envelope
           let power = 0;
           if (currentMode.type === 'stepped_radial' || currentMode.type === 'spectrum') {
               const mid = lineLength / 2;
               const distFromMid = Math.abs(d - mid);
               const plateauSize = lineLength * 0.2; 
               if (distFromMid < plateauSize) power = 1;
               else power = Math.max(0, 1 - ((distFromMid - plateauSize) / (mid - plateauSize)));
           } else {
               const mid = lineLength / 2;
               power = Math.max(0, 1 - (Math.abs(d - mid) / (mid * 0.9))); 
           }
           power *= (params.amplitude * 50);

           let displacement = 0;
           let rawDisplace = 0;

           // ============================================
           //  CORE LOGIC: ALGORITHM vs RAW DATA
           // ============================================

           if (params.driveMode === 'DATA') {
               // --- RAW DATA DRIVER ---
               // Map current distance 'd' to Frequency Bin
               // Focus on Low-Mid frequencies (0-200) for visual impact
               const freqLimit = 160; 
               const binIndex = Math.floor(mapRange(d, startD, lineLength, 0, freqLimit));
               
               let signal = 0;
               if (hasAudio) {
                   signal = audioDataRef.current[binIndex] / 255.0; // 0.0 to 1.0
               } else {
                   // Synthetic Spectrum for Generative Data Mode
                   // Make it look like a clean wave
                   const freq = mapRange(binIndex, 0, freqLimit, 0.1, 1.0);
                   signal = (Math.sin(d * 0.1 - time * 5) * 0.5 + 0.5) * (Math.sin(d * 0.05 + time) * 0.5 + 0.5);
               }
               
               // Map signal 0..1 to displacement -1..1 or 0..1 depending on look
               // We want a "spectrum" look, so usually positive 0..1
               rawDisplace = signal * 2.0 - 0.5; 
               
           } else {
               // --- ALGORITHM DRIVER (Perlin) ---
               const nScale = mapRange(params.noiseScale, 0, 1, 0.002, 0.05);
               let sampleY = ly;
               if (currentMode.type === 'stepped_radial' || currentMode.type === 'rain' || currentMode.type === 'spectrum') {
                   sampleY = Math.floor(ly / 15) * 15; 
               }
               
               let nVal = 0;
               if (currentMode.type === 'wave') nVal = noise(d * nScale + time, i * 0.2);
               else nVal = noise(i * 10, sampleY * nScale + time);
               
               rawDisplace = mapRange(nVal, 0, 1, -1, 1);
               
               // Apply Audio Mod to Algo
               let audioMod = params.audioSourceType !== 'GEN' ? (1.0 + audioMid * 3.0) : 1.0;
               rawDisplace *= audioMod;
           }

           // --- Mode Specific Shape Modifiers (Applied to both Data and Algo) ---
           if (currentMode.type === 'ring_radial') {
               const ringEffect = Math.sin(d * 0.05 - time * 3); 
               rawDisplace *= ringEffect * 1.5;
           }
           else if (currentMode.type === 'spiral') {
               rawDisplace += Math.sin(d * 0.05) * 0.5;
           }
           else if (currentMode.type === 'wave') {
               rawDisplace += Math.sin(d * 0.02 + time * 2 + i) * 1.5;
           }
           else if (currentMode.type === 'noise_radial' && params.driveMode === 'ALGO') {
               // Add extra jitter only in Algo mode, Data mode should be clean
               let jitter = (Math.random() - 0.5) * 0.5;
               if (params.audioSourceType !== 'GEN') jitter *= (audioHigh * 15);
               else jitter *= 0.5; 
               rawDisplace += jitter;
           }
           
           // PURE SPECTRUM Scalar Application
           if (currentMode.type === 'spectrum') {
               if (spectrumScalar > 0.05) rawDisplace *= (spectrumScalar * 8.0); 
               else rawDisplace *= 0.1;
           }

           displacement = rawDisplace * power;
           lx += displacement;

           // --- Rendering ---
           if (currentMode.type === 'point') {
               if (Math.random() > 0.6) { 
                  // If Data mode, make points very dense on high signals
                  const threshold = params.driveMode === 'DATA' ? 0.3 : 0.6;
                  if (Math.random() > threshold) {
                      const audioSizeBoost = params.audioSourceType !== 'GEN' ? audioHigh * 8 : 0;
                      const size = Math.abs(displacement) * 0.08 + audioSizeBoost;
                      if (size > 0.5) {
                        ctx.beginPath();
                        ctx.arc(lx, ly, size, 0, Math.PI * 2);
                        ctx.fill();
                      }
                  }
               }
           } else {
               if (d === startD) ctx.moveTo(lx, ly);
               else ctx.lineTo(lx, ly);
           }
        }
        
        if (currentMode.type !== 'point') ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="audio/*"
        onChange={handleFileUpload}
      />

      {/* --- HUD / CONTROLS --- */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: showControls ? '340px' : '0px',
        transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        background: 'rgba(10, 10, 10, 0.85)',
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        padding: showControls ? '30px' : '0',
        boxSizing: 'border-box',
        overflowY: 'auto',
        color: '#eee',
        fontFamily: '"Courier New", monospace',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.6)',
        zIndex: 10
      }}>
        {showControls && (
          <>
            <div style={{ borderBottom: '1px solid #333', paddingBottom: '20px', marginBottom: '30px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', letterSpacing: '3px', color: '#fff', fontWeight: 300 }}>NEON CORE v6.4</h2>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '6px', letterSpacing: '1px' }}>DATA DRIVEN GEOMETRY</div>
            </div>
            
            {/* Audio Source Controls */}
            <Label text="AUDIO SOURCE" />
            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
               <ModeButton active={audioSourceType === 'GEN'} onClick={switchToGen}>GENERATIVE</ModeButton>
               <ModeButton active={audioSourceType === 'MIC'} onClick={startMic}>MICROPHONE</ModeButton>
               <ModeButton active={audioSourceType === 'FILE'} onClick={() => fileInputRef.current?.click()}>UPLOAD FILE</ModeButton>
            </div>
            {audioSourceType === 'FILE' && currentFileName && (
               <div style={{ fontSize: '10px', color: '#0f0', marginBottom: '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  PLAYING: {currentFileName}
               </div>
            )}
            {audioSourceType === 'MIC' && isAudioRunning && (
               <div style={{ fontSize: '10px', color: '#f00', marginBottom: '20px' }}>
                  ● LIVE INPUT ACTIVE
               </div>
            )}

            {/* NEW: VISUAL DRIVE MODE */}
            <div style={{ marginBottom: '20px' }}>
                <Label text="VISUAL DRIVE" />
                <div style={{ display: 'flex', gap: '5px' }}>
                    <ModeButton active={driveMode === 'ALGO'} onClick={() => setDriveMode('ALGO')}>ALGORITHM</ModeButton>
                    <ModeButton active={driveMode === 'DATA'} onClick={() => setDriveMode('DATA')}>RAW SPECTRA</ModeButton>
                </div>
                <div style={{ fontSize: '9px', color: '#777', marginTop: '5px' }}>
                    {driveMode === 'ALGO' ? '// MATH + NOISE DRIVEN' : '// REAL-TIME FREQUENCY MAPPING'}
                </div>
            </div>

            {/* Mode Grid */}
            <Label text="VISUAL ALGORITHM" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '30px' }}>
              {MODES.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => setActiveModeIndex(idx)}
                  style={{
                    background: activeModeIndex === idx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.03)',
                    border: 'none',
                    color: activeModeIndex === idx ? '#000' : '#777',
                    padding: '12px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: activeModeIndex === idx ? 'bold' : 'normal',
                    borderRadius: '2px',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>

            {/* Sliders */}
            <Label text="PARAMETERS" />
            <Slider label="AMPLITUDE" value={amplitude} onChange={setAmplitude} />
            <Slider label="NOISE SCALE" value={noiseScale} onChange={setNoiseScale} />
            <Slider label="DENSITY" value={density} onChange={setDensity} />
            <Slider label="FLOW SPEED" value={speed} onChange={setSpeed} />
            
            <div style={{ height: '1px', background: '#333', margin: '20px 0' }} />
            
            <Slider label="ROTATION" value={rotationSpeed} onChange={setRotationSpeed} min={0} max={100} />

            {/* Palette */}
            <Label text="COLOR PALETTE" />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {PALETTES.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => setActivePaletteIndex(idx)}
                  style={{
                    flex: '1 0 30%',
                    background: activePaletteIndex === idx ? `hsl(${p.range[0]}, 60%, 40%)` : 'rgba(255,255,255,0.05)',
                    border: activePaletteIndex === idx ? '1px solid #fff' : '1px solid #333',
                    color: '#fff',
                    padding: '10px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontFamily: 'inherit'
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            
            <div style={{ marginTop: 'auto', paddingTop: '30px', fontSize: '10px', color: '#555', textAlign: 'center', lineHeight: '1.6' }}>
              [SPACE] MODE  •  [C] COLOR  •  [H] HIDE<br/>
              [D] TOGGLE DATA DRIVE
            </div>
          </>
        )}
      </div>

      {/* Floating Menu Button */}
      {!showControls && (
        <button 
          onClick={() => setShowControls(true)}
          style={{
            position: 'absolute', top: 30, right: 30,
            background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', padding: '10px 20px', cursor: 'pointer',
            fontFamily: '"Courier New", monospace', fontSize: '12px',
            backdropFilter: 'blur(5px)', letterSpacing: '2px'
          }}
        >
          CONTROLS
        </button>
      )}

      {/* Title Overlay */}
      <div style={{ position: 'absolute', top: 40, left: 40, pointerEvents: 'none', mixBlendMode: 'difference', zIndex: 5 }}>
         <h1 style={{ color: 'white', margin: 0, fontSize: '42px', letterSpacing: '6px', fontWeight: '200' }}>
           {MODES[activeModeIndex].name}
         </h1>
         <p style={{ color: 'rgba(255,255,255,0.6)', margin: '10px 0 0 0', fontSize: '14px', letterSpacing: '2px' }}>
           // {MODES[activeModeIndex].note}
         </p>
      </div>
    </div>
  );
};

const ModeButton = ({ active, onClick, children }: { active: boolean, onClick: () => void | Promise<void>, children?: React.ReactNode }) => (
    <button
        onClick={() => onClick()}
        style={{
            flex: 1,
            background: active ? '#fff' : '#222',
            color: active ? '#000' : '#888',
            border: 'none',
            padding: '8px 4px',
            fontSize: '9px',
            cursor: 'pointer',
            fontWeight: 'bold',
            borderRadius: '2px'
        }}
    >
        {children}
    </button>
);

const Label = ({ text }: { text: string }) => (
  <div style={{ fontSize: '10px', color: '#555', marginBottom: '12px', letterSpacing: '2px', fontWeight: 'bold' }}>{text}</div>
);

const Slider = ({ label, value, onChange, min=0, max=100 }: { label: string, value: number, onChange: (v: number) => void, min?: number, max?: number }) => (
  <div style={{ marginBottom: '25px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
      <span style={{ fontSize: '11px', color: '#aaa', letterSpacing: '1px' }}>{label}</span>
      <span style={{ fontSize: '11px', color: '#fff', fontFamily: 'monospace' }}>{value}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      value={value} 
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ 
        width: '100%', 
        accentColor: '#fff', 
        cursor: 'pointer', 
        background: 'transparent',
        height: '2px',
        appearance: 'none',
      }}
      className="custom-range"
    />
    <style>{`
      .custom-range::-webkit-slider-runnable-track { background: #333; height: 1px; }
      .custom-range::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; background: #fff; border-radius: 50%; margin-top: -5px; transition: transform 0.1s; }
      .custom-range::-webkit-slider-thumb:hover { transform: scale(1.5); }
    `}</style>
  </div>
);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);