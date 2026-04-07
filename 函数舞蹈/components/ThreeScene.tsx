import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import type { Version, ChoreographyMode, AudioReactionMode } from '../App';

type MathFunc = (x: number) => number;
type AnimatedMathFunc = (x: number, t: number) => number;
type FuncLibEntry = { func: MathFunc; text: string };
type MorphState = { currentIndex: number; nextIndex: number; progress: number; };

// --- Choreography Engine Types ---
type LineState = { position: THREE.Vector3, scale: THREE.Vector3, rotation: THREE.Euler };
type ChoreographyPhase = {
    duration: number;
    getTargetState: (line: THREE.Line, index: number, totalLines: number, timeInPhase: number) => Partial<LineState>;
};
type ChoreographyScript = ChoreographyPhase[];

const NUM_POINTS = 300;
const X_RANGE = 10;
const TRANSITION_SPEED = 0.4;
const MOUSE_INTERACTION_RADIUS = 2;
const MOUSE_INTERACTION_STRENGTH = 1.5;

const perlin = new ImprovedNoise();

const sincFunc = (x: number) => {
    const val = x * Math.PI;
    if (val === 0) return 1;
    return Math.sin(val) / val;
};

const clampedTan = (x: number) => THREE.MathUtils.clamp(Math.tan(x/2) * 2, -10, 10);
const clampedInverse = (x: number) => THREE.MathUtils.clamp(4/x, -10, 10);

// Helper to safely parse string formulas like "sin(x) * x"
const createFunctionFromString = (formula: string): MathFunc => {
    try {
        const safeFormula = formula.replace(/[^a-zA-Z0-9+\-*/().,\s%]/g, '');
        // eslint-disable-next-line no-new-func
        return new Function('x', `with(Math) { try { return ${safeFormula}; } catch(e) { return 0; } }`) as MathFunc;
    } catch (e) {
        console.warn("Invalid formula", e);
        return (x) => 0;
    }
};

const sequencePresets: Record<string, FuncLibEntry[]> = {
  "Chaos Theory": [
    { func: (x) => Math.sin(x) * Math.cos(x * 5) * 4, text: 'y = 4sin(x)cos(5x)' },
    { func: (x) => (x * x) / 5 - 4, text: 'y = x²/5 - 4' },
    { func: (x) => perlin.noise(x * 1.5, x, 0) * 5, text: 'y = noise(x)' },
    { func: clampedInverse, text: 'y = 4/x' },
    { func: (x) => Math.floor(Math.sin(x * 2) * 3), text: 'y = floor(3sin(2x))' },
    { func: (x) => sincFunc(x) * 5, text: 'y = 5sinc(x)' },
    { func: clampedTan, text: 'y = 2tan(x/2)'},
    { func: (x) => (Math.pow(x, 3) / 20) - x, text: 'y = x³/20 - x' },
    { func: (x) => Math.sin(x*x/2)*4, text: 'y = 4sin(x²/2)'},
    { func: (x) => (x % 3) * 2 - 3, text: 'y = 2(x % 3) - 3' },
  ],
  "Wild Mix": [
    { func: (x) => (x * x) / 5 - 4, text: 'y = x²/5 - 4' },
    { func: (x) => Math.cos(x) * 3, text: 'y = 3cos(x)' },
    { func: (x) => Math.sin(x * 2) * Math.cos(x * 0.5) * 4, text: 'y = 4sin(2x)cos(0.5x)' },
    { func: (x) => Math.abs(x) - 5, text: 'y = |x| - 5' },
    { func: (x) => (Math.pow(x, 3) / 20) - x , text: 'y = x³/20 - x' },
    { func: (x) => perlin.noise(x * 1.5, 0, 0) * 5, text: 'y = noise(x)' },
    { func: (x) => Math.floor(Math.sin(x * 2) * 3), text: 'y = floor(3sin(2x))' },
  ],
  "Trigonometric Waves": [
    { func: (x) => Math.sin(x) * 4, text: 'y = 4sin(x)' },
    { func: (x) => Math.cos(x*2) * 3, text: 'y = 3cos(2x)' },
    { func: (x) => Math.tan(Math.sin(x)) * 2, text: 'y = 2tan(sin(x))' },
    { func: (x) => (Math.sin(x) + Math.cos(x*2))/2 * 4, text: 'y = 4(sin(x)+cos(2x))/2' },
    { func: (x) => Math.sin(x) * Math.cos(x * 5) * 4, text: 'y = 4sin(x)cos(5x)' },
    { func: (x) => x/2 * Math.sin(x*2), text: 'y = (x/2)sin(2x)' },
    { func: (x) => Math.sin(x*x/2)*4, text: 'y = 4sin(x²/2)'},
    { func: (x) => sincFunc(x) * 5, text: 'y = 5sinc(x)' },
  ],
   "Algebraic & More": [
    { func: (x) => x/2, text: 'y = x/2' },
    { func: (x) => (x*x)/5 - 4, text: 'y = x²/5 - 4' },
    { func: (x) => (Math.pow(x, 3) / 20) - x, text: 'y = x³/20 - x' },
    { func: (x) => (-Math.pow(x, 4) / 100) + (x*x) - 5, text: 'y = -x⁴/100 + x² - 5' },
    { func: clampedInverse, text: 'y = 4/x' },
    { func: (x) => (x % 3) * 2 - 3, text: 'y = 2(x % 3) - 3' },
    { func: (x) => Math.exp(-Math.abs(x*0.5)) * 5 - 1, text: 'y = 5e^(-|x/2|) - 1' },
  ]
};
export const sequencePresetKeys = Object.keys(sequencePresets);


const choreographyScripts: Record<string, ChoreographyScript> = {
    "Rippling Waves": [
        { duration: 2, getTargetState: () => ({ position: new THREE.Vector3(0, 0, 0) }) },
        { duration: 4, getTargetState: (line, index, total, time) => {
            const delay = index * 0.3;
            const progress = THREE.MathUtils.smoothstep(time, delay, delay + 2);
            const z = THREE.MathUtils.lerp(0, line.userData.baseZ, progress);
            const y = Math.sin(progress * Math.PI) * 2;
            return { position: new THREE.Vector3(0, y, z) };
        }},
        { duration: 2, getTargetState: (line) => ({ position: new THREE.Vector3(0, 0, line.userData.baseZ) }) },
    ],
    "Counterpoint": [
        { duration: 2, getTargetState: (line, index) => ({ position: new THREE.Vector3(index % 2 === 0 ? 3 : -3, 0, line.userData.baseZ) })},
        { duration: 3, getTargetState: (line, index) => ({ scale: new THREE.Vector3(1, index % 2 === 0 ? 1.5 : 0.5, 1) })},
        { duration: 3, getTargetState: (line, index) => ({ scale: new THREE.Vector3(1, index % 2 === 0 ? 0.5 : 1.5, 1) })},
        { duration: 2, getTargetState: (line) => ({ position: new THREE.Vector3(0, 0, line.userData.baseZ), scale: new THREE.Vector3(1, 1, 1) })},
    ],
    "Helix Twist": [
        {
            duration: 20, 
            getTargetState: (line, index, total, time) => ({
                position: new THREE.Vector3(0, 0, (index - total/2) * 1.5), 
                rotation: new THREE.Euler(0, 0, index * 0.5 + time * 0.2) 
            })
        }
    ],
    "Radial Star": [
        {
            duration: 20,
            getTargetState: (line, index, total, time) => ({
                position: new THREE.Vector3(0, 0, 0),
                rotation: new THREE.Euler(0, (index / total) * Math.PI + time * 0.1, 0),
                scale: new THREE.Vector3(1, 1, 1)
            })
        }
    ],
    "Accordion": [
        {
            duration: 4, 
            getTargetState: (line, index, total, time) => {
                const cycle = (time % 4) / 4 * Math.PI * 2;
                const expansion = Math.sin(cycle) * 4; 
                const spacing = 2 + expansion; 
                const z = (index - (total - 1) / 2) * spacing;
                return {
                    position: new THREE.Vector3(0, 0, z),
                    scale: new THREE.Vector3(1, 1, 1),
                    rotation: new THREE.Euler(0, 0, 0)
                };
            }
        }
    ],
    "Vortex": [
        {
            duration: 30,
            getTargetState: (line, index, total, time) => {
                const depth = (index / total) * -20; 
                const radius = 6 + (depth * 0.2); 
                const speed = 0.2 + (index * 0.05);
                const angle = time * speed + (index * 0.5);
                return {
                    position: new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, depth),
                    rotation: new THREE.Euler(0, 0, angle + Math.PI/2),
                    scale: new THREE.Vector3(1 - (index/total)*0.5, 1 - (index/total)*0.5, 1)
                };
            }
        }
    ],
    "Sphere Wrap": [
        {
            duration: 30,
            getTargetState: (line, index, total, time) => {
                const sphereRadius = 8;
                const theta = (index / total) * Math.PI * 2 + (time * 0.1);
                return {
                    position: new THREE.Vector3(Math.sin(theta) * sphereRadius, 0, Math.cos(theta) * sphereRadius),
                    rotation: new THREE.Euler(0, theta, Math.PI/2), 
                    scale: new THREE.Vector3(1, 1, 1)
                };
            }
        }
    ]
};

const getNextIndex = (currentIndex: number, library: any[], isRandom: boolean): number => {
    if (library.length <= 1) return 0;
    if (isRandom) {
        let nextIndex = currentIndex;
        while (nextIndex === currentIndex) {
            nextIndex = Math.floor(Math.random() * library.length);
        }
        return nextIndex;
    } else {
        return (currentIndex + 1) % library.length;
    }
};

const createFunctionLine = (
    initialFunc: MathFunc | AnimatedMathFunc,
    color: THREE.ColorRepresentation,
    zPosition: number,
    id: number,
    name?: string
): THREE.Line => {
  const points = new Float32Array(NUM_POINTS * 3);
  const originalY = new Float32Array(NUM_POINTS);
  for (let i = 0; i < NUM_POINTS; i++) {
    const x = (i / (NUM_POINTS - 1)) * (2 * X_RANGE) - X_RANGE;
    // @ts-ignore
    const y = initialFunc(x, 0);
    points[i * 3] = x;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = 0;
    originalY[i] = y;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color, linewidth: 3 });
  const line = new THREE.Line(geometry, material);
  
  line.position.z = zPosition;
  if(name) line.name = name;
  line.userData.id = id;
  line.userData.baseZ = zPosition;
  line.userData.animatedFunc = initialFunc;
  line.userData.originalY = originalY;
  line.userData.colorHex = new THREE.Color(color).getHex();

  return line;
};

interface ThreeSceneProps {
  version: Version;
  onFormulaChange: (text: string) => void;
  isMouseInteractionEnabled: boolean;
  isBreathingCameraEnabled: boolean;
  cameraSpeed: number;
  choreographyMode: ChoreographyMode;
  lineCount: number;
  activeSequenceKey: string;
  isRandomMode: boolean;
  reseedTrigger: number;
  isAudioActive: boolean;
  audioReactionMode: AudioReactionMode;
  audioGain: number;
  isCustomFormulaMode: boolean;
  customFormula: string;
  // Gesture Props
  gestureAmplitude: number;
  gestureFrequency: number;
  gestureCameraX: number;
}

const ThreeScene: React.FC<ThreeSceneProps> = (props) => {
  const { version, onFormulaChange, choreographyMode, lineCount, activeSequenceKey, isRandomMode, reseedTrigger, isAudioActive, audioReactionMode, audioGain, isCustomFormulaMode, customFormula } = props;
  const mountRef = useRef<HTMLDivElement>(null);
  
  // Three.js Instance Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const cameraHolderRef = useRef<THREE.Group | null>(null);
  const lineGroupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const requestRef = useRef<number | null>(null);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const fusionTargetsRef = useRef<{parentA?: THREE.Line, parentB?: THREE.Line, child?: THREE.Line}>({});
  const morphStateA = useRef<MorphState>({ currentIndex: 0, nextIndex: 1, progress: 1 });
  const morphStateB = useRef<MorphState>({ currentIndex: 2, nextIndex: 3, progress: 1 }); 
  const mousePos = useRef(new THREE.Vector2(0, 0));

  const latestProps = useRef(props);
  useEffect(() => {
    latestProps.current = props;
  });
  
  const choreographyState = useRef({
      isTransitioning: false,
      transitionProgress: 0,
      transitionDuration: 1.0,
      transitionStartStates: new Map<string, Partial<LineState>>(),
      time: 0,
      phaseIndex: 0,
      script: null as ChoreographyScript | null,
      lastPhaseTargets: new Map<string, Partial<LineState>>()
  });

  // --- Audio Setup ---
  useEffect(() => {
    if (isAudioActive) {
        const initAudio = async () => {
            try {
                if (!audioContextRef.current) {
                    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                    audioContextRef.current = new AudioContext();
                }
                if (audioContextRef.current?.state === 'suspended') {
                    await audioContextRef.current.resume();
                }
                
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const analyser = audioContextRef.current!.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.8;
                const source = audioContextRef.current!.createMediaStreamSource(stream);
                source.connect(analyser);
                
                analyserRef.current = analyser;
                sourceRef.current = source;
                dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
            } catch (err) {
                console.error("Error accessing microphone:", err);
            }
        };
        initAudio();
    } else {
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
    }
  }, [isAudioActive]);


  // --- Effect 1: INIT (Runs once) ---
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 15, 45);
    sceneRef.current = scene;

    const cameraHolder = new THREE.Group();
    scene.add(cameraHolder);
    cameraHolderRef.current = cameraHolder;

    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.set(0, 4, 18);
    cameraHolder.add(camera);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.0);
    bloomPassRef.current = bloomPass;
    composer.addPass(bloomPass);
    composerRef.current = composer;

    const lineGroup = new THREE.Group();
    scene.add(lineGroup);
    lineGroupRef.current = lineGroup;

    const raycaster = new THREE.Raycaster();
    const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectionPoint = new THREE.Vector3();

    const handlePointerMove = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mousePos.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mousePos.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    
    const handleResize = () => {
      const { clientWidth: width, clientHeight: height } = currentMount;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    currentMount.addEventListener('pointermove', handlePointerMove);

    const clock = new THREE.Clock();
    
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      
      const { 
          isBreathingCameraEnabled, cameraSpeed, isMouseInteractionEnabled, 
          version: currentVersion, choreographyMode: currentChoreoMode, 
          activeSequenceKey: currentSequenceKey, isRandomMode: currentRandomMode, 
          isAudioActive, audioReactionMode, audioGain,
          gestureAmplitude, gestureFrequency, gestureCameraX
      } = latestProps.current;

      const activeSequence = sequencePresets[currentSequenceKey] || sequencePresets[sequencePresetKeys[0]];

      controls.update();
      const delta = clock.getDelta();
      const t = clock.getElapsedTime();

      // Audio Data Processing
      let audioBassLevel = 0;
      let audioAvgVolume = 0;
      let audioFreqData: Uint8Array | null = null;
      let trebleLevel = 0;

      if (isAudioActive && analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          audioFreqData = dataArrayRef.current;
          let sum = 0; let bassSum = 0; let trebleSum = 0;
          const bassLimit = Math.floor(dataArrayRef.current.length * 0.1); 
          const trebleStart = Math.floor(dataArrayRef.current.length * 0.7); 
          for(let i=0; i<dataArrayRef.current.length; i++) {
              sum += dataArrayRef.current[i];
              if(i < bassLimit) bassSum += dataArrayRef.current[i];
              if(i > trebleStart) trebleSum += dataArrayRef.current[i];
          }
          audioAvgVolume = (sum / dataArrayRef.current.length) * audioGain;
          audioBassLevel = (bassSum / bassLimit) * audioGain;
          trebleLevel = (trebleSum / (dataArrayRef.current.length - trebleStart)) * audioGain;
          audioAvgVolume = Math.min(255, audioAvgVolume);
          audioBassLevel = Math.min(255, audioBassLevel);
          trebleLevel = Math.min(255, trebleLevel);

          if (bloomPassRef.current) {
             bloomPassRef.current.strength = 1.5 + (audioAvgVolume / 255) * 2.0;
             bloomPassRef.current.radius = 0.4 + (audioBassLevel / 255) * 0.5;
          }
      } else {
          if (bloomPassRef.current) {
             bloomPassRef.current.strength = THREE.MathUtils.lerp(bloomPassRef.current.strength, 1.5, 0.1);
          }
      }

      raycaster.setFromCamera(mousePos.current, camera);
      raycaster.ray.intersectPlane(interactionPlane, intersectionPoint);

      if (cameraHolderRef.current) {
          // Combined Camera Logic: Breathing + Audio Kick + Gesture Control
          const bassKick = isAudioActive ? (audioBassLevel / 255) * 2.0 : 0;
          let rotY = 0;
          let posZ = 0;

          if (isBreathingCameraEnabled) {
            rotY = t * 0.05 * cameraSpeed;
            posZ = (Math.sin(t * 0.2 * cameraSpeed) * 3) + (bassKick * 2); 
          } else {
             posZ = isAudioActive ? (audioBassLevel / 255) * 0.5 : 0;
          }

          // Apply Hand Gesture Rotation Overlay
          cameraHolderRef.current.rotation.y = rotY + gestureCameraX; 
          cameraHolderRef.current.position.z = posZ;
      }

      const lg = lineGroupRef.current;
      if (!lg) return;

      const basePositions: { [lineUUID: string]: Float32Array } = {};
      lg.children.forEach(line => {
        if (line instanceof THREE.Line) {
            const positions = (line.geometry.attributes.position as THREE.BufferAttribute).clone();
            basePositions[line.uuid] = positions.array as Float32Array;
            
            // Audio Color Reactive
            if (isAudioActive) {
                 const baseHex = line.userData.colorHex;
                 const color = new THREE.Color(baseHex);
                 const hsl = { h: 0, s: 0, l: 0 };
                 color.getHSL(hsl);
                 
                 if (audioReactionMode === 'Voltage') {
                     if (Math.random() < (trebleLevel/255)) {
                         (line.material as THREE.LineBasicMaterial).color.setHex(0xffffff);
                     } else {
                         (line.material as THREE.LineBasicMaterial).color.setHex(baseHex);
                     }
                 } else if (audioReactionMode === 'Heartbeat') {
                     hsl.l = Math.min(0.9, Math.max(0.3, (audioBassLevel/255)));
                     (line.material as THREE.LineBasicMaterial).color.setHSL(hsl.h, hsl.s, hsl.l);
                 } else {
                     if (audioAvgVolume > 10) {
                        hsl.h = (hsl.h + (audioAvgVolume / 1000) + t * 0.1) % 1;
                        hsl.l = Math.min(0.8, Math.max(0.2, hsl.l + (audioAvgVolume / 500)));
                        (line.material as THREE.LineBasicMaterial).color.setHSL(hsl.h, hsl.s, hsl.l);
                     } else {
                         (line.material as THREE.LineBasicMaterial).color.lerp(new THREE.Color(baseHex), 0.05);
                     }
                 }
            } 
        }
      });

      // --- UPDATE GEOMETRY ---
      // Apply Gesture Frequency (X Stretch) and Amplitude (Y Scale) to all calculations
      
      if (currentVersion === 'AUDIO_WAVE') {
           lg.children.forEach((line, lineIndex) => {
              if (line instanceof THREE.Line) {
                  const positions = basePositions[line.uuid];
                  const originalY = line.userData.originalY as Float32Array;
                  
                  if (audioFreqData) {
                      if (audioReactionMode === 'Spectrum') {
                          for(let i = 0; i < NUM_POINTS; i++) {
                              let freqIndex = Math.floor(i * (audioFreqData!.length / NUM_POINTS));
                              freqIndex = (freqIndex + lineIndex * 5) % audioFreqData!.length;
                              const spectrumVal = (audioFreqData![freqIndex] / 255.0) * audioGain;
                              
                              // Apply Frequency Gesture to X
                              const x = ((i / (NUM_POINTS - 1)) * (2 * X_RANGE) - X_RANGE) * gestureFrequency;
                              positions[i * 3] = x;
                              
                              // Apply Amplitude Gesture to Y
                              positions[i * 3 + 1] = (originalY[i] + spectrumVal * 3) * gestureAmplitude;
                          }
                      }
                      else if (audioReactionMode === 'Voltage') {
                          const jitterIntensity = (trebleLevel / 255) * audioGain * 1.5;
                          for(let i = 0; i < NUM_POINTS; i++) {
                              const noise = (Math.random() - 0.5) * jitterIntensity;
                              const x = ((i / (NUM_POINTS - 1)) * (2 * X_RANGE) - X_RANGE) * gestureFrequency;
                              positions[i * 3] = x;
                              positions[i * 3 + 1] = (originalY[i] + noise) * gestureAmplitude;
                          }
                      }
                      else if (audioReactionMode === 'Heartbeat') {
                          const beat = (audioBassLevel / 255) * audioGain;
                          const scale = 1 + Math.pow(beat, 3) * 3; 
                          for(let i = 0; i < NUM_POINTS; i++) {
                               const x = ((i / (NUM_POINTS - 1)) * (2 * X_RANGE) - X_RANGE) * gestureFrequency;
                               positions[i * 3] = x;
                               positions[i * 3 + 1] = (originalY[i] * scale) * gestureAmplitude;
                          }
                      }
                  } else {
                      for(let j=0; j<NUM_POINTS; j++) {
                        const xBase = (j / (NUM_POINTS - 1)) * (2 * X_RANGE) - X_RANGE;
                        const x = xBase * gestureFrequency;
                        positions[j*3] = x;
                        const y = originalY[j] + Math.sin(xBase + t + lineIndex * 0.5) * 0.2;
                        positions[j*3+1] = y * gestureAmplitude;
                     }
                  }
              }
           });
      } else if (currentVersion === 'NEON_DANCE') {
        lg.children.forEach(line => {
          if (line instanceof THREE.Line) {
            const func = line.userData.animatedFunc as AnimatedMathFunc;
            for (let i = 0; i < NUM_POINTS; i++) {
                const xBase = (i / (NUM_POINTS - 1)) * (2 * X_RANGE) - X_RANGE;
                const x = xBase * gestureFrequency;
                basePositions[line.uuid][i * 3] = x;
                basePositions[line.uuid][i * 3 + 1] = func(xBase, t) * gestureAmplitude; // Pass base x to func to maintain shape, scale result
            }
          }
        });
      } else if (currentVersion === 'WAVE_DANCE') {
        lg.children.forEach(line => {
          if (line instanceof THREE.Line) {
            const originalY = line.userData.originalY as Float32Array;
            const scale = 1 + Math.sin(t * 2 + line.position.z * 0.5) * 0.2;
            for (let i = 0; i < NUM_POINTS; i++) {
                const xBase = (i / (NUM_POINTS - 1)) * (2 * X_RANGE) - X_RANGE;
                basePositions[line.uuid][i * 3] = xBase * gestureFrequency;
                basePositions[line.uuid][i * 3 + 1] = originalY[i] * scale * gestureAmplitude;
            }
          }
        });
      } else if (currentVersion === 'FUNCTION_MORPH') {
        // ... Morph logic similar ...
        // We need to apply freq/amp to the lerped result
        const state = morphStateA.current;
        state.progress += delta * TRANSITION_SPEED;
        if (state.progress >= 1.0) {
            state.progress = 0.0;
            state.currentIndex = state.nextIndex;
            state.nextIndex = getNextIndex(state.currentIndex, activeSequence, currentRandomMode);
        }
        latestProps.current.onFormulaChange(activeSequence[state.currentIndex].text);
        const currentFunc = activeSequence[state.currentIndex].func;
        const nextFunc = activeSequence[state.nextIndex].func;
        lg.children.forEach(line => {
            if (line instanceof THREE.Line) {
                for (let i = 0; i < NUM_POINTS; i++) {
                    const xBase = (i / (NUM_POINTS - 1)) * (2 * X_RANGE) - X_RANGE;
                    const y1 = currentFunc(xBase); const y2 = nextFunc(xBase);
                    basePositions[line.uuid][i * 3] = xBase * gestureFrequency;
                    basePositions[line.uuid][i * 3 + 1] = THREE.MathUtils.lerp(y1, y2, state.progress) * gestureAmplitude;
                }
            }
        });
      } else if (currentVersion === 'FUNCTION_FUSION') {
        // ... similar logic for fusion ...
        const stateA = morphStateA.current; const stateB = morphStateB.current;
        stateA.progress += delta * TRANSITION_SPEED;
        if (stateA.progress >= 1.0) { stateA.progress = 0.0; stateA.currentIndex = stateA.nextIndex; stateA.nextIndex = getNextIndex(stateA.currentIndex, activeSequence, currentRandomMode); }
        stateB.progress += delta * TRANSITION_SPEED * 0.7;
        if (stateB.progress >= 1.0) { stateB.progress = 0.0; stateB.currentIndex = stateB.nextIndex; stateB.nextIndex = getNextIndex(stateB.currentIndex, activeSequence, currentRandomMode); }
        
        latestProps.current.onFormulaChange(`( ${activeSequence[stateA.currentIndex].text} )   +   ( ${activeSequence[stateB.currentIndex].text} )`);
        
        const parentAFuncs = { current: activeSequence[stateA.currentIndex].func, next: activeSequence[stateA.nextIndex].func };
        const parentBFuncs = { current: activeSequence[stateB.currentIndex].func, next: activeSequence[stateB.nextIndex].func };
        
        const parentA = fusionTargetsRef.current.parentA;
        const parentB = fusionTargetsRef.current.parentB;
        const child = fusionTargetsRef.current.child;

        if (parentA && parentB && child) {
          for (let i = 0; i < NUM_POINTS; i++) {
              const xBase = (i / (NUM_POINTS - 1)) * (2 * X_RANGE) - X_RANGE;
              const x = xBase * gestureFrequency;
              const yA = THREE.MathUtils.lerp(parentAFuncs.current(xBase), parentAFuncs.next(xBase), stateA.progress) * gestureAmplitude;
              const yB = THREE.MathUtils.lerp(parentBFuncs.current(xBase), parentBFuncs.next(xBase), stateB.progress) * gestureAmplitude;
              
              basePositions[parentA.uuid][i * 3] = x;
              basePositions[parentA.uuid][i * 3 + 1] = yA;
              
              basePositions[parentB.uuid][i * 3] = x;
              basePositions[parentB.uuid][i * 3 + 1] = yB;
              
              basePositions[child.uuid][i * 3] = x;
              basePositions[child.uuid][i * 3 + 1] = yA + yB;
          }
        }
      } else if (currentVersion === 'NEON_STATIC') {
          // Even static needs update if gesture changes
           lg.children.forEach(line => {
            if (line instanceof THREE.Line) {
                 const originalY = line.userData.originalY as Float32Array;
                 for (let i = 0; i < NUM_POINTS; i++) {
                    const xBase = (i / (NUM_POINTS - 1)) * (2 * X_RANGE) - X_RANGE;
                    basePositions[line.uuid][i * 3] = xBase * gestureFrequency;
                    basePositions[line.uuid][i * 3 + 1] = originalY[i] * gestureAmplitude;
                 }
            }
           });
      }

      // --- Choreography Engine Update (Standard) ---
      // ... (Rest of choreography logic same as before, but applying transforms to objects)
      const choreo = choreographyState.current;
      
      if (choreo.isTransitioning) {
        choreo.transitionProgress += delta / choreo.transitionDuration;
        const progress = THREE.MathUtils.smoothstep(choreo.transitionProgress, 0, 1);
        
        lg.children.forEach(obj => {
          if (obj instanceof THREE.Line) {
            const startState = choreo.transitionStartStates.get(obj.uuid);
            if (!startState) return;
            let targetState: Partial<LineState> = {};
            if (currentChoreoMode === 'Off') {
                targetState = { position: new THREE.Vector3(0, 0, obj.userData.baseZ), scale: new THREE.Vector3(1, 1, 1), rotation: new THREE.Euler(0, 0, 0) };
            } else if (currentChoreoMode === 'Ensemble') {
                targetState = startState;
            } else {
                const script = choreographyScripts[currentChoreoMode];
                if (script) targetState = script[0].getTargetState(obj, obj.userData.id, lg.children.length, 0);
            }
            obj.position.lerpVectors(startState.position!, targetState.position || startState.position!, progress);
            obj.scale.lerpVectors(startState.scale!, targetState.scale || startState.scale!, progress);
            if (startState.rotation && targetState.rotation) {
                 obj.rotation.x = THREE.MathUtils.lerp(startState.rotation.x, targetState.rotation.x, progress);
                 obj.rotation.y = THREE.MathUtils.lerp(startState.rotation.y, targetState.rotation.y, progress);
                 obj.rotation.z = THREE.MathUtils.lerp(startState.rotation.z, targetState.rotation.z, progress);
            } else if (startState.rotation) {
                 obj.rotation.copy(startState.rotation);
            }
          }
        });

        if (choreo.transitionProgress >= 1) {
          choreo.isTransitioning = false;
          choreo.time = 0;
          choreo.phaseIndex = 0;
          choreo.script = choreographyScripts[currentChoreoMode] || null;
           lg.children.forEach(obj => {
                if (obj instanceof THREE.Line) {
                    const firstPhaseTarget = choreo.script ? choreo.script[0].getTargetState(obj, obj.userData.id, lg.children.length, 0) : {};
                    choreo.lastPhaseTargets.set(obj.uuid, {
                        position: firstPhaseTarget.position || obj.position.clone(),
                        scale: firstPhaseTarget.scale || obj.scale.clone(),
                        rotation: firstPhaseTarget.rotation || obj.rotation.clone(),
                    });
                }
            });
        }
      } else { 
         if (currentChoreoMode === 'Ensemble') {
             lg.children.forEach(obj => {
                if (obj instanceof THREE.Line) {
                    const id = obj.userData.id; const time = t * 0.3;
                    obj.position.set(
                        perlin.noise(id * 1.5, time, 10) * 0.5,
                        perlin.noise(id * 0.5, time, 0) * 1.0,
                        obj.userData.baseZ + perlin.noise(id * 2.5, time, 20) * 1.5
                    );
                    obj.rotation.set(0, perlin.noise(id * 3.5, time, 30) * 0.2, 0);
                }
            });
        } else if (choreo.script) {
             choreo.time += delta;
            let timeIntoCurrentScript = choreo.time;
            let totalDuration = choreo.script.reduce((sum, p) => sum + p.duration, 0);
            if (timeIntoCurrentScript > totalDuration) {
                choreo.time = 0;
                timeIntoCurrentScript = 0;
            }
            let cumulativeDuration = 0;
            let currentPhaseIndex = 0;
            for(let i=0; i<choreo.script.length; i++) {
                if (timeIntoCurrentScript < cumulativeDuration + choreo.script[i].duration) {
                    currentPhaseIndex = i;
                    break;
                }
                cumulativeDuration += choreo.script[i].duration;
            }
            if (currentPhaseIndex !== choreo.phaseIndex) {
                const prevPhase = choreo.script[choreo.phaseIndex];
                lg.children.forEach((obj, i) => {
                    if (obj instanceof THREE.Line) {
                        const prevTarget = prevPhase.getTargetState(obj, i, lg.children.length, prevPhase.duration);
                        const lastKnownState = choreo.lastPhaseTargets.get(obj.uuid) || {};
                        choreo.lastPhaseTargets.set(obj.uuid, {
                            position: prevTarget.position || lastKnownState.position || obj.position.clone(),
                            scale: prevTarget.scale || lastKnownState.scale || obj.scale.clone(),
                            rotation: prevTarget.rotation || lastKnownState.rotation || obj.rotation.clone(),
                        });
                    }
                });
                choreo.phaseIndex = currentPhaseIndex;
            }
            const currentPhase = choreo.script[choreo.phaseIndex];
            const timeInPhase = timeIntoCurrentScript - cumulativeDuration;
            const progress = timeInPhase / currentPhase.duration;

            lg.children.forEach((obj, i) => {
                if (obj instanceof THREE.Line) {
                    const startState = choreo.lastPhaseTargets.get(obj.uuid)!;
                    const targetState = currentPhase.getTargetState(obj, i, lg.children.length, timeInPhase);
                    if (targetState.position) obj.position.lerpVectors(startState.position!, targetState.position, progress);
                    if (targetState.scale) obj.scale.lerpVectors(startState.scale!, targetState.scale, progress);
                    if (targetState.rotation) {
                        obj.rotation.x = THREE.MathUtils.lerp(startState.rotation!.x, targetState.rotation.x, progress);
                        obj.rotation.y = THREE.MathUtils.lerp(startState.rotation!.y, targetState.rotation.y, progress);
                        obj.rotation.z = THREE.MathUtils.lerp(startState.rotation!.z, targetState.rotation.z, progress);
                    }
                }
            });
        }
      }
      
      lg.children.forEach(obj => {
        if (obj instanceof THREE.Line) {
          const finalPositions = obj.geometry.attributes.position.array as Float32Array;
          const basePosArray = basePositions[obj.uuid];
          obj.updateWorldMatrix(true, false);
          if (isMouseInteractionEnabled && intersectionPoint) {
              const invMatrix = obj.matrixWorld.clone().invert();
              const localIntersection = intersectionPoint.clone().applyMatrix4(invMatrix);
              for (let i = 0; i < NUM_POINTS; i++) {
                  const x = basePosArray[i * 3]; const baseY = basePosArray[i * 3 + 1];
                  const dist = Math.hypot(x - localIntersection.x, baseY - localIntersection.y);
                  let finalY = baseY;
                  if (dist < MOUSE_INTERACTION_RADIUS) {
                      finalY += MOUSE_INTERACTION_STRENGTH * Math.pow(1 - dist / MOUSE_INTERACTION_RADIUS, 2);
                  }
                  finalPositions[i * 3 + 1] = finalY;
                  finalPositions[i * 3] = basePosArray[i*3]; // Update X too in case freq changed
              }
          } else {
              finalPositions.set(basePosArray);
          }
          obj.geometry.attributes.position.needsUpdate = true;
        }
      });

      composer.render();
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      currentMount.removeEventListener('pointermove', handlePointerMove);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();

      controls.dispose();
      renderer.dispose();
      composer.dispose();
      if (currentMount && renderer.domElement.parentNode === currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // --- Effect 2: CONTENT ---
  // Same logic as before to reset lines on prop changes
  useEffect(() => {
      if (isRandomMode) {
          const activeSequence = sequencePresets[activeSequenceKey] || sequencePresets[sequencePresetKeys[0]];
          morphStateA.current = { currentIndex: getNextIndex(-1, activeSequence, true), nextIndex: getNextIndex(0, activeSequence, true), progress: 0 };
          morphStateB.current = { currentIndex: getNextIndex(-1, activeSequence, true), nextIndex: getNextIndex(0, activeSequence, true), progress: 0 };
      }
  }, [reseedTrigger, isRandomMode, activeSequenceKey]);

  useEffect(() => {
      const lg = lineGroupRef.current;
      if (!lg) return;
      
      while(lg.children.length > 0){ 
        const obj = lg.children[0];
        if (obj instanceof THREE.Line) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
        }
        lg.remove(obj); 
      }
      fusionTargetsRef.current = {};

      const activeSequence = sequencePresets[activeSequenceKey] || sequencePresets[sequencePresetKeys[0]];
      const parabolaFunc: MathFunc = (x) => (x * x) / 5 - 4;
      const dancingParabolaFunc: AnimatedMathFunc = (x, t) => parabolaFunc(x) + Math.sin(x * 2 + t * 2);
      const colors = [0xff00ff, 0x00ffff, 0x00ff00, 0xffff00, 0xffa500, 0xff4500, 0x3399ff, 0xda70d6, 0xadff2f, 0xff69b4];
      
      morphStateA.current = { currentIndex: 0, nextIndex: getNextIndex(0, activeSequence, isRandomMode), progress: 1 };
      const bStart = Math.min(2, activeSequence.length -1);
      morphStateB.current = { currentIndex: bStart, nextIndex: getNextIndex(bStart, activeSequence, isRandomMode), progress: 1 };
  
      switch (version) {
        case 'NEON_STATIC': case 'WAVE_DANCE': case 'FUNCTION_MORPH':
          const initialFunc = version === 'FUNCTION_MORPH' ? activeSequence[0].func : parabolaFunc;
          for (let i = 0; i < lineCount; i++) {
            lg.add(createFunctionLine(initialFunc, colors[i % colors.length], -i * 2, i));
          }
          break;
        case 'AUDIO_WAVE':
          if (isCustomFormulaMode) {
             const customFunc = createFunctionFromString(customFormula);
             for (let i = 0; i < lineCount; i++) {
                 lg.add(createFunctionLine(customFunc, colors[i % colors.length], -i * 2, i));
             }
          } else {
             for (let i = 0; i < lineCount; i++) {
                 lg.add(createFunctionLine(activeSequence[i % activeSequence.length].func, colors[i % colors.length], -i * 2, i));
             }
          }
          break;
        case 'NEON_DANCE':
          for (let i = 0; i < lineCount; i++) {
            lg.add(createFunctionLine(dancingParabolaFunc, colors[i % colors.length], -i * 2, i));
          }
          break;
        case 'FUNCTION_FUSION':
          const indexA = morphStateA.current.currentIndex % activeSequence.length;
          const indexB = morphStateB.current.currentIndex % activeSequence.length;
          const lineA = createFunctionLine(activeSequence[indexA].func, colors[0], -2, 0, "parentA");
          const lineB = createFunctionLine(activeSequence[indexB].func, colors[1], 2, 1, "parentB");
          const childFunc: MathFunc = (x) => activeSequence[indexA].func(x) + activeSequence[indexB].func(x);
          const lineChild = createFunctionLine(childFunc, 0xffffff, 0, 2, "child");
          lg.add(lineA);
          lg.add(lineB);
          lg.add(lineChild);
          fusionTargetsRef.current = { parentA: lineA, parentB: lineB, child: lineChild };
          break;
      }
      
      const choreo = choreographyState.current;
      choreo.transitionStartStates.clear();
      lg.children.forEach(obj => {
        if (obj instanceof THREE.Line) {
            choreo.transitionStartStates.set(obj.uuid, {
                position: obj.position.clone(),
                scale: obj.scale.clone(),
                rotation: obj.rotation.clone(),
            });
        }
      });
      choreo.isTransitioning = true;
      choreo.transitionProgress = 0;

  }, [version, lineCount, activeSequenceKey, isRandomMode, isCustomFormulaMode, customFormula]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;