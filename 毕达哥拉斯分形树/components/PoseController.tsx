
import React, { useEffect, useRef, useState } from 'react';
import { ScanFace, Scaling } from 'lucide-react';

// Declare globals from the CDN scripts
declare global {
  interface Window {
    Pose: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
  }
}

interface PoseData {
  asymmetry: number;
  angle: number;
  sizeRatio: number;
  hueOffset: number;
  depth: number;
}

interface PoseControllerProps {
  isActive: boolean;
  onUpdate: (data: PoseData) => void;
}

export const PoseController: React.FC<PoseControllerProps> = ({ isActive, onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlMode, setControlMode] = useState<'SIZE' | 'DEPTH'>('SIZE');
  
  // Debug values for visualization
  const [handOpenness, setHandOpenness] = useState({ left: 1, right: 1 });
  
  // Store the pose instance and camera to clean up later
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  // Lerp helper for smoothing values to reduce jitter
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  // Helper to calculate distance
  const getDist = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  // Store current smoothed values
  const currentValues = useRef({
    asymmetry: 0,
    angle: 45,
    sizeRatio: 0.15,
    hueOffset: 0,
    depth: 10
  });

  useEffect(() => {
    if (!isActive) {
      // Cleanup if toggled off
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      return;
    }

    const initMediaPipe = async () => {
      try {
        setIsModelLoading(true);
        setError(null);

        if (!window.Pose || !window.Camera) {
            throw new Error("MediaPipe libraries not loaded");
        }

        const pose = new window.Pose({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          }
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        pose.onResults((results: any) => {
          if (!isActive) return;
          
          // Draw Debug View
          if (canvasRef.current && videoRef.current) {
             const canvasCtx = canvasRef.current.getContext('2d');
             if (canvasCtx) {
                canvasCtx.save();
                canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                
                // Mirror effect for natural interaction
                canvasCtx.translate(canvasRef.current.width, 0);
                canvasCtx.scale(-1, 1);
                
                canvasCtx.drawImage(
                    results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
                
                if (results.poseLandmarks) {
                    window.drawConnectors(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS,
                                   {color: '#00FF00', lineWidth: 2});
                    window.drawLandmarks(canvasCtx, results.poseLandmarks,
                                  {color: '#FF0000', lineWidth: 1, radius: 3});
                }
                canvasCtx.restore();
             }
          }

          // Logic mapping
          if (results.poseLandmarks) {
            const landmarks = results.poseLandmarks;
            
            // Indices: 
            // 0 = Nose
            // 15 = Left Wrist, 16 = Right Wrist
            // 17 = Left Pinky, 18 = Right Pinky
            // 19 = Left Index Tip, 20 = Right Index Tip
            // 13 = Left Elbow, 14 = Right Elbow
            
            const leftWrist = landmarks[15];
            const rightWrist = landmarks[16];
            const leftIndex = landmarks[19];
            const rightIndex = landmarks[20];
            const leftPinky = landmarks[17];
            const rightPinky = landmarks[18];
            const leftElbow = landmarks[13];
            const rightElbow = landmarks[14];
            const nose = landmarks[0];
            
            if (leftWrist && rightWrist && leftIndex && rightIndex && leftElbow && rightElbow && leftPinky && rightPinky) {
                
                // --- GESTURE DETECTION (Fist vs Open) ---
                const leftArmLen = getDist(leftElbow, leftWrist);
                const rightArmLen = getDist(rightElbow, rightWrist);
                
                const leftIndexDist = getDist(leftWrist, leftIndex);
                const leftPinkyDist = getDist(leftWrist, leftPinky);
                const rightIndexDist = getDist(rightWrist, rightIndex);
                const rightPinkyDist = getDist(rightWrist, rightPinky);

                const lRatio = (leftIndexDist + leftPinkyDist) / (leftArmLen * 2);
                const rRatio = (rightIndexDist + rightPinkyDist) / (rightArmLen * 2);

                setHandOpenness({ left: lRatio, right: rRatio });

                const ENTER_FIST_THRESHOLD = 0.6; 
                const EXIT_FIST_THRESHOLD = 0.75; 

                const isLeftFistCurrently = lRatio < ENTER_FIST_THRESHOLD;
                const isRightFistCurrently = rRatio < ENTER_FIST_THRESHOLD;
                
                const isLeftOpenCurrently = lRatio > EXIT_FIST_THRESHOLD;
                const isRightOpenCurrently = rRatio > EXIT_FIST_THRESHOLD;

                setControlMode(prevMode => {
                    if (prevMode === 'SIZE') {
                        if (isLeftFistCurrently && isRightFistCurrently) {
                            return 'DEPTH';
                        }
                    } else {
                        if (isLeftOpenCurrently && isRightOpenCurrently) {
                            return 'SIZE';
                        }
                    }
                    return prevMode;
                });

                // --- COMMON CALCULATIONS ---
                const rawDiff = rightWrist.y - leftWrist.y;
                const targetAsymmetry = Math.max(-0.5, Math.min(0.5, rawDiff * 1.5));

                const avgY = (leftWrist.y + rightWrist.y) / 2;
                let targetAngle = (1 - avgY) * 120; 
                targetAngle = Math.max(0, Math.min(90, targetAngle));

                const handDist = getDist(leftWrist, rightWrist);

                let targetHue = 0;
                if (nose) {
                    targetHue = (0.5 - nose.x) * 200; 
                }

                // --- CONDITIONAL LOGIC ---
                let targetSize = currentValues.current.sizeRatio;
                let targetDepth = currentValues.current.depth;

                // Simple check for math application logic
                const isFistMath = lRatio < 0.65 && rRatio < 0.65; 

                if (isFistMath) {
                    // MODE: FISTS CLOSED -> CONTROL DEPTH
                    let normalizedDist = (handDist - 0.05) / 0.6; 
                    normalizedDist = Math.max(0, Math.min(1, normalizedDist));
                    
                    // UPDATED MAX DEPTH TO 12
                    // Map 0..1 to 1..12
                    targetDepth = 1 + (normalizedDist * 11);
                } else {
                    // MODE: HANDS OPEN -> CONTROL SIZE
                    let normalizedDist = (handDist - 0.1) / 0.7;
                    let sizeVal = 0.05 + (normalizedDist * 0.25);
                    targetSize = Math.max(0.05, Math.min(0.30, sizeVal));
                }

                const smoothFactor = 0.1;
                currentValues.current = {
                    asymmetry: lerp(currentValues.current.asymmetry, targetAsymmetry, smoothFactor),
                    angle: lerp(currentValues.current.angle, targetAngle, smoothFactor),
                    hueOffset: lerp(currentValues.current.hueOffset, targetHue, 0.05),
                    sizeRatio: isFistMath 
                        ? currentValues.current.sizeRatio 
                        : lerp(currentValues.current.sizeRatio, targetSize, smoothFactor),
                    depth: isFistMath
                        ? lerp(currentValues.current.depth, targetDepth, 0.05) 
                        : currentValues.current.depth 
                };
                
                onUpdate(currentValues.current);
            }
          }
          setIsModelLoading(false);
        });

        poseRef.current = pose;

        if (videoRef.current) {
          const camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (poseRef.current) {
                await poseRef.current.send({image: videoRef.current});
              }
            },
            width: 640,
            height: 480
          });
          cameraRef.current = camera;
          await camera.start();
        }

      } catch (err) {
        console.error("Error initializing MediaPipe:", err);
        setError("Camera init failed");
        setIsModelLoading(false);
      }
    };

    initMediaPipe();

    return () => {
        if (cameraRef.current) {
            cameraRef.current.stop();
        }
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="absolute bottom-6 right-6 w-56 h-48 bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden shadow-2xl z-50 transition-all hover:scale-105">
        {/* Loading State */}
        {isModelLoading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900 z-10">
                <ScanFace className="w-8 h-8 animate-pulse mb-2" />
                <span className="text-xs">Loading Pose AI...</span>
            </div>
        )}

        {/* Error State */}
        {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 bg-zinc-900 z-10 p-4 text-center">
                <span className="text-xs">{error}</span>
            </div>
        )}

        {/* Video Feed (Hidden but needed for MP) */}
        <video ref={videoRef} className="hidden" playsInline />
        
        {/* Debug Canvas */}
        <canvas 
            ref={canvasRef} 
            width={320} 
            height={240} 
            className="w-full h-full object-cover opacity-80"
        />
        
        {/* Label */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 to-transparent p-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                <span className="text-[10px] font-mono text-white uppercase font-bold tracking-wider">AI Vision</span>
            </div>
            {/* Mode Indicator */}
            {!isModelLoading && (
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors duration-300 ${
                    controlMode === 'DEPTH' 
                    ? 'bg-purple-500/80 border-purple-400 text-white' 
                    : 'bg-blue-500/80 border-blue-400 text-white'
                }`}>
                    {controlMode === 'DEPTH' ? <ScanFace className="w-3 h-3" /> : <Scaling className="w-3 h-3" />}
                    {controlMode === 'DEPTH' ? 'DEPTH MODE' : 'SIZE MODE'}
                </div>
            )}
        </div>
        
        {/* Instruction Overlay */}
        {!isModelLoading && !error && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 backdrop-blur-sm">
                
                {/* Visual Feedback Bars for Hand State */}
                <div className="flex gap-2 mb-2 px-1">
                    <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex justify-between text-[7px] text-zinc-400">
                            <span>LEFT HAND</span>
                            <span>{handOpenness.left.toFixed(2)}</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-100 ${handOpenness.left < 0.6 ? 'bg-purple-500' : 'bg-blue-400'}`}
                                style={{ width: `${Math.min(100, handOpenness.left * 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex justify-between text-[7px] text-zinc-400">
                            <span>RIGHT HAND</span>
                            <span>{handOpenness.right.toFixed(2)}</span>
                        </div>
                         <div className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-100 ${handOpenness.right < 0.6 ? 'bg-purple-500' : 'bg-blue-400'}`}
                                style={{ width: `${Math.min(100, handOpenness.right * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-1 text-[9px] text-zinc-300 font-mono">
                    <div className="flex justify-between items-center border-b border-zinc-700 pb-1 mb-1">
                        <span className="text-zinc-500">TRIGGER: &lt; 0.60</span>
                        <div className="flex gap-2">
                           <span className={controlMode === 'SIZE' ? 'text-blue-400 font-bold' : 'text-zinc-600'}>OPEN</span>
                           <span className="text-zinc-700">|</span>
                           <span className={controlMode === 'DEPTH' ? 'text-purple-400 font-bold' : 'text-zinc-600'}>FIST</span>
                        </div>
                    </div>
                    <div className="flex justify-between">
                        <span>HAND WIDTH</span>
                        <span className={controlMode === 'DEPTH' ? 'text-purple-400' : 'text-blue-400'}>
                            {controlMode === 'DEPTH' ? 'Tree Layers' : 'Tree Size'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>HAND HEIGHT</span>
                        <span className="text-emerald-400">Angle</span>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
