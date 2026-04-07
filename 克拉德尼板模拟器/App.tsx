import React, { useState, useEffect, useRef, useCallback } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import ControlPanel from './components/ControlPanel';
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

// Audio constants
const FFT_SIZE = 2048;

type AudioMode = 'MANUAL' | 'SYNTH' | 'MIC' | 'REC' | 'HAND';

const App: React.FC = () => {
  // --- Simulation State ---
  const [m, setM] = useState<number>(3);
  const [n, setN] = useState<number>(7);
  const [speed, setSpeed] = useState<number>(0.8);
  const [particleCount, setParticleCount] = useState<number>(15000);
  const [isPlaying, setIsPlaying] = useState<boolean>(false); // Main simulation loop
  const [resetKey, setResetKey] = useState(0);
  
  // --- Audio State ---
  const [audioMode, setAudioMode] = useState<AudioMode>('MANUAL');
  const [volumeLevel, setVolumeLevel] = useState<number>(0); // For visualization
  
  // --- Recorder State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);

  // --- Hand Tracker State ---
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  
  // --- Refs ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number>();
  
  // Webcam & Hand Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLoopRef = useRef<number>();
  const isWebcamRunning = useRef<boolean>(false); // Use Ref for loop stability

  const handleReset = () => {
    setResetKey(prev => prev + 1);
  };

  // Initialize Audio Context
  const initAudio = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // --- ANALYSIS ENGINE (Shared by Mic, Rec, Hand) ---
  const startAnalysisLoop = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const update = () => {
      if (!analyserRef.current) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const timeArray = new Uint8Array(bufferLength);

      analyserRef.current.getByteFrequencyData(dataArray);
      analyserRef.current.getByteTimeDomainData(timeArray);

      // 1. Calculate Volume (RMS) -> Controls Speed
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (timeArray[i] - 128) / 128.0;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const amplifiedVolume = Math.min(rms * 5, 1.0); // Amplify for better UX
      setVolumeLevel(amplifiedVolume);
      
      // Map Volume to Simulation Speed
      // In HAND mode, the user controls volume directly, but this loop reflects what is heard.
      const dynamicSpeed = amplifiedVolume > 0.05 ? amplifiedVolume * 2.5 : 0;
      setSpeed(dynamicSpeed);

      // 2. Calculate Dominant Pitch -> Controls M and N
      let maxVal = 0;
      let maxIndex = 0;
      for (let i = 3; i < 150; i++) { 
        if (dataArray[i] > maxVal) {
          maxVal = dataArray[i];
          maxIndex = i;
        }
      }

      // Threshold to prevent random noise pattern changes
      if (maxVal > 100) { 
        const nyquist = audioCtxRef.current!.sampleRate / 2;
        const frequency = maxIndex * (nyquist / bufferLength);

        // Map Frequency to M/N
        const normalizedFreq = Math.log2(Math.max(frequency, 80) / 80); 
        const targetVal = Math.max(1, Math.min(20, Math.floor(normalizedFreq * 2.5) + 2));
        
        if (targetVal !== m) {
           setM(targetVal);
           // N is harmonically related or slightly offset
           setN(targetVal + (targetVal % 2 === 0 ? 2 : 1));
        }
      }

      animationFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  // --- SYNTH MODE ---
  const updateSynthFrequency = useCallback(() => {
    // Only auto-update if in SYNTH mode (in HAND mode, hand updates it)
    if (audioMode !== 'SYNTH' || !oscillatorRef.current || !audioCtxRef.current) return;
    const complexity = Math.sqrt(m * m + n * n);
    const targetFreq = 100 + (complexity * 40); 
    oscillatorRef.current.frequency.setTargetAtTime(targetFreq, audioCtxRef.current.currentTime, 0.1);
  }, [audioMode, m, n]);

  const startSynth = async () => {
    await initAudio();
    stopAudioSource();

    const ctx = audioCtxRef.current!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 440; 
    gain.gain.value = 0.15; 
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    oscillatorRef.current = osc;
    gainNodeRef.current = gain;
    updateSynthFrequency();
  };

  // --- MIC MODE ---
  const startMic = async () => {
    await initAudio();
    stopAudioSource();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      
      const ctx = audioCtxRef.current!;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      analyserRef.current = analyser;

      startAnalysisLoop();
    } catch (err) {
      console.error("Mic Error:", err);
      alert("Microphone access denied.");
      setAudioMode('MANUAL');
    }
  };

  // --- RECORDING & PLAYBACK LOGIC ---
  const startRecording = async () => {
    await initAudio();
    stopAudioSource();
    setRecordedBuffer(null);
    setIsPlayingRecording(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        if (audioCtxRef.current) {
          const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
          setRecordedBuffer(audioBuffer);
          if (isPlaying) playRecordingBuffer(audioBuffer);
        }
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  const playRecordingBuffer = async (buffer: AudioBuffer | null) => {
    const targetBuffer = buffer || recordedBuffer;
    if (!targetBuffer || !audioCtxRef.current) return;
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
    }
    const ctx = audioCtxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = targetBuffer;
    source.loop = true;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    source.start();
    sourceNodeRef.current = source;
    analyserRef.current = analyser;
    setIsPlayingRecording(true);
    startAnalysisLoop();
  };

  const pauseRecordingPlayback = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsPlayingRecording(false);
    setSpeed(0);
  };

  // --- HAND TRACKING MODE ---
  
  // 1. Initialize MediaPipe
  useEffect(() => {
    const loadHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2 // Enable 2 hands
        });
        setHandLandmarker(landmarker);
      } catch (err) {
        console.error("Failed to load MediaPipe HandLandmarker", err);
      }
    };
    loadHandLandmarker();
  }, []);

  const startHandMode = async () => {
    await initAudio();
    stopAudioSource();
    
    // Setup Audio Chain: Oscillator (controlled by hand) -> Analyser -> Speaker
    const ctx = audioCtxRef.current!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.5;

    osc.type = 'sine';
    osc.frequency.value = 440; // Start freq
    gain.gain.value = 0; // Start silent, hand will raise volume

    osc.connect(gain);
    gain.connect(analyser); // Connect to analyser so we can derive visuals from it
    analyser.connect(ctx.destination); // Connect to output so we hear it
    
    osc.start();
    oscillatorRef.current = osc;
    gainNodeRef.current = gain;
    analyserRef.current = analyser;

    // Start Visual Analysis Loop (reads from Analyser)
    startAnalysisLoop();

    // Setup Camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      isWebcamRunning.current = true;
      // Start the detection loop immediately
      predictWebcam();
    } catch (err) {
      console.error("Camera access denied", err);
      setAudioMode('MANUAL');
    }
  };

  const drawHandSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[]) => {
    ctx.lineWidth = 3; // Thicker lines
    ctx.strokeStyle = "#22d3ee"; // Cyan
    ctx.fillStyle = "#a5f3fc"; // Light Cyan

    // Connections
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
    ];

    // Draw lines
    for (const [start, end] of connections) {
      const p1 = landmarks[start];
      const p2 = landmarks[end];
      ctx.beginPath();
      ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
      ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
      ctx.stroke();
    }

    // Draw points
    for (const p of landmarks) {
      ctx.beginPath();
      ctx.arc(p.x * ctx.canvas.width, p.y * ctx.canvas.height, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  const predictWebcam = () => {
    // If stopped, kill the loop
    if (!isWebcamRunning.current) return;

    // Check availability
    if (handLandmarker && videoRef.current && videoRef.current.readyState >= 2) {
        
        // Ensure canvas matches video size
        if (canvasRef.current && (canvasRef.current.width !== videoRef.current.videoWidth)) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
        }

        const nowInMs = performance.now();
        const results = handLandmarker.detectForVideo(videoRef.current, nowInMs);

        // Clear canvas once per frame
        if (canvasRef.current) {
             const ctx = canvasRef.current.getContext('2d');
             if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarksList = results.landmarks;

            // Draw all hands
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    for (const handLandmarks of landmarksList) {
                        drawHandSkeleton(ctx, handLandmarks);
                    }
                }
            }

            // --- THEREMIN CONTROL LOGIC ---
            
            // Sensitivity Helper: Maps central 20-80% of screen to 0-100% output
            // This makes it easier to reach min/max without touching edges
            const mapSensitivity = (val: number) => {
                const min = 0.2;
                const max = 0.8;
                const mapped = (val - min) / (max - min);
                return Math.max(0, Math.min(1, mapped));
            };

            let freqFactor = 0; // 0..1 (Low..High)
            let volFactor = 0; // 0..1 (Quiet..Loud)

            if (landmarksList.length === 1) {
                // SINGLE HAND MODE:
                // X (Horizontal) = Frequency
                // Y (Vertical) = Volume
                const tip = landmarksList[0][8]; // Index finger tip
                
                // 1.0 - x because camera is mirrored (User moves Right -> x decreases -> want freq increase)
                freqFactor = mapSensitivity(1.0 - tip.x); 
                volFactor = mapSensitivity(1.0 - tip.y);  
            } else if (landmarksList.length >= 2) {
                // DUAL HAND MODE:
                const hands = [...landmarksList].sort((a, b) => a[0].x - b[0].x);
                // hands[0]: Left on screen (User's Right Hand) -> PITCH
                // hands[1]: Right on screen (User's Left Hand) -> VOLUME
                
                const pitchHand = hands[0][8]; // Tip
                const volHand = hands[1][8];   // Tip

                // Use Vertical (Y) for both in dual mode
                freqFactor = mapSensitivity(1.0 - pitchHand.y); 
                volFactor = mapSensitivity(1.0 - volHand.y);
            }

            // Map Factors to Audio Params
            // Frequency: Exponential mapping from 100Hz to 12000Hz (Extended range)
            const minFreq = 100;
            const maxFreq = 12000;
            const frequency = minFreq * Math.pow(maxFreq / minFreq, freqFactor);

            // Volume: Linear but scaled by sensitivity
            const gain = Math.max(0, Math.min(1, volFactor));

            if (oscillatorRef.current && audioCtxRef.current) {
                // Use a fast ramp for responsiveness
                oscillatorRef.current.frequency.setTargetAtTime(frequency, audioCtxRef.current.currentTime, 0.05);
            }
            if (gainNodeRef.current && audioCtxRef.current) {
                gainNodeRef.current.gain.setTargetAtTime(gain, audioCtxRef.current.currentTime, 0.05);
            }
        } else {
            // No hand detected: Fade out
            if (gainNodeRef.current && audioCtxRef.current) {
                gainNodeRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.2);
            }
        }
    }

    // Keep loop running
    handLoopRef.current = requestAnimationFrame(predictWebcam);
  };

  // --- CLEANUP ---
  const stopAudioSource = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
      setIsPlayingRecording(false);
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (handLoopRef.current) cancelAnimationFrame(handLoopRef.current);
    
    // Stop camera if running
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    isWebcamRunning.current = false;
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (!isPlaying) {
      stopAudioSource();
      return;
    }

    if (audioMode === 'SYNTH') {
      startSynth();
    } else if (audioMode === 'MIC') {
      startMic();
    } else if (audioMode === 'REC') {
      if (recordedBuffer && !isRecording) playRecordingBuffer(recordedBuffer);
    } else if (audioMode === 'HAND') {
      if (handLandmarker) {
         startHandMode();
      } else {
         console.log("Hand model not ready yet...");
         // If user switches too fast, they might need to re-toggle. 
         // But in most cases model loads before user clicks start.
      }
    } else {
      stopAudioSource();
      setSpeed(0.8);
    }

    return () => stopAudioSource();
  }, [audioMode, isPlaying, handLandmarker]); 

  // Update Synth logic for non-Hand modes
  useEffect(() => {
    updateSynthFrequency();
  }, [m, n, updateSynthFrequency]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-black overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0 h-[45vh] md:h-full overflow-hidden z-20">
        <ControlPanel 
          m={m} 
          setM={setM} 
          n={n} 
          setN={setN}
          speed={speed}
          setSpeed={setSpeed}
          particleCount={particleCount}
          setParticleCount={setParticleCount}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          reset={handleReset}
          audioMode={audioMode}
          setAudioMode={setAudioMode}
          volumeLevel={volumeLevel}
          isRecording={isRecording}
          startRecording={startRecording}
          stopRecording={stopRecording}
          hasRecording={!!recordedBuffer}
          playRecording={() => playRecordingBuffer(null)}
          pauseRecording={pauseRecordingPlayback}
          isPlayingRecording={isPlayingRecording}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex flex-col h-[55vh] md:h-full bg-neutral-950">
        
        {/* Webcam Overlay for Hand Mode */}
        {audioMode === 'HAND' && isPlaying && (
          <div className="absolute bottom-4 right-4 z-30 w-32 h-24 sm:w-48 sm:h-36 bg-black rounded-lg border border-cyan-500/50 overflow-hidden shadow-2xl">
             <div className="relative w-full h-full transform -scale-x-100">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <canvas 
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover"
                />
             </div>
             
             <div className="absolute top-1 left-2 text-[10px] font-mono text-cyan-400 bg-black/50 px-1 rounded z-10">
                THEREMIN HAND
             </div>
             <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 z-10">
                <div className="w-full h-[1px] bg-cyan-400 absolute top-1/2"></div>
                <div className="h-full w-[1px] bg-cyan-400 absolute left-1/2"></div>
             </div>
          </div>
        )}

        <div className="hidden md:flex absolute top-0 left-0 w-full p-6 justify-between items-start pointer-events-none z-10">
          <div className="bg-neutral-900/80 backdrop-blur border border-neutral-700/50 px-4 py-2 rounded-full text-xs font-mono text-cyan-400 shadow-lg flex items-center gap-2">
             {audioMode === 'REC' && isRecording && <span className="animate-pulse text-red-500">● RECORDING</span>}
             {audioMode === 'REC' && !isRecording && isPlayingRecording && <span>▶ LOOPING</span>}
             {audioMode === 'MIC' && <span>● LIVE AUDIO REACTIVE</span>}
             {audioMode === 'SYNTH' && <span>♫ SYNTHESIZER ACTIVE</span>}
             {audioMode === 'HAND' && <span>✋ GESTURE THEREMIN (1 or 2 Hands)</span>}
             {audioMode === 'MANUAL' && <span>MANUAL SIMULATION</span>}
          </div>
        </div>

        <div className="flex-1 w-full h-full p-4 md:p-8 flex items-center justify-center relative">
          
          {/* Visualizer Ring */}
          {(audioMode === 'MIC' || audioMode === 'HAND' || (audioMode === 'REC' && isPlayingRecording)) && isPlaying && (
            <div 
              className="absolute rounded-full border border-cyan-500/30 transition-all duration-75 ease-out pointer-events-none"
              style={{
                width: `${300 + volumeLevel * 200}px`,
                height: `${300 + volumeLevel * 200}px`,
                opacity: volumeLevel,
                boxShadow: `0 0 ${volumeLevel * 50}px rgba(6,182,212,0.3)`
              }}
            />
          )}

          <SimulationCanvas 
            key={resetKey}
            m={m}
            n={n}
            speed={speed} // Dynamic in Mic/Rec/Hand mode
            particleCount={particleCount}
            isPlaying={isPlaying}
            color={isRecording ? '#f87171' : ((audioMode === 'MIC' || audioMode === 'REC' || audioMode === 'HAND') ? '#67e8f9' : '#bae6fd')}
          />
        </div>
      </div>
    </div>
  );
};

export default App;